// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

interface IAfterPatmosClaimer {
    function withdrawNFTs(uint256[] calldata tokenIds, address to) external;
}

contract WithdrawAndDepositScript is Script {
    address constant OLD_CLAIMER = 0x8D69c9F6F2f903fDa282c9DE46c4D315174dD080;
    address constant NEW_CLAIMER = 0xB0BF498288dff665e3129f63E1d010F9297205f1;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Withdraw NFT #2 from old contract and send to new contract
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 2;

        IAfterPatmosClaimer(OLD_CLAIMER).withdrawNFTs(tokenIds, NEW_CLAIMER);

        console.log("NFT #2 transferred from old claimer to new claimer");

        vm.stopBroadcast();
    }
}
