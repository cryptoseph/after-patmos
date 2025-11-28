// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AfterPatmosClaimer.sol";

interface IOldClaimer {
    function withdrawNFTs(uint256[] calldata tokenIds, address to) external;
    function getAvailableTokens() external view returns (uint256[] memory);
    function getClaimedBitmap() external view returns (uint256);
    function getDepositedBitmap() external view returns (uint256);
    function hasClaimed(address user) external view returns (bool);
}

/**
 * @title MigrateToV2
 * @notice Comprehensive migration script for AfterPatmosClaimer V2
 *
 * This script performs the following steps:
 * 1. Deploy new claimer contract with observation tracking
 * 2. Withdraw all NFTs from old claimer
 * 3. Transfer NFTs to new claimer (triggers auto-deposit via onERC721Received)
 * 4. Migrate hasClaimed status for existing claimers
 * 5. Migrate claimed bitmap
 * 6. Migrate observation bitmap for existing observations
 *
 * Run with:
 *   source backend/.env && forge script script/MigrateToV2.s.sol --rpc-url $RPC_URL --broadcast -vvvv
 */
contract MigrateToV2Script is Script {
    // After Patmos NFT Contract on Mainnet
    address constant NFT_CONTRACT = 0x83e2654994264333e6FdfE2E43eb862866746041;

    // Old Claimer Contract
    address constant OLD_CLAIMER = 0x83FB8FF0eAB0f036c4b3dC301483D571C5573a07;

    // Signer address (same as owner - backend relay wallet)
    address constant SIGNER = 0x764D2F2e65153A08C5509235334B08Be2ae02915;

    // Addresses that have already claimed (from old contract)
    address constant CLAIMER_1 = 0xFE8e30fbA9A80341875C7b33AffD4D8CB70487DF; // Claimed token 65
    address constant CLAIMER_2 = 0x764D2F2e65153A08C5509235334B08Be2ae02915; // Claimed token 52

    // Claimed bitmap from old contract: tokens 52 and 65
    // Token 52: bit 51 (52-1) = 0x0008000000000000
    // Token 65: bit 64 (65-1) = 0x10000000000000000
    // Combined: 0x10008000000000000
    uint256 constant CLAIMED_BITMAP = 0x10008000000000000;

    // Observation bitmap: same as claimed bitmap since both claimed tokens have observations
    uint256 constant OBSERVATION_BITMAP = 0x10008000000000000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("=== AfterPatmosClaimer V2 Migration ===");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy new claimer
        console.log("Step 1: Deploying new claimer...");
        AfterPatmosClaimer newClaimer = new AfterPatmosClaimer(
            NFT_CONTRACT,
            SIGNER
        );
        console.log("New Claimer deployed to:", address(newClaimer));
        console.log("");

        // Step 2: Get available tokens from old claimer
        console.log("Step 2: Getting available tokens from old claimer...");
        IOldClaimer oldClaimer = IOldClaimer(OLD_CLAIMER);
        uint256[] memory availableTokens = oldClaimer.getAvailableTokens();
        console.log("Found", availableTokens.length, "available tokens");

        // Step 3: Withdraw NFTs from old claimer to deployer
        console.log("Step 3: Withdrawing NFTs from old claimer...");
        oldClaimer.withdrawNFTs(availableTokens, vm.addr(deployerPrivateKey));
        console.log("Withdrawn", availableTokens.length, "NFTs to deployer");
        console.log("");

        // Step 4: Approve new claimer to transfer NFTs
        console.log("Step 4: Approving new claimer for NFT transfers...");
        IERC721 nft = IERC721(NFT_CONTRACT);
        nft.setApprovalForAll(address(newClaimer), true);
        console.log("Approved new claimer for all NFTs");
        console.log("");

        // Step 5: Deposit NFTs to new claimer
        console.log("Step 5: Depositing NFTs to new claimer...");
        newClaimer.depositNFTs(availableTokens);
        console.log("Deposited", availableTokens.length, "NFTs to new claimer");
        console.log("");

        // Step 6: Migrate hasClaimed status
        console.log("Step 6: Migrating hasClaimed status...");
        address[] memory claimers = new address[](2);
        claimers[0] = CLAIMER_1;
        claimers[1] = CLAIMER_2;
        newClaimer.migrateClaimStatus(claimers);
        console.log("Migrated hasClaimed for 2 addresses");
        console.log("");

        // Step 7: Migrate claimed bitmap
        console.log("Step 7: Migrating claimed bitmap...");
        newClaimer.migrateClaimedBitmap(CLAIMED_BITMAP);
        console.log("Set claimed bitmap:", CLAIMED_BITMAP);
        console.log("");

        // Step 8: Migrate observation bitmap
        console.log("Step 8: Migrating observation bitmap...");
        newClaimer.migrateObservationBitmap(OBSERVATION_BITMAP);
        console.log("Set observation bitmap:", OBSERVATION_BITMAP);
        console.log("");

        // Step 9: Revoke approval (cleanup)
        console.log("Step 9: Revoking NFT approval (cleanup)...");
        nft.setApprovalForAll(address(newClaimer), false);
        console.log("Revoked approval");
        console.log("");

        vm.stopBroadcast();

        // Verification
        console.log("=== Migration Complete ===");
        console.log("New Claimer Address:", address(newClaimer));
        console.log("");
        console.log("UPDATE YOUR BACKEND .env:");
        console.log("CLAIMER_CONTRACT=", address(newClaimer));
        console.log("");
        console.log("Verify the following on Etherscan:");
        console.log("1. New claimer owns", availableTokens.length, "NFTs");
        console.log("2. hasClaimed(CLAIMER_1) = true");
        console.log("3. hasClaimed(CLAIMER_2) = true");
        console.log("4. getObservationCount() = 2");
        console.log("5. hasObservation(52) = true");
        console.log("6. hasObservation(65) = true");
    }
}
