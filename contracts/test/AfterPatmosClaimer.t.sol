// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AfterPatmosClaimer.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// Mock ERC721 for testing
contract MockNFT is ERC721 {
    uint256 private _tokenIdCounter;

    constructor() ERC721("MockNFT", "MNFT") {}

    function mint(address to) external returns (uint256) {
        uint256 tokenId = ++_tokenIdCounter;
        _mint(to, tokenId);
        return tokenId;
    }

    function mintSpecific(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}

contract AfterPatmosClaimerTest is Test {
    AfterPatmosClaimer public claimer;
    MockNFT public nft;

    address public owner = address(1);
    address public signer;
    uint256 public signerPrivateKey = 0x1234;
    address public user1 = address(3);
    address public user2 = address(4);

    function setUp() public {
        signer = vm.addr(signerPrivateKey);

        vm.startPrank(owner);
        nft = new MockNFT();
        claimer = new AfterPatmosClaimer(address(nft), signer);
        vm.stopPrank();
    }

    function testDeployment() public view {
        assertEq(address(claimer.nftContract()), address(nft));
        assertEq(claimer.signer(), signer);
        assertEq(claimer.owner(), owner);
    }

    function testDepositNFTs() public {
        // Mint NFTs to owner
        vm.startPrank(owner);
        uint256 tokenId1 = nft.mint(owner);
        uint256 tokenId2 = nft.mint(owner);

        // Approve claimer
        nft.setApprovalForAll(address(claimer), true);

        // Deposit
        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = tokenId1;
        tokenIds[1] = tokenId2;
        claimer.depositNFTs(tokenIds);
        vm.stopPrank();

        // Verify
        assertEq(nft.ownerOf(tokenId1), address(claimer));
        assertEq(nft.ownerOf(tokenId2), address(claimer));
        assertEq(claimer.availableCount(), 2);
        assertTrue(claimer.isTokenAvailable(tokenId1));
        assertTrue(claimer.isTokenAvailable(tokenId2));
    }

    function testClaimNFT() public {
        // Setup: deposit an NFT
        vm.startPrank(owner);
        uint256 tokenId = nft.mint(owner);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        claimer.depositNFTs(tokenIds);
        vm.stopPrank();

        // Create signature
        string memory observation = "I see the beauty of chaos in this piece";
        bytes32 messageHash = keccak256(
            abi.encodePacked(user1, tokenId, observation)
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Claim
        vm.prank(user1);
        claimer.claimNFT(tokenId, observation, signature);

        // Verify
        assertEq(nft.ownerOf(tokenId), user1);
        assertTrue(claimer.hasClaimed(user1));
        assertTrue(claimer.tokenClaimed(tokenId));
        assertEq(claimer.availableCount(), 0);

        (string memory storedObs, address observer) = claimer.getObservation(tokenId);
        assertEq(storedObs, observation);
        assertEq(observer, user1);
    }

    function testCannotClaimTwice() public {
        // Setup: deposit NFTs
        vm.startPrank(owner);
        uint256 tokenId1 = nft.mint(owner);
        uint256 tokenId2 = nft.mint(owner);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = tokenId1;
        tokenIds[1] = tokenId2;
        claimer.depositNFTs(tokenIds);
        vm.stopPrank();

        // First claim
        bytes memory signature1 = _signClaim(user1, tokenId1, "First observation");
        vm.prank(user1);
        claimer.claimNFT(tokenId1, "First observation", signature1);

        // Try to claim again
        bytes memory signature2 = _signClaim(user1, tokenId2, "Second observation");
        vm.prank(user1);
        vm.expectRevert(AfterPatmosClaimer.AlreadyClaimed.selector);
        claimer.claimNFT(tokenId2, "Second observation", signature2);
    }

    function _signClaim(address claimer_, uint256 tokenId, string memory observation) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(abi.encodePacked(claimer_, tokenId, observation));
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    function testInvalidSignature() public {
        // Setup
        vm.startPrank(owner);
        uint256 tokenId = nft.mint(owner);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        claimer.depositNFTs(tokenIds);
        vm.stopPrank();

        // Create invalid signature (wrong private key)
        uint256 wrongPrivateKey = 0x5678;
        string memory observation = "Test observation";
        bytes32 messageHash = keccak256(
            abi.encodePacked(user1, tokenId, observation)
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(user1);
        vm.expectRevert(AfterPatmosClaimer.InvalidSignature.selector);
        claimer.claimNFT(tokenId, observation, signature);
    }

    function testObservationTooShort() public {
        // Setup
        vm.startPrank(owner);
        uint256 tokenId = nft.mint(owner);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        claimer.depositNFTs(tokenIds);
        vm.stopPrank();

        // Create signature with empty observation
        string memory observation = "";
        bytes32 messageHash = keccak256(
            abi.encodePacked(user1, tokenId, observation)
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(user1);
        vm.expectRevert(AfterPatmosClaimer.ObservationTooShort.selector);
        claimer.claimNFT(tokenId, observation, signature);
    }

    function testWithdrawNFTs() public {
        // Setup
        vm.startPrank(owner);
        uint256 tokenId = nft.mint(owner);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        claimer.depositNFTs(tokenIds);

        // Withdraw
        claimer.withdrawNFTs(tokenIds, owner);
        vm.stopPrank();

        assertEq(nft.ownerOf(tokenId), owner);
        assertEq(claimer.availableCount(), 0);
    }

    function testSetSigner() public {
        address newSigner = address(99);

        vm.prank(owner);
        claimer.setSigner(newSigner);

        assertEq(claimer.signer(), newSigner);
    }

    function testOnlyOwnerCanSetSigner() public {
        address newSigner = address(99);

        vm.prank(user1);
        vm.expectRevert();
        claimer.setSigner(newSigner);
    }

    function testResetClaimStatus() public {
        // Setup and claim
        vm.startPrank(owner);
        uint256 tokenId = nft.mint(owner);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        claimer.depositNFTs(tokenIds);
        vm.stopPrank();

        string memory observation = "Test";
        bytes32 messageHash = keccak256(
            abi.encodePacked(user1, tokenId, observation)
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(user1);
        claimer.claimNFT(tokenId, observation, signature);

        assertTrue(claimer.hasClaimed(user1));

        // Reset
        vm.prank(owner);
        claimer.resetClaimStatus(user1);

        assertFalse(claimer.hasClaimed(user1));
    }
}
