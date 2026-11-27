// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPortal} from "flap/IPortal.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {PackLauncher} from "./PackLauncher.sol";

/// @notice Buyers can pool the remaining fixed-price packs in a HexPit round.
/// A pledge stays refundable until the last seat buys all remaining packs in one call.
contract ClosingTable is ReentrancyGuard {
    using SafeTransferLib for address;

    address public immutable factory;
    address public constant PORTAL = 0x000042108465206185A077Edc3F3fd2b49060000;
    address public constant USD = 0x190C989D5665a0e404B444b53CAE9AbCfb600157;
    uint256 public constant PRICE = 5 ether;
    uint256 public constant LIMIT = 12;

    struct Seat {
        uint8 position; // One-based. Zero means this wallet has no pledge.
        uint8[5] cards;
        bool claimed;
    }

    struct Table {
        address[] players;
        mapping(address => Seat) seats;
        uint256 startSold;
        uint256 reward;
        uint256 handsReceived;
        bool receiving;
    }

    mapping(PackLauncher => Table) private tables;

    event Pledged(address indexed launcher, address indexed player, uint256 seats, uint256 target);
    event Returned(address indexed launcher, address indexed player);
    event Closed(address indexed launcher, uint256 seats, uint256 game, address pool);
    event HandClaimed(address indexed launcher, address indexed player, address indexed to, uint256 game);

    constructor(address factory_) {
        require(block.chainid == 97 && factory_.code.length != 0, "testnet factory required");
        factory = factory_;
    }

    function tableState(PackLauncher round) external view returns (uint256 startSold, uint256 pledged, uint256 reward) {
        Table storage table = tables[round];
        return (table.startSold, table.players.length, table.reward);
    }

    function seatOf(PackLauncher round, address player) external view returns (Seat memory) {
        return tables[round].seats[player];
    }

    function join(PackLauncher round, uint256 quotedSold) external nonReentrant {
        Table storage table = tables[round];
        require(table.reward == 0 && table.seats[msg.sender].position == 0, "seat unavailable");
        require(IPortal(PORTAL).getLauncher(address(round)).launcherFactory == factory, "unknown launcher");
        require(round.USD() == USD && round.PACK_PRICE() == PRICE && round.PACK_LIMIT() == LIMIT, "unsupported round");
        require(quotedSold < LIMIT && quotedSold == round.sold() && block.timestamp < round.deadline(), "round changed");
        if (table.players.length == 0) table.startSold = quotedSold;
        require(table.startSold == quotedSold, "release old pledges first");

        USD.safeTransferFrom(msg.sender, address(this), PRICE);
        table.players.push(msg.sender);
        uint256 count = table.players.length;
        table.seats[msg.sender].position = uint8(count);
        uint256 target = LIMIT - quotedSold;
        emit Pledged(address(round), msg.sender, count, target);
        if (count == target) _close(round, table, count);
    }

    function leave(PackLauncher round) external nonReentrant {
        Table storage table = tables[round];
        uint256 position = table.seats[msg.sender].position;
        require(position != 0 && table.reward == 0, "no refundable seat");
        // Preserve the remaining wallets' draw order when a player leaves.
        for (uint256 i = position; i < table.players.length; ++i) {
            address next = table.players[i];
            table.players[i - 1] = next;
            table.seats[next].position = uint8(i);
        }
        table.players.pop();
        if (table.players.length == 0) table.startSold = 0;
        _returnPledge(round, table, msg.sender);
    }

    /// @notice A solo mint changes the advertised seat count and payout.
    /// Anyone can return every old pledge before a table takes the new quote.
    function release(PackLauncher round) external nonReentrant {
        Table storage table = tables[round];
        require(table.players.length != 0 && table.reward == 0, "no refundable table");
        require(round.sold() != table.startSold || block.timestamp >= round.deadline(), "quote is current");
        while (table.players.length != 0) {
            address player = table.players[table.players.length - 1];
            table.players.pop();
            _returnPledge(round, table, player);
        }
        table.startSold = 0;
    }

    function _returnPledge(PackLauncher round, Table storage table, address player) private {
        delete table.seats[player];
        USD.safeTransfer(player, PRICE);
        emit Returned(address(round), player);
    }

    function _close(PackLauncher round, Table storage table, uint256 count) private {
        uint256 reward = round.cumulative(LIMIT) - round.cumulative(table.startSold);
        USD.safeApprove(address(round), count * PRICE);
        table.receiving = true;
        round.mintPacks(count, reward);
        table.receiving = false;
        address pool = round.pool();
        require(pool != address(0) && table.handsReceived == count && round.allocation(address(this)) == reward,
            "incomplete pack or pool settlement");
        round.claim();
        table.reward = reward;
        emit Closed(address(round), count, reward, pool);
    }

    function onERC1155BatchReceived(address operator, address from, uint256[] calldata ids,
        uint256[] calldata amounts, bytes calldata) external returns (bytes4) {
        Table storage table = tables[PackLauncher(msg.sender)];
        require(table.receiving && operator == address(this) && from == address(0), "expected round mint");
        require(ids.length == 5 && amounts.length == 5, "expected one hand");
        Seat storage seat = table.seats[table.players[table.handsReceived++]];
        for (uint256 i; i < 5; ++i) {
            require(ids[i] > 0 && ids[i] <= 117 && amounts[i] == 1, "invalid card");
            seat.cards[i] = uint8(ids[i]);
        }
        return this.onERC1155BatchReceived.selector;
    }

    function claimable(PackLauncher round, address player) public view returns (uint256) {
        Table storage table = tables[round];
        Seat storage seat = table.seats[player];
        if (table.reward == 0 || seat.position == 0 || seat.claimed) return 0;
        uint256 end = seat.position;
        uint256 count = table.players.length;
        return table.reward * end / count - table.reward * (end - 1) / count;
    }

    function claim(PackLauncher round, address to) external nonReentrant {
        require(to != address(0) && to != address(this), "choose a recipient");
        uint256 share = claimable(round, msg.sender);
        require(share != 0, "no claim");
        Seat storage seat = tables[round].seats[msg.sender];
        seat.claimed = true;
        uint256[] memory ids = new uint256[](5);
        uint256[] memory amounts = new uint256[](5);
        for (uint256 i; i < 5; ++i) {
            ids[i] = seat.cards[i];
            amounts[i] = 1;
        }
        round.safeBatchTransferFrom(address(this), to, ids, amounts, "");
        round.token().safeTransfer(to, share);
        emit HandClaimed(address(round), msg.sender, to, share);
    }
}
