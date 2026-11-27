// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PackFixture, IFaucetUSD} from "./PackLauncher.t.sol";
import {ClosingTable} from "../src/ClosingTable.sol";
import {IPortal} from "flap/IPortal.sol";

contract ClosingTableTest is PackFixture {
    ClosingTable table;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public override {
        super.setUp();
        table = new ClosingTable(address(factory));
        _fund(alice);
        _fund(bob);
    }

    function _fund(address buyer) internal {
        usd.mint(buyer, 5 ether);
        vm.prank(buyer);
        usd.approve(address(table), 5 ether);
    }

    function _solo(uint256 count) internal {
        vm.prank(player);
        round.mintPacks(count, 0);
    }

    function _sit(address buyer, uint256 quote) internal {
        vm.prank(buyer);
        table.join(round, quote);
    }

    function testLastTwoShareThePoolAndCanClaimIndependently() public {
        _solo(10);
        uint256 remaining = round.cumulative(12) - round.cumulative(10);
        _sit(alice, 10);
        assertEq(round.sold(), 10);
        assertEq(usd.balanceOf(address(table)), 5 ether);
        assertEq(usd.balanceOf(address(round)), 50 ether);
        _sit(bob, 10);
        assertEq(usd.balanceOf(round.pool()), 60 ether);
        assertEq(usd.balanceOf(address(table)), 0);
        assertEq(table.claimable(round, alice), remaining / 2);
        assertEq(table.claimable(round, bob), remaining - remaining / 2);
        // A recipient that cannot accept ERC-1155 cards can retry to another address.
        vm.prank(alice);
        vm.expectRevert();
        table.claim(round, address(usd));
        assertEq(table.claimable(round, alice), remaining / 2);
        vm.prank(bob);
        table.claim(round, bob);
        vm.prank(alice);
        table.claim(round, alice);
        assertEq(IFaucetUSD(round.token()).balanceOf(bob), remaining - remaining / 2);
        assertEq(IFaucetUSD(round.token()).balanceOf(alice), remaining / 2);
        assertEq(IFaucetUSD(round.token()).balanceOf(address(table)), 0);
        uint256 cardsA;
        uint256 cardsB;
        for (uint256 id = 1; id <= 117; ++id) {
            cardsA += round.balanceOf(alice, id);
            cardsB += round.balanceOf(bob, id);
        }
        assertEq(cardsA, 5);
        assertEq(cardsB, 5);
        vm.prank(alice);
        vm.expectRevert();
        table.claim(round, alice);
    }

    function testTwelvePledgesCanFundWholeRound() public {
        uint256 total;
        uint256 reward = round.cumulative(12);
        address[12] memory players;
        for (uint256 i; i < 12; ++i) {
            players[i] = address(uint160(1000 + i));
            _fund(players[i]);
            _sit(players[i], 0);
        }
        for (uint256 i; i < 12; ++i) {
            uint256 share = table.claimable(round, players[i]);
            assertApproxEqAbs(share, reward / 12, 1);
            total += share;
            assertEq(table.seatOf(round, players[i]).position, i + 1);
        }
        assertEq(total, reward);
        assertEq(usd.balanceOf(round.pool()), 60 ether);
    }

    function testLeaveAndReleaseAfterSoloMintOrExpiry() public {
        _sit(alice, 0);
        vm.prank(alice);
        vm.expectRevert();
        table.join(round, 0);
        _sit(bob, 0);
        vm.prank(alice);
        table.leave(round);
        assertEq(usd.balanceOf(alice), 5 ether);
        assertEq(table.seatOf(round, bob).position, 1);
        _solo(1);
        vm.prank(alice);
        vm.expectRevert();
        table.join(round, 0);
        table.release(round);
        assertEq(usd.balanceOf(bob), 5 ether);
        assertEq(round.sold(), 1);
        vm.prank(alice);
        usd.approve(address(table), 5 ether);
        _sit(alice, 1);
        vm.warp(round.deadline());
        table.release(round);
        assertEq(usd.balanceOf(alice), 5 ether);
        assertEq(usd.balanceOf(address(table)), 0);
    }

    function testUnavailablePoolLeavesWaitingPledgesRefundable() public {
        _solo(10);
        _sit(alice, 10);
        vm.mockCallRevert(address(portal), abi.encodeWithSelector(IPortal.launchTaxTokenV2.selector), bytes("unavailable"));
        vm.prank(bob);
        vm.expectRevert();
        table.join(round, 10);
        assertEq(usd.balanceOf(bob), 5 ether);
        assertEq(usd.balanceOf(address(table)), 5 ether);
        assertEq(round.sold(), 10);
        vm.prank(alice);
        table.leave(round);
        assertEq(usd.balanceOf(alice), 5 ether);
    }
}
