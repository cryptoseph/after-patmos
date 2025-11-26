// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AfterPatmosClaimer.sol";

contract DeployScript is Script {
    // After Patmos NFT Contract on Mainnet
    address constant NFT_CONTRACT = 0x83e2654994264333e6FdfE2E43eb862866746041;

    function run() external {
        // Get the signer address from environment variable
        address signer = vm.envAddress("SIGNER_ADDRESS");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        AfterPatmosClaimer claimer = new AfterPatmosClaimer(
            NFT_CONTRACT,
            signer
        );

        console.log("AfterPatmosClaimer deployed to:", address(claimer));
        console.log("NFT Contract:", NFT_CONTRACT);
        console.log("Signer:", signer);

        vm.stopBroadcast();
    }
}
