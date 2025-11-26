# After Patmos Claimer Contract

A smart contract for the IKONBERG After Patmos NFT claim system with AI-validated observations.

## Overview

This contract:
- Holds After Patmos NFTs that can be claimed
- Requires a backend signature for each claim (verified by Gemini AI Guardian)
- Stores observations permanently on-chain
- Limits one claim per wallet address

## Setup

1. Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

2. Install dependencies:
```bash
forge install
```

3. Build:
```bash
forge build
```

4. Run tests:
```bash
forge test
```

## Deployment

### Testnet (Sepolia)
```bash
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url $RPC_URL --broadcast --verify
```

### Mainnet
```bash
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url $RPC_URL --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY
```

## Post-Deployment Setup

1. **Set the Claimer Contract in Backend**
   Update `CLAIMER_CONTRACT` in your backend `.env` with the deployed address.

2. **Approve NFT Transfer**
   From your wallet holding the NFTs:
   ```solidity
   // Call on the After Patmos NFT contract (0x83e2654994264333e6FdfE2E43eb862866746041)
   setApprovalForAll(CLAIMER_CONTRACT_ADDRESS, true)
   ```

3. **Deposit NFTs**
   ```solidity
   // On the Claimer contract
   depositNFTs([tokenId1, tokenId2, ...])
   ```
   Or simply transfer NFTs to the contract using `safeTransferFrom` - they'll be auto-added.

## Contract Functions

### For Users
- `claimNFT(tokenId, observation, signature)` - Claim a specific NFT
- `claimRandomNFT(observation, signature, nonce)` - Claim a random available NFT
- `getAvailableTokens()` - View all available token IDs
- `isTokenAvailable(tokenId)` - Check if a specific token is available
- `getObservation(tokenId)` - Get observation and observer for a token

### For Admin (Owner)
- `depositNFTs(tokenIds)` - Deposit NFTs into the contract
- `withdrawNFTs(tokenIds, to)` - Emergency withdrawal
- `setSigner(newSigner)` - Update the backend signer
- `resetClaimStatus(user)` - Allow a user to claim again

## Security

- Claims require ECDSA signatures from the authorized backend signer
- One claim per wallet address (enforced on-chain)
- Observations validated by Gemini AI before signature generation
- ReentrancyGuard protection on claim functions

## Contract Addresses

- **NFT Contract**: `0x83e2654994264333e6FdfE2E43eb862866746041`
- **Claimer Contract**: TBD (after deployment)

---

## Foundry Reference

### Build
```shell
forge build
```

### Test
```shell
forge test
```

### Format
```shell
forge fmt
```

### Gas Snapshots
```shell
forge snapshot
```
