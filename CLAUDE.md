# CLAUDE.md

This file provides guidance to Claude Code when working with the After Patmos / IKONBERG NFT project.

## Project Vision

**After Patmos** is a 100-piece NFT collection by IKONBERG (Peter Haubenberger / Tsuro). The core innovation is a gasless claiming experience powered by an AI Guardian using Visual Thinking Strategies (VTS) methodology—a museum-grade approach to evaluating genuine human perception.

**Primary Goal:** Get all 100 NFTs claimed to unlock the 1/1 Masterwork auction (50% of proceeds go to the 100 Observers).

**Philosophy:** No gas fees. No purchase required. Just genuine human perception.

## Technical Priorities

When making decisions, prioritize in this order:
1. **User Experience** - Smooth, intuitive claiming flow
2. **Maintainability** - Clean, well-documented code that's easy to extend
3. **Web3-Native Patterns** - Use established Web3 tooling and conventions
4. **Innovation** - Safe experimentation with cutting-edge approaches

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│  Backend Relay  │────▶│  Smart Contract │
│  (Vanilla JS)   │     │  (AI Guardian)  │     │   (Ethereum)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        ▼                       ▼
   Wallet (EIP-6963)      Gemini 2.0 Flash
```

### Component Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Vanilla JS, CSS3 | No framework—intentionally lightweight |
| Backend | Node.js, Express | Relay service with AI Guardian |
| AI | Gemini 2.0 Flash | VTS-based observation evaluation |
| Contracts | Solidity 0.8.24, Foundry | Gas-optimized with bitmap tracking |
| Blockchain | Ethereum Mainnet | Chain ID: 1 |

### Deployed Contracts

| Contract | Address |
|----------|---------|
| NFT (ERC-721) | `0x83e2654994264333e6FdfE2E43eb862866746041` |
| Claimer | `0x83FB8FF0eAB0f036c4b3dC301483D571C5573a07` |

## Development Commands

### Frontend
```bash
# Serve frontend
python3 -m http.server 8080

# Run tests
npm test
npm run test:watch
npm run test:coverage
```

### Backend
```bash
cd backend
npm install
npm start          # Runs on port 3001
```

### Smart Contracts
```bash
cd contracts
forge build        # Compile
forge test         # Run tests
forge test -vvvv   # Verbose output

# Deploy (requires .env with PRIVATE_KEY, RPC_URL)
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

## Project Structure

```
TsuroIkonberg/
├── index.html              # Main claim page (10x10 grid UI)
├── gallery.html            # NFT gallery view
├── script.js               # Core application logic
├── wallet.js               # Web3 wallet integration (EIP-6963)
├── config.js               # Centralized configuration
├── styles.css              # Styling (~3000 lines)
├── analytics.js            # Privacy-first analytics (disabled by default)
├── backend/
│   ├── server.js           # Express server + AI Guardian
│   ├── package.json
│   └── .env.example
├── contracts/
│   ├── src/
│   │   └── AfterPatmosClaimer.sol   # Main claiming contract
│   ├── script/                       # Deployment scripts
│   ├── test/                         # Foundry tests
│   └── foundry.toml
├── tests/                  # Frontend tests (Vitest)
├── pieces/                 # NFT artwork (1-100.jpg)
└── Event-Pictures/         # Historical event photos
```

## Code Conventions

### Naming
- **Files/CSS classes:** `kebab-case`
- **JS functions/variables:** `camelCase`
- **Solidity:** `camelCase` functions, `_camelCase` private vars
- **Contract events:** `PascalCase`

### JavaScript Patterns
- Use `async/await` over raw promises
- Cache API responses (10-minute TTL in localStorage)
- Validate wallet connections before operations
- Always handle errors with user-friendly messages

### Solidity Patterns
- Use custom errors instead of require strings (gas savings)
- Bitmap tracking for token states (100 tokens fit in 2 uint256s)
- Store observations in events only (90% gas savings)
- Always use reentrancy guards for external calls

