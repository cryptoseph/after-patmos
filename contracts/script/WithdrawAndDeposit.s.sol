// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

interface IAfterPatmosClaimer {
    function withdrawNFTs(uint256[] calldata tokenIds, address to) external;
    function getAvailableTokens() external view returns (uint256[] memory);
}

contract WithdrawAndDepositScript is Script {
    address constant OLD_CLAIMER = 0xB0BF498288dff665e3129f63E1d010F9297205f1;
    address constant NEW_CLAIMER = 0x83FB8FF0eAB0f036c4b3dC301483D571C5573a07;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Get available tokens from old contract
        uint256[] memory availableTokens = IAfterPatmosClaimer(OLD_CLAIMER).getAvailableTokens();
        console.log("Found", availableTokens.length, "tokens to migrate");

        vm.startBroadcast(deployerPrivateKey);

        // Withdraw all NFTs from old contract and send to new contract
        IAfterPatmosClaimer(OLD_CLAIMER).withdrawNFTs(availableTokens, NEW_CLAIMER);

        console.log("All NFTs transferred from old claimer to new claimer");

        vm.stopBroadcast();
    }
}
