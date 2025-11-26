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
 * @notice A contract that holds After Patmos NFTs and allows users to claim them
 *         by submitting an observation that is approved by the backend (Gemini AI Guardian).
 * @dev Claims require a signature from the authorized signer (backend service).
 *      One claim per wallet address. Observations are stored on-chain.
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

    // Mapping of token IDs that have been claimed through this contract
    mapping(uint256 => bool) public tokenClaimed;

    // Mapping of observations per token ID
    mapping(uint256 => string) public observations;

    // Mapping of observer addresses per token ID
    mapping(uint256 => address) public observers;

    // Array of available token IDs for claiming
    uint256[] public availableTokens;
    mapping(uint256 => uint256) private tokenIndexInArray;
    mapping(uint256 => bool) private isInArray;

    // Events
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

    // Errors
    error AlreadyClaimed();
    error InvalidSignature();
    error TokenNotAvailable();
    error NoTokensAvailable();
    error ObservationTooShort();
    error ObservationTooLong();
    error TransferFailed();
    error InsufficientETH();

    constructor(
        address _nftContract,
        address _signer
    ) Ownable(msg.sender) {
        nftContract = IERC721(_nftContract);
        signer = _signer;
    }

    /**
     * @notice Claim an NFT by providing an approved observation
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
        bytes memory obsBytes = bytes(observation);
        if (obsBytes.length < 1) revert ObservationTooShort();
        if (obsBytes.length > 250) revert ObservationTooLong();

        // Check if token is available
        if (tokenClaimed[tokenId] || nftContract.ownerOf(tokenId) != address(this)) {
            revert TokenNotAvailable();
        }

        // Verify signature from backend
        bytes32 messageHash = keccak256(
            abi.encodePacked(msg.sender, tokenId, observation)
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedHash.recover(signature);

        if (recoveredSigner != signer) revert InvalidSignature();

        // Mark as claimed
        hasClaimed[msg.sender] = true;
        tokenClaimed[tokenId] = true;

        // Store observation on-chain
        observations[tokenId] = observation;
        observers[tokenId] = msg.sender;

        // Remove from available tokens array
        _removeFromAvailable(tokenId);

        // Transfer NFT to claimer
        nftContract.safeTransferFrom(address(this), msg.sender, tokenId);

        emit NFTClaimed(msg.sender, tokenId, observation, block.timestamp);
    }

    /**
     * @notice Claim a random available NFT
     * @param observation The observation text (1-250 characters)
     * @param signature Backend signature approving this claim
     * @param nonce Random nonce used in signature for token selection
     */
    function claimRandomNFT(
        string calldata observation,
        bytes calldata signature,
        uint256 nonce
    ) external nonReentrant {
        // Check if caller has already claimed
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();

        // Check if tokens available
        if (availableTokens.length == 0) revert NoTokensAvailable();

        // Validate observation length
        bytes memory obsBytes = bytes(observation);
        if (obsBytes.length < 1) revert ObservationTooShort();
        if (obsBytes.length > 250) revert ObservationTooLong();

        // Select token based on nonce (determined by backend)
        uint256 index = nonce % availableTokens.length;
        uint256 tokenId = availableTokens[index];

        // Verify signature from backend
        bytes32 messageHash = keccak256(
            abi.encodePacked(msg.sender, observation, nonce)
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedHash.recover(signature);

        if (recoveredSigner != signer) revert InvalidSignature();

        // Mark as claimed
        hasClaimed[msg.sender] = true;
        tokenClaimed[tokenId] = true;

        // Store observation on-chain
        observations[tokenId] = observation;
        observers[tokenId] = msg.sender;

        // Remove from available tokens array
        _removeFromAvailable(tokenId);

        // Transfer NFT to claimer
        nftContract.safeTransferFrom(address(this), msg.sender, tokenId);

        emit NFTClaimed(msg.sender, tokenId, observation, block.timestamp);
    }

    /**
     * @notice Get all available token IDs
     * @return Array of available token IDs
     */
    function getAvailableTokens() external view returns (uint256[] memory) {
        return availableTokens;
    }

    /**
     * @notice Get the number of available tokens
     * @return Number of tokens available for claiming
     */
    function availableCount() external view returns (uint256) {
        return availableTokens.length;
    }

    /**
     * @notice Check if a specific token is available for claiming
     * @param tokenId The token ID to check
     * @return True if the token is available
     */
    function isTokenAvailable(uint256 tokenId) external view returns (bool) {
        return !tokenClaimed[tokenId] &&
               nftContract.ownerOf(tokenId) == address(this);
    }

    /**
     * @notice Get observation data for a token
     * @param tokenId The token ID
     * @return observation The observation text
     * @return observer The address that made the observation
     */
    function getObservation(uint256 tokenId) external view returns (
        string memory observation,
        address observer
    ) {
        return (observations[tokenId], observers[tokenId]);
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the signer address
     * @param newSigner New signer address
     */
    function setSigner(address newSigner) external onlyOwner {
        emit SignerUpdated(signer, newSigner);
        signer = newSigner;
    }

    /**
     * @notice Deposit NFTs into the contract (must approve first)
     * @param tokenIds Array of token IDs to deposit
     */
    function depositNFTs(uint256[] calldata tokenIds) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            nftContract.transferFrom(msg.sender, address(this), tokenId);

            if (!tokenClaimed[tokenId] && !isInArray[tokenId]) {
                availableTokens.push(tokenId);
                tokenIndexInArray[tokenId] = availableTokens.length - 1;
                isInArray[tokenId] = true;
            }

            emit NFTDeposited(tokenId, block.timestamp);
        }
    }

    /**
     * @notice Withdraw NFTs from the contract (emergency)
     * @param tokenIds Array of token IDs to withdraw
     * @param to Address to send the NFTs to
     */
    function withdrawNFTs(uint256[] calldata tokenIds, address to) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            if (nftContract.ownerOf(tokenId) == address(this)) {
                _removeFromAvailable(tokenId);
                nftContract.safeTransferFrom(address(this), to, tokenId);
                emit NFTWithdrawn(tokenId, to);
            }
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
     * @notice Relayer function - backend executes claim on behalf of user
     * @dev Only the signer can call this. Used for gasless claims.
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
        require(msg.sender == signer, "Only signer can relay");

        // Check if recipient has already claimed
        if (hasClaimed[recipient]) revert AlreadyClaimed();

        // Validate observation length
        bytes memory obsBytes = bytes(observation);
        if (obsBytes.length < 1) revert ObservationTooShort();
        if (obsBytes.length > 250) revert ObservationTooLong();

        // Check if token is available
        if (tokenClaimed[tokenId] || nftContract.ownerOf(tokenId) != address(this)) {
            revert TokenNotAvailable();
        }

        // Mark as claimed
        hasClaimed[recipient] = true;
        tokenClaimed[tokenId] = true;

        // Store observation on-chain
        observations[tokenId] = observation;
        observers[tokenId] = recipient;

        // Remove from available tokens array
        _removeFromAvailable(tokenId);

        // Transfer NFT to recipient
        nftContract.safeTransferFrom(address(this), recipient, tokenId);

        emit NFTClaimed(recipient, tokenId, observation, block.timestamp);
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
        require(success, "ETH transfer failed");
        emit ETHWithdrawn(owner(), amount);
    }

    /**
     * @notice Get contract ETH balance
     */
    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ============ Internal Functions ============

    function _removeFromAvailable(uint256 tokenId) internal {
        if (!isInArray[tokenId]) return;

        uint256 index = tokenIndexInArray[tokenId];
        uint256 lastIndex = availableTokens.length - 1;

        if (index != lastIndex) {
            uint256 lastTokenId = availableTokens[lastIndex];
            availableTokens[index] = lastTokenId;
            tokenIndexInArray[lastTokenId] = index;
        }

        availableTokens.pop();
        delete tokenIndexInArray[tokenId];
        isInArray[tokenId] = false;
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
        // Auto-add to available if not already claimed and from NFT contract
        if (!tokenClaimed[tokenId] && msg.sender == address(nftContract) && !isInArray[tokenId]) {
            availableTokens.push(tokenId);
            tokenIndexInArray[tokenId] = availableTokens.length - 1;
            isInArray[tokenId] = true;
            emit NFTDeposited(tokenId, block.timestamp);
        }
        return this.onERC721Received.selector;
    }
}