### CSS Conventions
- Mobile-first responsive design
- Use CSS custom properties for theming
- Animations: subtle, purposeful, not distracting
- Dark theme with accent colors: cyan (#4ecdc4), magenta (#ff00ff), yellow (#ffff00)

## AI Guardian System

The Guardian evaluates observations using Visual Thinking Strategies:

### Scoring (1-10)
- **Authenticity (1-3 pts):** Is this a genuine human response?
- **Perception (1-3 pts):** Does it describe what they see/feel?
- **Depth (1-2 pts):** Personal interpretation or connection?
- **Effort (1-2 pts):** Investment beyond minimal?

### Outcomes
- **Score 5-10:** Approved → NFT claimed
- **Score 3-4:** Soft reject → VTS follow-up question offered
- **Score 0-2:** Hard reject → Counts toward 3-strike IP block

### Aesthetic Archetypes
The Guardian classifies observers: The Storyteller, The Builder, The Critic, The Interpreter, The Visionary.

## Security Considerations

### Never Expose
- Private keys (backend only)
- API keys in frontend
- User IP addresses in logs

### Always Implement
- Rate limiting on all endpoints
- CORS validation
- Input sanitization (especially observations)
- Signature verification for claims
- Nonce-based replay protection

### Backend Security
- 100 requests/15min general limit
- 5 claim attempts/hour
- 3 hard rejections = 1-hour IP block
- Helmet.js security headers
- 10KB max body size

## Environment Variables

### Backend (.env)
```
PORT=3001
PRIVATE_KEY=<relayer_wallet_private_key>
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/<key>
NFT_CONTRACT=0x83e2654994264333e6FdfE2E43eb862866746041
CLAIMER_CONTRACT=0x83FB8FF0eAB0f036c4b3dC301483D571C5573a07
GEMINI_API_KEY=<google_ai_api_key>
FRONTEND_URL=http://localhost:8080
```

### Frontend (meta tags in index.html)
```html
<meta name="backend-url" content="https://api.afterpatmos.com">
<meta name="alchemy-api-key" content="<key>">
```

## Testing Requirements

### Before Committing
1. Run `npm test` for frontend tests
2. Run `forge test` for contract tests
3. Test the claim flow manually on localhost
4. Verify mobile responsiveness

### Test Coverage Areas
- Wallet connection/disconnection
- Claim modal flow
- AI Guardian responses (mock)
- Contract bitmap operations
- Signature verification

## Common Tasks

### Adding a New Feature
1. Check existing patterns in similar code
2. Update relevant documentation
3. Add tests for user-visible functionality
4. Test on mobile

### Modifying the Claim Flow
1. Update `script.js` for frontend logic
2. Update `backend/server.js` for API changes
3. Never modify contract without thorough testing
4. Consider gas implications

### Updating Styles
1. Follow existing CSS organization
2. Add mobile styles in appropriate media query sections
3. Test on actual mobile devices
4. Keep animations subtle

## MCP Servers

This project uses Model Context Protocol (MCP) servers to enhance AI-assisted development. Configuration is in `.mcp.json`.

### Active MCP Servers

| Server | Purpose | Key Capabilities |
|--------|---------|------------------|
| **Context7** | Documentation | Up-to-date docs for libraries (ethers.js, Foundry, etc.) |
| **Wallet Agent** | Web3 Operations | Wallet connections, NFT transfers, ENS resolution, contract testing |
| **GitHub** | Repository Management | Issues, PRs, code search, repo management |

### Wallet Agent Usage

The Wallet Agent MCP provides powerful Web3 capabilities:

```
# Check NFT ownership
"Get NFT owner for token 42 on contract 0x83e2654994264333e6FdfE2E43eb862866746041"

# Check balances
"Get balance for 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

# Resolve ENS names
"Resolve ENS name vitalik.eth"

# Contract interactions (with Wagmi integration)
"Load wagmi config from ./contracts/out"
"List all functions for AfterPatmosClaimer"
```

### Context7 Usage

For up-to-date library documentation:

```
# Get latest ethers.js docs
"Use context7 to get ethers.js v6 documentation for contract interactions"

# Foundry documentation
"Use context7 to get Foundry testing best practices"
```

### MCP Environment Variables

Add to your shell profile or `.env`:
```bash
export ALCHEMY_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/<key>"
export GITHUB_TOKEN="<your-github-token>"
```

### Adding New MCP Servers

Edit `.mcp.json` to add servers. Restart Claude Code after changes.

Recommended additions for this project:
- **Firecrawl** - Web scraping for OpenSea/market data
- **Sentry** - Error monitoring for backend
- **CoinGecko** - ETH gas/price data

## Custom Slash Commands

Project-specific commands in `.claude/commands/`:

| Command | Description |
|---------|-------------|
| `/check-claims` | Check claim status, progress toward 1/1 auction |
| `/deploy-check` | Pre-deployment checklist (tests, contracts, git) |
| `/guardian-test` | Test AI Guardian with sample observations |
| `/market-intel` | Gather OpenSea stats and market intelligence |

Usage: Type the command name in Claude Code to run it.

## Links & Resources

- [OpenSea Collection](https://opensea.io/collection/after-patmos)
- [IKONBERG Website](https://ikonberg.com/)
- [VTS Home](https://vtshome.org/) - Visual Thinking Strategies methodology
- [Etherscan NFT](https://etherscan.io/address/0x83e2654994264333e6FdfE2E43eb862866746041)
- [Etherscan Claimer](https://etherscan.io/address/0x83FB8FF0eAB0f036c4b3dC301483D571C5573a07)
- [Wallet Agent Docs](https://github.com/wallet-agent/wallet-agent) - MCP Web3 toolkit
- [Context7](https://github.com/upstash/context7-mcp) - Library documentation MCP

## Inspirations

- **CryptoPunks** - Free claim ethos
- **Pak** - NFTs as living philosophical instruments
- **Botto** - AI-human symbiosis
- **Sam Spratt** - Collector integration

---

*The Guardian awaits your observations...*
