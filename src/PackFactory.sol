// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {LauncherFactoryBase} from "flap/LauncherFactoryBase.sol";
import {FieldDescriptor, LauncherDataSchema} from "flap/IVaultSchemas.sol";
import {LibClone} from "solady/utils/LibClone.sol";
import {UpgradeableBeacon} from "solady/utils/UpgradeableBeacon.sol";
import {PackLauncher} from "./PackLauncher.sol";

contract PackFactory is LauncherFactoryBase {
    UpgradeableBeacon public immutable beacon;
    struct Round { bytes32 salt; string meta; }
    event RoundCreated(address indexed launcher, address indexed creator);
    constructor() {
        require(block.chainid == 97, "BSC testnet only");
        beacon = new UpgradeableBeacon(address(this), address(new PackLauncher()));
    }
    function _newLauncher(address creator, bytes calldata data) internal override returns (address launcher) {
        Round memory round = abi.decode(data, (Round));
        launcher = LibClone.deployDeterministicERC1967BeaconProxy(address(beacon), round.salt);
        PackLauncher(launcher).initialize{value: msg.value}(creator, round.salt, round.meta);
        emit RoundCreated(launcher, creator);
    }
    function upgradeVaultImplementation(address implementation) external override onlyGuardian {
        beacon.upgradeTo(implementation);
    }
    function launcherDataSchema() external pure override returns (LauncherDataSchema memory schema) {
        schema.description = "Twelve five-card packs at 5 faucet USD each. The final mint seeds the pool.";
        schema.fields = new FieldDescriptor[](2);
        schema.fields[0] = FieldDescriptor("salt", "bytes32", "Available salt for a 7777 token address", 0);
        schema.fields[1] = FieldDescriptor("meta", "string", "GAME metadata URI or CID", 0);
    }
}
