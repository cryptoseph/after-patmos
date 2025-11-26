# After Patmos - AI Guardian NFT Claim

A gasless NFT claiming system powered by an AI Guardian that verifies human interaction before allowing claims.

## Overview

After Patmos is a unique NFT collection featuring 97 individual pieces. This repository contains the complete claiming infrastructure including:

- **Frontend**: Interactive grid display with wallet connection and claim flow
- **Backend**: Relay service with Gemini 2.0 Flash AI Guardian
- **Smart Contracts**: Foundry-based Solidity contracts for gasless claiming

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│    Frontend     │────▶│  Backend Relay  │────▶│  Smart Contract │
│   (Vanilla JS)  │     │  (AI Guardian)  │     │   (Ethereum)    │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       ▼
        │               ┌─────────────────┐
        │               │  Gemini 2.0     │
        │               │  Flash API      │
        └──────────────▶│  (Verification) │
                        └─────────────────┘
```

## Features

- **Gasless Claims**: Users don't pay gas fees - the relay covers transaction costs
- **AI Guardian**: Gemini 2.0 Flash verifies users are human through natural conversation
- **IP Rate Limiting**: Blocks IPs after 3 failed Guardian verification attempts
- **Wallet Integration**: Supports MetaMask and other Web3 wallets
- **Interactive Grid**: Visual display of all 97 NFT pieces with claim status

## Smart Contract

**AfterPatmosClaimer** - Deployed on Ethereum Mainnet

- Allows whitelisted relayer to claim NFTs on behalf of users
- One claim per wallet address
- Owner can withdraw ETH and manage relayer permissions

## Project Structure

```
├── index.html              # Main claim page
├── gallery.html            # NFT gallery display
├── script.js               # Frontend logic
├── wallet.js               # Web3 wallet integration
├── styles.css              # Styling
├── backend/
│   ├── server.js           # Express server with AI Guardian
│   ├── package.json        # Node dependencies
│   └── .env.example        # Environment template
└── contracts/
    ├── src/
    │   └── AfterPatmosClaimer.sol   # Main claiming contract
    ├── script/
    │   ├── Deploy.s.sol             # Deployment script
    │   └── BatchTransferToClamer.s.sol
    ├── test/
    │   └── AfterPatmosClaimer.t.sol # Contract tests
    └── foundry.toml                  # Foundry config
```

## Setup

### Prerequisites

- Node.js 18+
- Foundry (for smart contracts)
- Google AI API key (for Gemini)

### Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your configuration:
# - GEMINI_API_KEY: Your Google AI API key
# - PRIVATE_KEY: Relayer wallet private key
# - RPC_URL: Ethereum RPC endpoint
# - CONTRACT_ADDRESS: Deployed contract address

npm install
npm start
```

### Smart Contract Setup

```bash
cd contracts
cp .env.example .env
# Edit .env with deployment configuration

# Install dependencies
forge install

# Run tests
forge test

# Deploy
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

### Frontend

Serve the root directory with any static file server:

```bash
python3 -m http.server 8080
# or
npx serve .
```

## Environment Variables

### Backend (.env)

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google AI API key for Gemini 2.0 Flash |
| `PRIVATE_KEY` | Relayer wallet private key (funded with ETH for gas) |
| `RPC_URL` | Ethereum JSON-RPC endpoint |
| `CONTRACT_ADDRESS` | Deployed AfterPatmosClaimer address |
| `NFT_CONTRACT_ADDRESS` | Original NFT collection address |
| `PORT` | Server port (default: 3001) |

### Contracts (.env)

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Deployer wallet private key |
| `RPC_URL` | Ethereum JSON-RPC endpoint |
| `ETHERSCAN_API_KEY` | For contract verification |

## AI Guardian Flow

1. User connects wallet and clicks "Claim"
2. Frontend sends claim request to backend
3. AI Guardian (Gemini 2.0 Flash) initiates conversation
4. User must demonstrate human-like responses
5. After verification, backend signs and submits transaction
6. NFT is transferred to user's wallet

## Security

- Private keys are never exposed to the frontend
- IP-based rate limiting prevents brute force attacks
- AI Guardian provides Sybil resistance
- One claim per wallet enforced on-chain

## NFT Images

NFT piece images are hosted on Arweave and available through OpenSea. They are not included in this repository due to size constraints.

- **OpenSea Collection**: [View on OpenSea](https://opensea.io/collection/after-patmos)
- **Storage**: Arweave (permanent, decentralized)

## License

MIT

## Links

- [OpenSea Collection](https://opensea.io/collection/after-patmos)
- [Etherscan Contract](https://etherscan.io)
