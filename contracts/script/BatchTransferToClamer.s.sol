// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

interface IERC721 {
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IBatchTransfer {
    function batchTransfer(
        address nftContract,
        address from,
        address to,
        uint256[] calldata tokenIds
    ) external;
}

/**
 * @title BatchTransferToClaimer
 * @notice Transfers 66 After Patmos NFTs to the Claimer contract (keeping #46)
 * @dev Run with: forge script script/BatchTransferToClamer.s.sol:BatchTransferToClaimer --rpc-url $RPC_URL --broadcast
 */
contract BatchTransferToClaimer is Script {
    // Contract addresses
    address constant NFT_CONTRACT = 0x83e2654994264333e6FdfE2E43eb862866746041;
    address constant CLAIMER_CONTRACT = 0x83FB8FF0eAB0f036c4b3dC301483D571C5573a07;
    address constant TREASURY = 0x764D2F2e65153A08C5509235334B08Be2ae02915;

    // Token IDs to transfer (66 tokens, excluding #46)
    function getTokenIds() internal pure returns (uint256[] memory) {
        uint256[] memory tokenIds = new uint256[](66);

        // All tokens except #46
        tokenIds[0] = 3;
        tokenIds[1] = 4;
        tokenIds[2] = 5;
        tokenIds[3] = 7;
        tokenIds[4] = 9;
        tokenIds[5] = 10;
        tokenIds[6] = 14;
        tokenIds[7] = 17;
        tokenIds[8] = 18;
        tokenIds[9] = 19;
        tokenIds[10] = 20;
        tokenIds[11] = 23;
        tokenIds[12] = 24;
        tokenIds[13] = 25;
        tokenIds[14] = 26;
        tokenIds[15] = 28;
        tokenIds[16] = 29;
        tokenIds[17] = 30;
        tokenIds[18] = 32;
        tokenIds[19] = 33;
        tokenIds[20] = 34;
        tokenIds[21] = 36;
        tokenIds[22] = 38;
        tokenIds[23] = 39;
        tokenIds[24] = 40;
        tokenIds[25] = 41;
        tokenIds[26] = 42;
        tokenIds[27] = 43;
        tokenIds[28] = 47;
        tokenIds[29] = 48;
        tokenIds[30] = 49;
        tokenIds[31] = 50;
        tokenIds[32] = 52;
        tokenIds[33] = 55;
        tokenIds[34] = 56;
        tokenIds[35] = 57;
        tokenIds[36] = 62;
        tokenIds[37] = 63;
        tokenIds[38] = 64;
        tokenIds[39] = 65;
        tokenIds[40] = 66;
        tokenIds[41] = 67;
        tokenIds[42] = 68;
        tokenIds[43] = 69;
        tokenIds[44] = 70;
        tokenIds[45] = 71;
        tokenIds[46] = 72;
        tokenIds[47] = 73;
        tokenIds[48] = 74;
        tokenIds[49] = 75;
        tokenIds[50] = 76;
        tokenIds[51] = 78;
        tokenIds[52] = 80;
        tokenIds[53] = 82;
        tokenIds[54] = 84;
        tokenIds[55] = 85;
        tokenIds[56] = 86;
        tokenIds[57] = 87;
        tokenIds[58] = 88;
        tokenIds[59] = 89;
        tokenIds[60] = 90;
        tokenIds[61] = 94;
        tokenIds[62] = 95;
        tokenIds[63] = 96;
        tokenIds[64] = 97;
        tokenIds[65] = 98;

        return tokenIds;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("==============================================");
        console.log("After Patmos Batch Transfer to Claimer");
        console.log("==============================================");
        console.log("NFT Contract:", NFT_CONTRACT);
        console.log("Claimer Contract:", CLAIMER_CONTRACT);
        console.log("Treasury (From):", TREASURY);
        console.log("");

        uint256[] memory tokenIds = getTokenIds();
        console.log("Transferring", tokenIds.length, "NFTs");
        console.log("Keeping #46 in treasury");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        IERC721 nft = IERC721(NFT_CONTRACT);

        // Transfer each NFT
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            // Verify ownership
            address owner = nft.ownerOf(tokenId);
            if (owner != TREASURY) {
                console.log("Skipping #", tokenId, "- not owned by treasury");
                continue;
            }

            // Transfer
            nft.safeTransferFrom(TREASURY, CLAIMER_CONTRACT, tokenId);

            if (i % 10 == 0) {
                console.log("Transferred", i + 1, "/", tokenIds.length);
            }
        }

        vm.stopBroadcast();

        console.log("");
        console.log("==============================================");
        console.log("Transfer complete!");
        console.log("==============================================");
    }
}
