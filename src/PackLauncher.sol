// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {LauncherBase} from "flap/LauncherBase.sol";
import {LauncherDescription} from "flap/LauncherHelper.sol";
import {IPortal, IPortalTypes} from "flap/IPortal.sol";
import {Distribution, DistributionTarget} from "flap/Distribution.sol";
import {IStrategy} from "flap/IStrategy.sol";
import {LaunchExtensionHelper} from "flap/LaunchExtensionHelper.sol";
import {ERC1155} from "solady/tokens/ERC1155.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {LibString} from "solady/utils/LibString.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {CardCatalog} from "./CardCatalog.sol";

contract PackLauncher is LauncherBase, IStrategy, ERC1155, ReentrancyGuard {
    using SafeTransferLib for address;
    address public constant USD = 0x190C989D5665a0e404B444b53CAE9AbCfb600157;
    address public constant PORTAL = 0x000042108465206185A077Edc3F3fd2b49060000;
    uint256 public constant PACK_PRICE = 5 ether;
    uint256 public constant PACK_LIMIT = 12;
    uint256 public constant TARGET = PACK_LIMIT * PACK_PRICE;
    uint256 public constant RESERVE = 500_000 ether;
    address public creator;
    bytes32 public salt;
    uint256 public deadline;
    uint256 public sold;
    address public token;
    address public pool;
    bool private distributing;
    string public metadata;
    mapping(address => uint256) public paid;
    mapping(address => uint256) public allocation;

    event PackOpened(address indexed player, uint256 indexed number, uint256[] cards, uint256 game);
    event PoolOpened(address indexed token, address indexed pool);
    event Claimed(address indexed player, uint256 game);
    event Refunded(address indexed player, uint256 usd);

    constructor() { creator = address(1); } // Lock the implementation. Proxies have independent storage.

    function initialize(address creator_, bytes32 salt_, string calldata meta_) external payable {
        require(block.chainid == 97 && creator == address(0) && creator_ != address(0), "testnet or initialized");
        require(bytes(meta_).length > 0 && msg.value == IPortal(PORTAL).SALT_LOCK_FEE(), "metadata or fee");
        creator = creator_;
        salt = salt_;
        metadata = meta_;
        deadline = block.timestamp + 7 days;
        IPortal(PORTAL).lockSalt{value: msg.value}(salt_, 0);
    }

    function _getHub() internal pure override returns (address) { return PORTAL; }

    function _description() internal pure override returns (LauncherDescription memory d) {
        d.name = "HexPit Game"; d.symbol = "GAME"; d.quoteToken = USD;
        d.targetRaise = TARGET; d.poolTokenRatio = 0.5 ether;
        d.titleEn = "HexPit pack mint"; d.titleZh = unicode"HexPit 卡包";
        d.summaryEn = "Twelve five-card packs fund a GAME/USD pool. Each pack fixes a GAME claim.";
        d.summaryZh = unicode"十二个五张卡牌包为 GAME/USD 池提供流动性。";
    }

    function uri(uint256 id) public pure override returns (string memory) {
        require(id > 0 && id <= CardCatalog.COUNT, "unknown card");
        return string.concat("https://eoc-gold.github.io/hexpit-flap-launch/cards/", LibString.toString(id), ".json");
    }

    // Cumulative weights 12, 11, ... 1. Subtract cumulative results so all rounding
    // dust goes to pack 12 and the claim reserve is exhausted exactly.
    function cumulative(uint256 n) public pure returns (uint256) {
        require(n <= PACK_LIMIT, "pack range");
        return RESERVE * n * (2 * PACK_LIMIT + 1 - n) / (PACK_LIMIT * (PACK_LIMIT + 1));
    }

    function mintPacks(uint256 count, uint256 minimumGame) external nonReentrant {
        uint256 start = sold;
        uint256 end = start + count;
        require(block.timestamp < deadline && count != 0 && end <= PACK_LIMIT, "round closed or quantity");
        uint256 earned = cumulative(end) - cumulative(start);
        require(earned >= minimumGame, "allocation changed");
        uint256 cost = count * PACK_PRICE;
        USD.safeTransferFrom(msg.sender, address(this), cost);
        paid[msg.sender] += cost;
        allocation[msg.sender] += earned;
        sold = end;
        for (uint256 n = start + 1; n <= end; ++n) {
            // Illustrative testnet draws. Block producers can influence this seed.
            // Card outcomes never change GAME allocation or the stablecoin debit.
            bytes32 seed = keccak256(abi.encode(blockhash(block.number - 1), address(this), msg.sender, n));
            uint256[] memory ids = CardCatalog.draw(seed);
            uint256[] memory copies = new uint256[](5);
            for (uint256 i; i < 5; ++i) copies[i] = 1;
            _batchMint(msg.sender, ids, copies, "");
            emit PackOpened(msg.sender, n, ids, cumulative(n) - cumulative(n - 1));
        }
        if (end == PACK_LIMIT) _openPool();
    }

    function _openPool() private {
        IPortalTypes.CreateTaxTokenParams memory p;
        p.name = "HexPit Game"; p.symbol = "GAME"; p.meta = metadata; p.salt = salt;
        p.quoteToken = USD; p.totalSupply = 2 * RESERVE; p.poolToken = RESERVE; p.poolQuote = TARGET;
        p.buyTaxRate = 100; p.sellTaxRate = 100; p.taxDuration = 30 days; p.antiFarmerDuration = 1 days;
        p.feeConfigs = new IPortalTypes.FeeConfig[](1);
        p.feeConfigs[0] = IPortalTypes.FeeConfig(IPortalTypes.FeeSlotType.LP_BPS, 10000, "");
        (p.extensionID, p.extensionData) = LaunchExtensionHelper.encodeCreator(creator);
        Distribution memory dist = Distribution(DistributionTarget.EXPLICIT, address(this), uint128(RESERVE), "");
        IPortalTypes.CreatorBuyParams memory buy;
        USD.safeApprove(PORTAL, TARGET);
        distributing = true;
        (address created, address pair) = IPortal(PORTAL).launchTaxTokenV2(p, dist, buy);
        require(created == token && pair != address(0) && !distributing, "distribution incomplete");
        pool = pair;
        emit PoolOpened(token, pool);
    }

    function initializeDistribution(address asset, uint256 amount, bytes calldata, bytes32) external onlyHub {
        require(distributing && asset != address(0) && amount == RESERVE, "unexpected distribution");
        distributing = false;
        token = asset;
        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit FlapDistributionInitialized(asset, amount);
    }

    function claim() external nonReentrant {
        uint256 amount = allocation[msg.sender];
        require(pool != address(0) && amount > 0, "no vested claim");
        allocation[msg.sender] = 0;
        token.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    function refund() external nonReentrant {
        uint256 amount = paid[msg.sender];
        require(block.timestamp >= deadline && pool == address(0) && amount > 0, "refund unavailable");
        paid[msg.sender] = 0;
        allocation[msg.sender] = 0;
        USD.safeTransfer(msg.sender, amount);
        emit Refunded(msg.sender, amount);
    }
    function _useBeforeTokenTransfer() internal pure override returns (bool) { return true; }
    function _beforeTokenTransfer(address from, address, uint256[] memory, uint256[] memory, bytes memory)
        internal view override {
        require(from == address(0) || pool != address(0), "cards locked until launch");
    }
}
