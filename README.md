# After Patmos - IKONBERG NFT Collection

A gasless NFT claiming experience powered by an AI Guardian using Visual Thinking Strategies (VTS).

## Overview

After Patmos is a 100-piece NFT collection by IKONBERG (Peter Haubenberger / Tsuro). Each fragment can be claimed for free through an innovative "ritual of entry" where an AI Guardian evaluates your observation of the artwork using museum-grade Visual Thinking Strategies.

**No gas fees. No purchase required. Just genuine human perception.**

This repository contains the complete claiming infrastructure:

- **Frontend**: Interactive 10x10 grid with wallet connection and claim flow
- **Backend**: Relay service with Gemini 2.0 Flash AI Guardian using VTS methodology
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
- **AI Guardian with VTS**: Evaluates observations using Visual Thinking Strategies methodology
- **Facilitation Mode**: Soft rejections offer VTS follow-up questions instead of hard failures
- **Aesthetic Profiling**: Classifies observers into 5 archetypes based on their perception style
- **Poetic Paraphrasing**: Guardian mirrors approved observations back in elevated language
- **IP Rate Limiting**: Blocks IPs after 3 hard rejections (soft rejects don't count)
- **Wallet Integration**: Supports MetaMask and other Web3 wallets
- **Interactive Grid**: Visual display of all 100 NFT pieces with claim status

## Smart Contracts

Deployed on **Ethereum Mainnet**:

| Contract | Address | Etherscan |
|----------|---------|-----------|
| After Patmos NFT (ERC-721) | `0x83e2654994264333e6FdfE2E43eb862866746041` | [View](https://etherscan.io/address/0x83e2654994264333e6FdfE2E43eb862866746041) |
| AfterPatmosClaimer | `0x83FB8FF0eAB0f036c4b3dC301483D571C5573a07` | [View](https://etherscan.io/address/0x83FB8FF0eAB0f036c4b3dC301483D571C5573a07) |

**AfterPatmosClaimer Features:**
- Allows whitelisted relayer to claim NFTs on behalf of users
- One claim per wallet address
- Stores observations on-chain
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

## AI Guardian

The Guardian is not a simple approval bot—it's a cognitive firewall trained in Visual Thinking Strategies (VTS), a method developed at MoMA to teach deeper seeing through open-ended questions.

### Claim Flow

1. **Select a Fragment** - Choose an unclaimed piece from the 10x10 grid
2. **Submit Your Observation** - Write what you see, feel, or experience (10-250 characters)
3. **Guardian Evaluation** - AI assesses your observation using VTS methodology
4. **Gasless Transfer** - If approved, NFT is transferred to your wallet for free

### Evaluation Criteria

The Guardian scores observations 1-10 based on:
- **Authenticity** (1-3 pts): Is this a genuine human response?
- **Perception** (1-3 pts): Does it describe what they actually see/feel?
- **Depth** (1-2 pts): Is there personal interpretation or connection?
- **Effort** (1-2 pts): Did they invest more than minimal effort?

### Facilitation Mode

For observations scoring 3-4, the Guardian enters **Facilitation Mode**—instead of rejecting, it offers a VTS follow-up question to guide deeper observation:

- *"What colors or shapes draw your eye first?"*
- *"If this fragment could speak, what might it say?"*
- *"Does this remind you of anything from your own life?"*
- *"What emotion do you sense hiding in the forms?"*

Soft rejections don't count against your attempts.

### Aesthetic Archetypes

The Guardian classifies each observer into one of five archetypes:

| Archetype | Description |
|-----------|-------------|
| **The Storyteller** | Sees narratives, characters, journeys |
| **The Builder** | Focuses on structure, composition, technical elements |
| **The Critic** | Analyzes meaning, context, artistic intent |
| **The Interpreter** | Finds personal symbols, metaphors, dreams |
| **The Visionary** | Perceives cosmic themes, philosophical depths |

### Paraphrasing

Upon approval, the Guardian mirrors your observation back in elevated, poetic language:

> *"The Guardian hears you: 'In the fractured forms, you sense the universe breathing.' You are recognized as The Visionary. Welcome to the collective."*

## Security

- Private keys are never exposed to the frontend
- IP-based rate limiting (100/15min, 5 claims/hr)
- 3-strike hard rejection = 1 hour IP block
- Prompt injection defense in AI evaluation
- One claim per wallet enforced on-chain

## NFT Images

NFT piece images are hosted on Arweave and available through OpenSea. They are not included in this repository due to size constraints.

- **OpenSea Collection**: [View on OpenSea](https://opensea.io/collection/after-patmos)
- **Storage**: Arweave (permanent, decentralized)

## Inspirations

- **[CryptoPunks](https://www.larvalabs.com/cryptopunks)** - Revolutionary free claim model
- **[Pak](https://pak.art/)** - NFT as living philosophical instrument
- **[Botto](https://botto.com/)** - Decentralized autonomous artist and AI-human symbiosis

## License

MIT

## Links

- [OpenSea Collection](https://opensea.io/collection/after-patmos)
- [VTS Home](https://vtshome.org/) - Visual Thinking Strategies

---

*The Guardian awaits your observations...*
