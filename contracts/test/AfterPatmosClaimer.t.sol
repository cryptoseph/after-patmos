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

    event NFTClaimed(
        address indexed claimer,
        uint256 indexed tokenId,
        string observation,
        uint256 timestamp
    );

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
        // Mint NFTs to owner (must be 1-100 range for bitmap)
        vm.startPrank(owner);
        nft.mintSpecific(owner, 1);
        nft.mintSpecific(owner, 2);

        // Approve claimer
        nft.setApprovalForAll(address(claimer), true);

        // Deposit
        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        claimer.depositNFTs(tokenIds);
        vm.stopPrank();

        // Verify
        assertEq(nft.ownerOf(1), address(claimer));
        assertEq(nft.ownerOf(2), address(claimer));
        assertEq(claimer.availableCount(), 2);
        assertTrue(claimer.isTokenAvailable(1));
        assertTrue(claimer.isTokenAvailable(2));
    }

    function testBitmapTracking() public {
        // Setup: deposit multiple NFTs to test bitmap
        vm.startPrank(owner);
        for (uint256 i = 1; i <= 10; i++) {
            nft.mintSpecific(owner, i);
        }
        nft.setApprovalForAll(address(claimer), true);

        uint256[] memory tokenIds = new uint256[](10);
        for (uint256 i = 0; i < 10; i++) {
            tokenIds[i] = i + 1;
        }
        claimer.depositNFTs(tokenIds);
        vm.stopPrank();

        // Check deposited bitmap
        uint256 depositedBitmap = claimer.getDepositedBitmap();
        // First 10 bits should be set: 0b1111111111 = 1023
        assertEq(depositedBitmap, 1023);

        // Check claimed bitmap is 0
        assertEq(claimer.getClaimedBitmap(), 0);

        // All tokens should be available
        uint256[] memory available = claimer.getAvailableTokens();
        assertEq(available.length, 10);
    }

    function testClaimNFT() public {
        // Setup: deposit an NFT (must be in 1-100 range)
        uint256 tokenId = 1;
        vm.startPrank(owner);
        nft.mintSpecific(owner, tokenId);
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

        // Expect the NFTClaimed event
        vm.expectEmit(true, true, false, true);
        emit NFTClaimed(user1, tokenId, observation, block.timestamp);

        // Claim
        vm.prank(user1);
        claimer.claimNFT(tokenId, observation, signature);

        // Verify
        assertEq(nft.ownerOf(tokenId), user1);
        assertTrue(claimer.hasClaimed(user1));
        assertEq(claimer.availableCount(), 0);
        assertFalse(claimer.isTokenAvailable(tokenId));

        // Check claimed bitmap has bit 0 set (for token 1)
        assertEq(claimer.getClaimedBitmap(), 1);
    }

    function testRelayClaimNFT() public {
        // Setup: deposit an NFT
        uint256 tokenId = 5;
        vm.startPrank(owner);
        nft.mintSpecific(owner, tokenId);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        claimer.depositNFTs(tokenIds);
        vm.stopPrank();

        string memory observation = "Relayed claim observation";

        // Only signer can relay
        vm.prank(signer);
        claimer.relayClaimNFT(user1, tokenId, observation);

        // Verify
        assertEq(nft.ownerOf(tokenId), user1);
        assertTrue(claimer.hasClaimed(user1));
        assertFalse(claimer.isTokenAvailable(tokenId));

        // Check claimed bitmap has bit 4 set (for token 5)
        assertEq(claimer.getClaimedBitmap(), 16); // 2^4 = 16
    }

    function testCannotRelayIfNotSigner() public {
        // Setup
        uint256 tokenId = 1;
        vm.startPrank(owner);
        nft.mintSpecific(owner, tokenId);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        claimer.depositNFTs(tokenIds);
        vm.stopPrank();

        // Non-signer tries to relay
        vm.prank(user1);
        vm.expectRevert("Only signer can relay");
        claimer.relayClaimNFT(user2, tokenId, "Test observation");
    }

    function testCannotClaimTwice() public {
        // Setup: deposit NFTs
        vm.startPrank(owner);
        nft.mintSpecific(owner, 1);
        nft.mintSpecific(owner, 2);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        claimer.depositNFTs(tokenIds);
        vm.stopPrank();

        // First claim
        bytes memory signature1 = _signClaim(user1, 1, "First observation");
        vm.prank(user1);
        claimer.claimNFT(1, "First observation", signature1);

        // Try to claim again
        bytes memory signature2 = _signClaim(user1, 2, "Second observation");
        vm.prank(user1);
        vm.expectRevert(AfterPatmosClaimer.AlreadyClaimed.selector);
        claimer.claimNFT(2, "Second observation", signature2);
    }

    function testCannotClaimSameTokenTwice() public {
        // Setup
        uint256 tokenId = 1;
        vm.startPrank(owner);
        nft.mintSpecific(owner, tokenId);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        claimer.depositNFTs(tokenIds);
        vm.stopPrank();

        // First user claims
        bytes memory sig1 = _signClaim(user1, tokenId, "Observation 1");
        vm.prank(user1);
        claimer.claimNFT(tokenId, "Observation 1", sig1);

        // Reset user1's claim status
        vm.prank(owner);
        claimer.resetClaimStatus(user1);

        // User1 tries to claim same token again
        bytes memory sig2 = _signClaim(user1, tokenId, "Observation 2");
        vm.prank(user1);
        vm.expectRevert(AfterPatmosClaimer.TokenNotAvailable.selector);
        claimer.claimNFT(tokenId, "Observation 2", sig2);
    }

    function _signClaim(address claimer_, uint256 tokenId, string memory observation) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(abi.encodePacked(claimer_, tokenId, observation));
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    function testInvalidSignature() public {
        // Setup
        uint256 tokenId = 1;
        vm.startPrank(owner);
        nft.mintSpecific(owner, tokenId);
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
        uint256 tokenId = 1;
        vm.startPrank(owner);
        nft.mintSpecific(owner, tokenId);
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

    function testInvalidTokenId() public {
        // Try to deposit token 0 (invalid)
        vm.startPrank(owner);
        nft.mintSpecific(owner, 101); // Out of range
        nft.setApprovalForAll(address(claimer), true);

        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 101;

        vm.expectRevert(AfterPatmosClaimer.InvalidTokenId.selector);
        claimer.depositNFTs(tokenIds);
        vm.stopPrank();
    }

    function testWithdrawNFTs() public {
        // Setup
        uint256 tokenId = 1;
        vm.startPrank(owner);
        nft.mintSpecific(owner, tokenId);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        claimer.depositNFTs(tokenIds);

        // Verify deposited
        assertTrue(claimer.isTokenAvailable(tokenId));

        // Withdraw
        claimer.withdrawNFTs(tokenIds, owner);
        vm.stopPrank();

        assertEq(nft.ownerOf(tokenId), owner);
        assertEq(claimer.availableCount(), 0);
        assertFalse(claimer.isTokenAvailable(tokenId));

        // Deposited bitmap should be cleared
        assertEq(claimer.getDepositedBitmap(), 0);
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
        uint256 tokenId = 1;
        vm.startPrank(owner);
        nft.mintSpecific(owner, tokenId);
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

    function testETHDeposit() public {
        // Send ETH to contract
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        (bool success,) = address(claimer).call{value: 0.5 ether}("");
        assertTrue(success);

        assertEq(claimer.getETHBalance(), 0.5 ether);
    }

    function testETHWithdraw() public {
        // Fund contract
        vm.deal(address(claimer), 1 ether);

        uint256 ownerBalanceBefore = owner.balance;

        vm.prank(owner);
        claimer.withdrawETH(0.5 ether);

        assertEq(owner.balance - ownerBalanceBefore, 0.5 ether);
        assertEq(claimer.getETHBalance(), 0.5 ether);
    }

    function testOnERC721Received() public {
        // Test that safeTransferFrom auto-deposits
        uint256 tokenId = 42;
        vm.startPrank(owner);
        nft.mintSpecific(owner, tokenId);

        // Safe transfer to claimer
        nft.safeTransferFrom(owner, address(claimer), tokenId);
        vm.stopPrank();

        // Should be marked as deposited
        assertTrue(claimer.isTokenAvailable(tokenId));
        assertEq(nft.ownerOf(tokenId), address(claimer));
    }

    function testGetAvailableTokens() public {
        // Setup multiple tokens
        vm.startPrank(owner);
        for (uint256 i = 1; i <= 5; i++) {
            nft.mintSpecific(owner, i);
        }
        nft.setApprovalForAll(address(claimer), true);

        uint256[] memory tokenIds = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            tokenIds[i] = i + 1;
        }
        claimer.depositNFTs(tokenIds);
        vm.stopPrank();

        // Claim token 3
        bytes memory sig = _signClaim(user1, 3, "Claiming token 3");
        vm.prank(user1);
        claimer.claimNFT(3, "Claiming token 3", sig);

        // Get available should return 4 tokens (1, 2, 4, 5)
        uint256[] memory available = claimer.getAvailableTokens();
        assertEq(available.length, 4);

        // Verify token 3 is not in the list
        for (uint256 i = 0; i < available.length; i++) {
            assertTrue(available[i] != 3);
        }
    }

    // ============ Pausable Tests ============

    function testPauseUnpause() public {
        // Initially not paused
        assertFalse(claimer.isPaused());

        // Owner can pause
        vm.prank(owner);
        claimer.pause();
        assertTrue(claimer.isPaused());

        // Owner can unpause
        vm.prank(owner);
        claimer.unpause();
        assertFalse(claimer.isPaused());
    }

    function testOnlyOwnerCanPause() public {
        vm.prank(user1);
        vm.expectRevert();
        claimer.pause();
    }

    function testOnlyOwnerCanUnpause() public {
        vm.prank(owner);
        claimer.pause();

        vm.prank(user1);
        vm.expectRevert();
        claimer.unpause();
    }

    function testCannotClaimWhenPaused() public {
        // Setup
        uint256 tokenId = 1;
        vm.startPrank(owner);
        nft.mintSpecific(owner, tokenId);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        claimer.depositNFTs(tokenIds);

        // Pause
        claimer.pause();
        vm.stopPrank();

        // Try to claim
        bytes memory sig = _signClaim(user1, tokenId, "Test observation");
        vm.prank(user1);
        vm.expectRevert(); // EnforcedPause error
        claimer.claimNFT(tokenId, "Test observation", sig);
    }

    function testCannotRelayClaimWhenPaused() public {
        // Setup
        uint256 tokenId = 1;
        vm.startPrank(owner);
        nft.mintSpecific(owner, tokenId);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        claimer.depositNFTs(tokenIds);

        // Pause
        claimer.pause();
        vm.stopPrank();

        // Try to relay claim
        vm.prank(signer);
        vm.expectRevert(); // EnforcedPause error
        claimer.relayClaimNFT(user1, tokenId, "Test observation");
    }

    function testCanClaimAfterUnpause() public {
        // Setup
        uint256 tokenId = 1;
        vm.startPrank(owner);
        nft.mintSpecific(owner, tokenId);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        claimer.depositNFTs(tokenIds);

        // Pause then unpause
        claimer.pause();
        claimer.unpause();
        vm.stopPrank();

        // Should be able to claim now
        bytes memory sig = _signClaim(user1, tokenId, "Test observation");
        vm.prank(user1);
        claimer.claimNFT(tokenId, "Test observation", sig);

        assertEq(nft.ownerOf(tokenId), user1);
    }

    function testEmergencyWithdrawAll() public {
        // Setup: deposit multiple NFTs
        vm.startPrank(owner);
        for (uint256 i = 1; i <= 5; i++) {
            nft.mintSpecific(owner, i);
        }
        nft.setApprovalForAll(address(claimer), true);

        uint256[] memory tokenIds = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            tokenIds[i] = i + 1;
        }
        claimer.depositNFTs(tokenIds);

        // Claim one token first
        vm.stopPrank();
        bytes memory sig = _signClaim(user1, 3, "Claiming token 3");
        vm.prank(user1);
        claimer.claimNFT(3, "Claiming token 3", sig);

        // Now pause and emergency withdraw
        vm.startPrank(owner);
        claimer.pause();
        claimer.emergencyWithdrawAll(owner);
        vm.stopPrank();

        // Tokens 1, 2, 4, 5 should be back with owner
        assertEq(nft.ownerOf(1), owner);
        assertEq(nft.ownerOf(2), owner);
        assertEq(nft.ownerOf(4), owner);
        assertEq(nft.ownerOf(5), owner);

        // Token 3 should still be with user1 (was claimed)
        assertEq(nft.ownerOf(3), user1);

        // Available count should be 0
        assertEq(claimer.availableCount(), 0);
    }

    function testEmergencyWithdrawRequiresPause() public {
        // Setup
        vm.startPrank(owner);
        nft.mintSpecific(owner, 1);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 1;
        claimer.depositNFTs(tokenIds);

        // Try emergency withdraw without pausing
        vm.expectRevert(); // ExpectedPause error
        claimer.emergencyWithdrawAll(owner);
        vm.stopPrank();
    }

    function testSetSignerRejectsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("Invalid signer address");
        claimer.setSigner(address(0));
    }

    function testWithdrawNFTsRejectsZeroAddress() public {
        vm.startPrank(owner);
        nft.mintSpecific(owner, 1);
        nft.setApprovalForAll(address(claimer), true);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 1;
        claimer.depositNFTs(tokenIds);

        vm.expectRevert("Invalid recipient");
        claimer.withdrawNFTs(tokenIds, address(0));
        vm.stopPrank();
    }
}
