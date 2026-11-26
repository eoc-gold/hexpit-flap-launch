// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// IDs correspond to web/catalog.json, sorted by rarity and canonical card slug.
library CardCatalog {
    uint256 internal constant COUNT = 117;
    function draw(bytes32 seed) internal pure returns (uint256[] memory ids) {
        ids = new uint256[](5);
        for (uint256 i; i < 5; ++i) {
            uint256 roll = uint256(keccak256(abi.encode(seed, i, "rarity"))) % 100;
            uint256 offset;
            uint256 size;
            if (roll == 99) { offset = 102; size = 15; }
            else if (roll >= (i == 4 ? 85 : 93)) { offset = 74; size = 28; }
            else if (i == 4 || roll >= 70) { offset = 46; size = 28; }
            else { size = 46; }
            ids[i] = 1 + offset + uint256(keccak256(abi.encode(seed, i, "card"))) % size;
        }
    }
}
