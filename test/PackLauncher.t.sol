// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {Test} from "forge-std/Test.sol";
import {PackFactory} from "../src/PackFactory.sol";
import {PackLauncher} from "../src/PackLauncher.sol";
import {IPortal} from "flap/IPortal.sol";
interface IFaucetUSD {
    function mint(address,uint256) external;
    function approve(address,uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}
interface ITestnetHelper { function whitelist(address,uint16) external; }
abstract contract PackFixture is Test {
    IPortal constant portal=IPortal(0x000042108465206185A077Edc3F3fd2b49060000);
    IFaucetUSD constant usd=IFaucetUSD(0x190C989D5665a0e404B444b53CAE9AbCfb600157);
    address player=makeAddr("founder");
    PackLauncher round;
    PackFactory factory;
    function setUp() public virtual {
        string memory rpc = vm.envOr("BSC_TESTNET_RPC_URL", string("https://bsc-testnet-rpc.publicnode.com"));
        uint256 blockNumber = vm.envOr("BSC_TESTNET_FORK_BLOCK", uint256(0));
        if (blockNumber == 0) vm.createSelectFork(rpc);
        else vm.createSelectFork(rpc, blockNumber);
        factory=new PackFactory();
        ITestnetHelper(0x77779969a11eff7582f3bCf48135A846A3457777).whitelist(address(factory),100);
        bytes32 salt=0x000000000000000000000000397c78d9f311bbfa1def15d7e03b0ff12e8e5725;
        vm.deal(address(this),1 ether);
        bytes memory config=abi.encode(PackFactory.Round(salt,"https://eoc-gold.github.io/hexpit-flap-launch/game.json"));
        round=PackLauncher(portal.newLauncher{value:portal.SALT_LOCK_FEE()}(address(factory),config));
        usd.mint(player,60 ether);
        vm.prank(player);usd.approve(address(round),60 ether);
    }
}

contract PackLauncherTest is PackFixture {
    function testExpiredRoundRefundsOnceAndInvalidatesGame() public {
        vm.startPrank(player);
        round.mintPacks(2,round.cumulative(2));
        vm.expectRevert();round.refund();
        vm.warp(round.deadline());
        round.refund();
        assertEq(usd.balanceOf(player),60 ether);assertEq(round.allocation(player),0);
        vm.expectRevert();round.refund();
        vm.expectRevert();round.mintPacks(1,0);
        vm.expectRevert();round.claim();
    }
    function testStaleQuoteAndOverfillPreserveWalletBalance() public {
        uint256 first=round.cumulative(1);
        vm.startPrank(player);
        round.mintPacks(1,first);
        vm.expectRevert();round.mintPacks(1,first);
        vm.expectRevert();round.mintPacks(12,0);
        assertEq(round.sold(),1);assertEq(usd.balanceOf(player),55 ether);
    }
    function testClaimAndCardTransferRules() public {
        vm.startPrank(player);
        round.mintPacks(1,0);
        uint256 card;
        for(uint256 i=1;i<=117;++i) if(round.balanceOf(player,i)>0){card=i;break;}
        assertGt(card,0);
        vm.expectRevert();round.safeTransferFrom(player,address(42),card,1,"");
        vm.expectRevert();round.claim();
        round.mintPacks(11,0);
        round.safeTransferFrom(player,address(42),card,1,"");
        assertEq(round.allocation(address(42)),0);
        round.claim();assertEq(IFaucetUSD(round.token()).balanceOf(player),500000 ether);
        vm.expectRevert();round.claim();
        vm.expectRevert();round.refund();
    }
}
