// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC721 {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title BatchTransfer
 * @notice Transfers multiple ERC721 tokens in a single transaction
 * @dev Requires prior approval via setApprovalForAll
 */
contract BatchTransfer {
    /**
     * @notice Transfer multiple NFTs from one address to another
     * @param nftContract The ERC721 contract address
     * @param from The current owner
     * @param to The recipient
     * @param tokenIds Array of token IDs to transfer
     */
    function batchTransfer(
        address nftContract,
        address from,
        address to,
        uint256[] calldata tokenIds
    ) external {
        IERC721 nft = IERC721(nftContract);
        uint256 length = tokenIds.length;

        for (uint256 i = 0; i < length;) {
            nft.safeTransferFrom(from, to, tokenIds[i]);
            unchecked { ++i; }
        }
    }
}
