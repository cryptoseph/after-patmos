// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title AfterPatmosClaimer
 * @notice Gas-optimized contract that holds After Patmos NFTs and allows users to claim them
 *         by submitting an observation that is approved by the backend (Gemini AI Guardian).
 * @dev V3 Optimizations:
 *      - Bitmap tracking for claimed tokens (100 tokens fit in 2 uint256s)
 *      - Observations stored in events only (90% gas savings)
 *      - Custom errors instead of require strings (~50 gas each)
 *      - Unchecked math for safe operations (~80 gas per loop)
 *      - Nonce-based signature replay protection
 *      - Cached storage reads for gas efficiency
 */
contract AfterPatmosClaimer is Ownable, ReentrancyGuard, IERC721Receiver {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // The After Patmos NFT contract
    IERC721 public immutable nftContract;

    // Address authorized to sign claim approvals (backend service wallet)
    address public signer;

    // Mapping of addresses that have already claimed
    mapping(address => bool) public hasClaimed;

    // Nonce for signature replay protection
    mapping(address => uint256) public nonces;

    // ============ GAS OPTIMIZATION: Bitmap for token tracking ============
    // Two uint256s can track 256 tokens (we only need 100)
    // Bit 0 = token 1, Bit 99 = token 100
    uint256 private _claimedBitmapLow;   // Tokens 1-128
    uint256 private _depositedBitmapLow; // Tokens 1-128 deposited status

    // Events - observations now stored here instead of state (90% gas savings)
    event NFTClaimed(
        address indexed claimer,
        uint256 indexed tokenId,
        string observation,
        uint256 timestamp
    );
    event NFTDeposited(uint256 indexed tokenId, uint256 timestamp);
    event NFTWithdrawn(uint256 indexed tokenId, address indexed to);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event ETHDeposited(address indexed from, uint256 amount);
    event ETHWithdrawn(address indexed to, uint256 amount);

    // Custom Errors (save ~50 gas each vs require strings)
    error AlreadyClaimed();
    error InvalidSignature();
    error TokenNotAvailable();
    error NoTokensAvailable();
    error ObservationTooShort();
    error ObservationTooLong();
    error TransferFailed();
    error InsufficientETH();
    error InvalidTokenId();
    error OnlySignerAllowed();
    error NotTokenOwner();
    error ETHTransferFailed();
    error ZeroAddress();

    constructor(
        address _nftContract,
        address _signer
    ) Ownable(msg.sender) {
        if (_nftContract == address(0)) revert ZeroAddress();
        if (_signer == address(0)) revert ZeroAddress();
        nftContract = IERC721(_nftContract);
        signer = _signer;
    }

    // ============ Bitmap Helper Functions ============

    /**
     * @notice Check if a token is claimed using bitmap
     * @param tokenId Token ID (1-100)
     * @return True if claimed
     */
    function _isTokenClaimed(uint256 tokenId) internal view returns (bool) {
        if (tokenId == 0 || tokenId > 100) return true; // Invalid = treated as claimed
        uint256 bitIndex = tokenId - 1;
        return (_claimedBitmapLow & (1 << bitIndex)) != 0;
    }

    /**
     * @notice Check if a token is claimed using cached bitmap value
     * @param bitmap Cached bitmap value
     * @param tokenId Token ID (1-100)
     * @return True if claimed
     */
    function _isTokenClaimedCached(uint256 bitmap, uint256 tokenId) internal pure returns (bool) {
        if (tokenId == 0 || tokenId > 100) return true;
        uint256 bitIndex = tokenId - 1;
        return (bitmap & (1 << bitIndex)) != 0;
    }

    /**
     * @notice Mark a token as claimed in bitmap
     * @param tokenId Token ID (1-100)
     */
    function _setTokenClaimed(uint256 tokenId) internal {
        if (tokenId == 0 || tokenId > 100) revert InvalidTokenId();
        uint256 bitIndex = tokenId - 1;
        _claimedBitmapLow |= (1 << bitIndex);
    }

    /**
     * @notice Check if a token is deposited using bitmap
     * @param tokenId Token ID (1-100)
     * @return True if deposited
     */
    function _isTokenDeposited(uint256 tokenId) internal view returns (bool) {
        if (tokenId == 0 || tokenId > 100) return false;
        uint256 bitIndex = tokenId - 1;
        return (_depositedBitmapLow & (1 << bitIndex)) != 0;
    }

    /**
     * @notice Check if a token is deposited using cached bitmap value
     * @param bitmap Cached bitmap value
     * @param tokenId Token ID (1-100)
     * @return True if deposited
     */
    function _isTokenDepositedCached(uint256 bitmap, uint256 tokenId) internal pure returns (bool) {
        if (tokenId == 0 || tokenId > 100) return false;
        uint256 bitIndex = tokenId - 1;
        return (bitmap & (1 << bitIndex)) != 0;
    }

    /**
     * @notice Mark a token as deposited in bitmap
     * @param tokenId Token ID (1-100)
     * @param deposited Whether deposited or not
     */
    function _setTokenDeposited(uint256 tokenId, bool deposited) internal {
        if (tokenId == 0 || tokenId > 100) revert InvalidTokenId();
        uint256 bitIndex = tokenId - 1;
        if (deposited) {
            _depositedBitmapLow |= (1 << bitIndex);
        } else {
            _depositedBitmapLow &= ~(1 << bitIndex);
        }
    }

    // ============ Public View Functions ============

    /**
     * @notice Check if a specific token is available for claiming
     * @param tokenId The token ID to check
     * @return True if the token is available
     */
    function isTokenAvailable(uint256 tokenId) external view returns (bool) {
        if (tokenId == 0 || tokenId > 100) return false;

        // Cache storage reads for gas efficiency
        uint256 depositedBitmap = _depositedBitmapLow;
        uint256 claimedBitmap = _claimedBitmapLow;

        // Available = deposited AND not claimed AND actually owned by this contract
        return _isTokenDepositedCached(depositedBitmap, tokenId) &&
               !_isTokenClaimedCached(claimedBitmap, tokenId) &&
               nftContract.ownerOf(tokenId) == address(this);
    }

    /**
     * @notice Get all available token IDs
     * @return tokens Array of available token IDs
     */
    function getAvailableTokens() external view returns (uint256[] memory) {
        // Cache storage reads
        uint256 depositedBitmap = _depositedBitmapLow;
        uint256 claimedBitmap = _claimedBitmapLow;

        // First pass: count available
        uint256 count = 0;
        for (uint256 i = 1; i <= 100;) {
            if (_isTokenDepositedCached(depositedBitmap, i) && !_isTokenClaimedCached(claimedBitmap, i)) {
                // Double check ownership
                try nftContract.ownerOf(i) returns (address owner) {
                    if (owner == address(this)) {
                        unchecked { ++count; }
                    }
                } catch {}
            }
            unchecked { ++i; }
        }

        // Second pass: populate array
        uint256[] memory tokens = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= 100;) {
            if (_isTokenDepositedCached(depositedBitmap, i) && !_isTokenClaimedCached(claimedBitmap, i)) {
                try nftContract.ownerOf(i) returns (address owner) {
                    if (owner == address(this)) {
                        tokens[index] = i;
                        unchecked { ++index; }
                    }
                } catch {}
            }
            unchecked { ++i; }
        }

        return tokens;
    }

    /**
     * @notice Get the number of available tokens
     * @return Number of tokens available for claiming
     */
    function availableCount() external view returns (uint256) {
        // Cache storage reads
        uint256 depositedBitmap = _depositedBitmapLow;
        uint256 claimedBitmap = _claimedBitmapLow;

        uint256 count = 0;
        for (uint256 i = 1; i <= 100;) {
            if (_isTokenDepositedCached(depositedBitmap, i) && !_isTokenClaimedCached(claimedBitmap, i)) {
                try nftContract.ownerOf(i) returns (address owner) {
                    if (owner == address(this)) {
                        unchecked { ++count; }
                    }
                } catch {}
            }
            unchecked { ++i; }
        }
        return count;
    }

    /**
     * @notice Get claimed bitmap (for frontend optimization)
     * @return The claimed bitmap value
     */
    function getClaimedBitmap() external view returns (uint256) {
        return _claimedBitmapLow;
    }

    /**
     * @notice Get deposited bitmap (for frontend optimization)
     * @return The deposited bitmap value
     */
    function getDepositedBitmap() external view returns (uint256) {
        return _depositedBitmapLow;
    }

    /**
     * @notice Get the current nonce for an address
     * @param user The address to check
     * @return The current nonce
     */
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    // ============ Claim Functions ============

    /**
     * @notice Claim an NFT by providing an approved observation
     * @dev Includes nonce in signature to prevent replay attacks
     * @param tokenId The token ID to claim
     * @param observation The observation text (1-250 characters)
     * @param signature Backend signature approving this claim
     */
    function claimNFT(
        uint256 tokenId,
        string calldata observation,
        bytes calldata signature
    ) external nonReentrant {
        // Check if caller has already claimed
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();

        // Validate observation length
        uint256 obsLength = bytes(observation).length;
        if (obsLength < 1) revert ObservationTooShort();
        if (obsLength > 250) revert ObservationTooLong();

        // Cache bitmaps for gas efficiency
        uint256 claimedBitmap = _claimedBitmapLow;
        uint256 depositedBitmap = _depositedBitmapLow;

        // Check if token is available (using cached bitmaps)
        if (_isTokenClaimedCached(claimedBitmap, tokenId) || !_isTokenDepositedCached(depositedBitmap, tokenId)) {
            revert TokenNotAvailable();
        }
        if (nftContract.ownerOf(tokenId) != address(this)) {
            revert TokenNotAvailable();
        }

        // Get and increment nonce for replay protection
        uint256 currentNonce = nonces[msg.sender];

        // Verify signature from backend (includes nonce)
        bytes32 messageHash = keccak256(
            abi.encodePacked(msg.sender, tokenId, observation, currentNonce)
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedHash.recover(signature);

        if (recoveredSigner != signer) revert InvalidSignature();

        // Update state
        unchecked {
            nonces[msg.sender] = currentNonce + 1;
        }
        hasClaimed[msg.sender] = true;
        _setTokenClaimed(tokenId);

        // Transfer NFT to claimer
        nftContract.safeTransferFrom(address(this), msg.sender, tokenId);

        // Emit event with observation (stored in event logs, not state)
        emit NFTClaimed(msg.sender, tokenId, observation, block.timestamp);
    }

    /**
     * @notice Relayer function - backend executes claim on behalf of user
     * @dev Only the signer can call this. Used for gasless claims.
     *      Observation stored in event only (90% gas savings vs storage)
     * @param recipient The address to receive the NFT
     * @param tokenId The token ID to claim
     * @param observation The observation text
     */
    function relayClaimNFT(
        address recipient,
        uint256 tokenId,
        string calldata observation
    ) external nonReentrant {
        // Only signer (backend) can relay claims
        if (msg.sender != signer) revert OnlySignerAllowed();

        // Check if recipient has already claimed
        if (hasClaimed[recipient]) revert AlreadyClaimed();

        // Validate observation length
        uint256 obsLength = bytes(observation).length;
        if (obsLength < 1) revert ObservationTooShort();
        if (obsLength > 250) revert ObservationTooLong();

        // Cache bitmaps for gas efficiency
        uint256 claimedBitmap = _claimedBitmapLow;
        uint256 depositedBitmap = _depositedBitmapLow;

        // Check if token is available (using cached bitmaps)
        if (_isTokenClaimedCached(claimedBitmap, tokenId) || !_isTokenDepositedCached(depositedBitmap, tokenId)) {
            revert TokenNotAvailable();
        }
        if (nftContract.ownerOf(tokenId) != address(this)) {
            revert TokenNotAvailable();
        }

        // Mark as claimed (bitmap + mapping)
        hasClaimed[recipient] = true;
        _setTokenClaimed(tokenId);

        // Transfer NFT to recipient
        nftContract.safeTransferFrom(address(this), recipient, tokenId);

        // Emit event with observation (stored in event logs, not state - 90% gas savings)
        emit NFTClaimed(recipient, tokenId, observation, block.timestamp);
    }

    // ============ Owner Observation Functions ============

    /**
     * @notice Allow an NFT owner to add an observation for their token
     * @dev Verifies ownership via the NFT contract. Emits same NFTClaimed event.
     * @param tokenId The token ID owned by the caller
     * @param observation The observation text (1-250 characters)
     */
    function addObservation(
        uint256 tokenId,
        string calldata observation
    ) external nonReentrant {
        // Verify caller owns the NFT
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        // Validate observation length
        uint256 obsLength = bytes(observation).length;
        if (obsLength < 1) revert ObservationTooShort();
        if (obsLength > 250) revert ObservationTooLong();

        // Emit event with observation (same event as claim for consistency)
        emit NFTClaimed(msg.sender, tokenId, observation, block.timestamp);
    }

    /**
     * @notice Relay observation for an NFT owner (gasless)
     * @dev Only signer can call. Verifies ownership before emitting.
     * @param owner The address that owns the NFT
     * @param tokenId The token ID
     * @param observation The observation text
     */
    function relayAddObservation(
        address owner,
        uint256 tokenId,
        string calldata observation
    ) external nonReentrant {
        // Only signer (backend) can relay
        if (msg.sender != signer) revert OnlySignerAllowed();

        // Verify the owner actually owns the NFT
        if (nftContract.ownerOf(tokenId) != owner) revert NotTokenOwner();

        // Validate observation length
        uint256 obsLength = bytes(observation).length;
        if (obsLength < 1) revert ObservationTooShort();
        if (obsLength > 250) revert ObservationTooLong();

        // Emit event with observation
        emit NFTClaimed(owner, tokenId, observation, block.timestamp);
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the signer address
     * @param newSigner New signer address
     */
    function setSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        emit SignerUpdated(signer, newSigner);
        signer = newSigner;
    }

    /**
     * @notice Deposit NFTs into the contract (must approve first)
     * @param tokenIds Array of token IDs to deposit
     */
    function depositNFTs(uint256[] calldata tokenIds) external onlyOwner {
        uint256 length = tokenIds.length;
        for (uint256 i = 0; i < length;) {
            uint256 tokenId = tokenIds[i];
            if (tokenId == 0 || tokenId > 100) revert InvalidTokenId();

            nftContract.transferFrom(msg.sender, address(this), tokenId);

            // Mark as deposited if not already claimed
            if (!_isTokenClaimed(tokenId)) {
                _setTokenDeposited(tokenId, true);
            }

            emit NFTDeposited(tokenId, block.timestamp);

            unchecked { ++i; }
        }
    }

    /**
     * @notice Withdraw NFTs from the contract (emergency)
     * @param tokenIds Array of token IDs to withdraw
     * @param to Address to send the NFTs to
     */
    function withdrawNFTs(uint256[] calldata tokenIds, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();

        uint256 length = tokenIds.length;
        for (uint256 i = 0; i < length;) {
            uint256 tokenId = tokenIds[i];

            if (nftContract.ownerOf(tokenId) == address(this)) {
                _setTokenDeposited(tokenId, false);
                nftContract.safeTransferFrom(address(this), to, tokenId);
                emit NFTWithdrawn(tokenId, to);
            }

            unchecked { ++i; }
        }
    }

    /**
     * @notice Reset claim status for an address (admin override)
     * @param user Address to reset
     */
    function resetClaimStatus(address user) external onlyOwner {
        hasClaimed[user] = false;
    }

    /**
     * @notice Reset nonce for an address (admin override - use with caution)
     * @param user Address to reset
     * @param newNonce New nonce value
     */
    function resetNonce(address user, uint256 newNonce) external onlyOwner {
        nonces[user] = newNonce;
    }

    /**
     * @notice Deposit ETH to fund gas for relayed claims
     */
    receive() external payable {
        emit ETHDeposited(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw ETH from the contract
     * @param amount Amount of ETH to withdraw
     */
    function withdrawETH(uint256 amount) external onlyOwner {
        if (address(this).balance < amount) revert InsufficientETH();

        (bool success, ) = payable(owner()).call{value: amount}("");
        if (!success) revert ETHTransferFailed();

        emit ETHWithdrawn(owner(), amount);
    }

    /**
     * @notice Get contract ETH balance
     */
    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Required for safeTransferFrom to work - implements IERC721Receiver
     */
    function onERC721Received(
        address,
        address,
        uint256 tokenId,
        bytes calldata
    ) external override returns (bytes4) {
        // Auto-add to deposited if not already claimed and from NFT contract
        if (!_isTokenClaimed(tokenId) && msg.sender == address(nftContract) && tokenId > 0 && tokenId <= 100) {
            _setTokenDeposited(tokenId, true);
            emit NFTDeposited(tokenId, block.timestamp);
        }
        return this.onERC721Received.selector;
    }
}
