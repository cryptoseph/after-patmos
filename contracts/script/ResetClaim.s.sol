// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

interface IAfterPatmosClaimer {
    function resetClaimStatus(address user) external;
    function hasClaimed(address user) external view returns (bool);
}

contract ResetClaimScript is Script {
    address constant NEW_CLAIMER = 0xB0BF498288dff665e3129f63E1d010F9297205f1;
    address constant USER_TO_RESET = 0x764D2F2e65153A08C5509235334B08Be2ae02915;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Check current status
        bool hasClaimed = IAfterPatmosClaimer(NEW_CLAIMER).hasClaimed(USER_TO_RESET);
        console.log("Has claimed before reset:", hasClaimed);

        vm.startBroadcast(deployerPrivateKey);

        IAfterPatmosClaimer(NEW_CLAIMER).resetClaimStatus(USER_TO_RESET);

        vm.stopBroadcast();

        console.log("Claim status reset for:", USER_TO_RESET);
    }
}
