# AfterPatmosClaimer V2 Migration

**Date:** November 28, 2025
**Migration TX Block:** 23898181

## Summary

Successfully migrated from AfterPatmosClaimer V1 to V2 with new observation tracking capabilities.

## Contract Addresses

| Contract | Address | Status |
|----------|---------|--------|
| **NFT (ERC-721)** | `0x83e2654994264333e6FdfE2E43eb862866746041` | Unchanged |
| **Old Claimer (V1)** | `0x83FB8FF0eAB0f036c4b3dC301483D571C5573a07` | Deprecated |
| **New Claimer (V2)** | `0x80BDd352510dC5f180FA5c6fa3477B19Feb1A807` | Active |

## V2 New Features

### 1. Observation Bitmap Tracking
- New `_observationBitmapLow` state variable
- `hasObservation(tokenId)` - Check if a token has an observation
- `getObservationCount()` - Get count of tokens with observations (for threshold tracking)
- `getTokensWithObservations()` - Get array of token IDs that have observations
- `getObservationBitmap()` - Get raw bitmap for frontend optimization

### 2. One Observation Per Token (Forever)
- Each of the 100 NFTs can only have ONE observation, permanently
- Enforced at contract level with `ObservationAlreadyExists()` error
- Prevents modification or re-submission of observations

### 3. Migration Functions (Owner Only)
- `migrateClaimStatus(address[] users)` - Set hasClaimed for multiple addresses
- `migrateClaimedBitmap(uint256 bitmap)` - Set claimed bitmap directly
- `migrateObservationBitmap(uint256 bitmap)` - Set observation bitmap directly

## Migration Steps Performed

### Step 1: Deploy New Contract
- Deployed AfterPatmosClaimer V2 to mainnet
- TX: `0x703333f2661c5f7207dc7c0c03f80603c0e75098f6988e05e3347124cd38c8cc`
- Gas used: 3,298,954

### Step 2: Withdraw NFTs from Old Claimer
- Withdrew 63 available NFTs to deployer wallet
- NFTs were in escrow in old claimer contract

### Step 3: Deposit NFTs to New Claimer
- Deposited 63 NFTs to new claimer via `depositNFTs()`
- Auto-registration via `onERC721Received()`

### Step 4: Migrate hasClaimed Status
- Migrated 2 addresses that had already claimed:
  - `0xFE8e30fbA9A80341875C7b33AffD4D8CB70487DF` (claimed token #65)
  - `0x764D2F2e65153A08C5509235334B08Be2ae02915` (claimed token #52)

### Step 5: Migrate Claimed Bitmap
- Set `_claimedBitmapLow = 0x10008000000000000`
- Marks tokens 52 and 65 as claimed

### Step 6: Migrate Observation Bitmap
- Set `_observationBitmapLow = 0x10008000000000000`
- Marks tokens 52 and 65 as having observations

## Post-Migration Verification

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| availableCount (new) | 63 | 63 | PASS |
| availableCount (old) | 0 | 0 | PASS |
| hasClaimed(claimer1) | true | true | PASS |
| hasClaimed(claimer2) | true | true | PASS |
| getObservationCount() | 2 | 2 | PASS |
| hasObservation(52) | true | true | PASS |
| hasObservation(65) | true | true | PASS |
| owner() | road2punk.eth | road2punk.eth | PASS |
| signer() | road2punk.eth | road2punk.eth | PASS |

## Configuration Updates

### Backend (.env)
```
CLAIMER_CONTRACT=0x80BDd352510dC5f180FA5c6fa3477B19Feb1A807
```

### Frontend (config.js)
```javascript
CLAIMER_CONTRACT: '0x80BDd352510dC5f180FA5c6fa3477B19Feb1A807'
```

## API Endpoints (New/Updated)

| Endpoint | Description |
|----------|-------------|
| `GET /api/observation/:tokenId` | Get observation for a specific token |
| `GET /api/observations` | Get all observations from events |
| `GET /api/threshold-status` | Get 50% threshold progress |
| `GET /api/tokens-with-observations` | Get token IDs with observations |
| `POST /api/observations/refresh` | Force cache refresh |
| `POST /api/add-observation` | Gallery flow for existing owners |

## Gas Costs

| Operation | Estimated Gas | Cost (at 0.27 gwei) |
|-----------|--------------|---------------------|
| Full Migration | ~8,500,000 | ~0.0023 ETH |
| claimNFT() | ~135,000 | ~0.000036 ETH |
| relayClaimNFT() | ~180,000 | ~0.000049 ETH |
| addObservation() | ~75,000 | ~0.00002 ETH |

## Etherscan Links

- **New Claimer:** https://etherscan.io/address/0x80BDd352510dC5f180FA5c6fa3477B19Feb1A807
- **NFT Contract:** https://etherscan.io/address/0x83e2654994264333e6FdfE2E43eb862866746041
- **Migration TX:** https://etherscan.io/tx/0x703333f2661c5f7207dc7c0c03f80603c0e75098f6988e05e3347124cd38c8cc

## Rollback Plan

If issues are discovered:
1. Deploy a new contract
2. Call `withdrawNFTs()` on V2 to retrieve NFTs
3. Transfer to new contract
4. Update config files

The old V1 contract remains on-chain but is empty (no NFTs).

---

*Migration performed by Claude Code on 2025-11-28*
