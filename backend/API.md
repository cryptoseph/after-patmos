# After Patmos API Documentation v3.0

## Base URL

```
http://localhost:3001/api
```

## Authentication

No authentication required for public endpoints. Rate limiting is enforced per IP address.

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| All `/api/*` | 100 requests | 15 minutes |
| `/api/submit-observation` | 5 requests | 1 hour |

After 3 hard rejections from the Guardian, the IP is blocked for 1 hour.

---

## Endpoints

### Health & Monitoring

#### `GET /api/health`

Check service health and configuration.

**Response:**
```json
{
  "status": "ok",
  "signer": "0x...",
  "claimerContract": "0x...",
  "security": {
    "csp": "enabled",
    "rateLimit": "IETF-draft-7",
    "aiGuardian": "VTS-cognitive-firewall"
  }
}
```

---

#### `GET /api/metrics`

Get comprehensive service metrics for monitoring dashboards.

**Response:**
```json
{
  "status": "healthy",
  "version": "3.0.0",
  "uptime": {
    "days": 1,
    "hours": 5,
    "minutes": 30,
    "seconds": 45
  },
  "uptimeMs": 106245000,
  "signer": {
    "address": "0x...",
    "balance": "0.5 ETH"
  },
  "blockchain": {
    "currentBlock": 18500000,
    "txSubmitted": 50,
    "txConfirmed": 48,
    "txFailed": 2
  },
  "requests": {
    "total": 1000,
    "successful": 950,
    "failed": 50,
    "byEndpoint": {
      "/api/submit-observation": {
        "total": 200,
        "successful": 150,
        "failed": 50
      }
    }
  },
  "guardian": {
    "evaluations": 200,
    "approvals": 150,
    "softRejects": 30,
    "hardRejects": 20,
    "errors": 0,
    "averageScore": "6.50",
    "byArchetype": {
      "The Storyteller": 45,
      "The Visionary": 40,
      "The Interpreter": 35,
      "The Builder": 20,
      "The Critic": 10
    }
  },
  "claims": {
    "attempted": 150,
    "successful": 148,
    "failed": 2,
    "gasUsed": "15000000",
    "averageGas": "100000"
  },
  "rateLimiting": {
    "blockedIPs": 5
  },
  "storage": {
    "type": "redis",
    "redisConnected": true
  }
}
```

---

#### `GET /api/ready`

Kubernetes/load balancer readiness probe. Checks RPC and contract connectivity.

**Response (200):**
```json
{ "ready": true }
```

**Response (503):**
```json
{ "ready": false, "error": "RPC connection failed" }
```

---

#### `GET /api/live`

Kubernetes/load balancer liveness probe.

**Response:**
```json
{
  "live": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### NFT Operations

#### `GET /api/available-tokens`

Get all NFT tokens available for claiming.

**Response:**
```json
{
  "tokens": [1, 5, 12, 23, 45, 67, 89],
  "count": 7
}
```

---

#### `GET /api/has-claimed/:address`

Check if a wallet address has already claimed an NFT.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| address | string | Ethereum address (0x...) |

**Response:**
```json
{ "hasClaimed": false }
```

**Error (400):**
```json
{ "error": "Invalid Ethereum address" }
```

---

### Claim Operations

#### `POST /api/submit-observation`

Submit an observation to the AI Guardian for evaluation and claim an NFT if approved.

**Request Body:**
```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "tokenId": 42,
  "observation": "In this fragment, I see the universe breathing through fractured light..."
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| address | string | Yes | Valid Ethereum address |
| tokenId | number | Yes | 1-100, must be available |
| observation | string | Yes | 10-250 characters |

**Success Response (Approved):**
```json
{
  "approved": true,
  "softReject": false,
  "aestheticArchetype": "The Visionary",
  "paraphrase": "In the fractured forms, you sense the universe breathing through ethereal light.",
  "reason": "Your observation demonstrates deep contemplation and philosophical connection.",
  "score": 8,
  "message": "The Guardian hears you: \"In the fractured forms, you sense the universe breathing.\" You are recognized as The Visionary. Welcome to the collective.",
  "claimed": true,
  "broadcasting": true,
  "claimResult": {
    "txHash": "0xabc123...",
    "blockNumber": null,
    "gasUsed": null,
    "tokenId": 42,
    "observation": "In this fragment, I see the universe breathing...",
    "etherscanUrl": "https://etherscan.io/tx/0xabc123..."
  }
}
```

**Soft Rejection Response (Score 3-4):**
```json
{
  "approved": false,
  "softReject": true,
  "facilitatorQuestion": "What colors or shapes draw your eye first?",
  "aestheticArchetype": "The Storyteller",
  "paraphrase": "You glimpse a narrative forming...",
  "reason": "Your observation shows potential but lacks depth.",
  "score": 4,
  "message": "The Guardian senses potential in your words. What colors or shapes draw your eye first?",
  "vtsAnalysis": {
    "what_happening": "Brief surface observation",
    "evidence": "Limited visual grounding",
    "depth": "Needs more personal connection"
  },
  "attemptsRemaining": null,
  "blocked": false
}
```

**Hard Rejection Response (Score 0-2):**
```json
{
  "approved": false,
  "softReject": false,
  "aestheticArchetype": null,
  "paraphrase": null,
  "reason": "Generic response without visual engagement.",
  "score": 2,
  "message": "The Guardian has considered your words. Deepen your observation and return. (2 attempts remaining)",
  "vtsAnalysis": {
    "what_happening": "No visual description",
    "evidence": "No evidence provided",
    "depth": "No personal interpretation"
  },
  "attemptsRemaining": 2,
  "blocked": false
}
```

**Blocked Response:**
```json
{
  "error": "The Guardian requires patience. You have been temporarily blocked after 3 failed attempts. Try again in 45 minutes.",
  "blocked": true,
  "remainingMins": 45
}
```

**Error Responses:**

| Status | Error |
|--------|-------|
| 400 | Invalid Ethereum address |
| 400 | Observation too short |
| 400 | Observation must be 250 characters or less |
| 400 | This address has already received a blessing |
| 400 | This piece has already found its observer |
| 429 | Too many requests |
| 500 | The Guardian encountered an anomaly |

---

#### `GET /api/tx-status/:txHash`

Check the confirmation status of a claim transaction.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| txHash | string | Transaction hash (0x...) |

**Pending Response:**
```json
{
  "status": "pending",
  "txHash": "0xabc123...",
  "confirmed": false,
  "message": "Transaction is still pending"
}
```

**Confirmed Response:**
```json
{
  "status": "confirmed",
  "txHash": "0xabc123...",
  "confirmed": true,
  "blockNumber": 18500000,
  "gasUsed": "95000",
  "effectiveGasPrice": "20000000000"
}
```

**Failed Response:**
```json
{
  "status": "failed",
  "txHash": "0xabc123...",
  "confirmed": false,
  "blockNumber": 18500000,
  "gasUsed": "21000"
}
```

---

### Observations

#### `GET /api/observation/:tokenId`

Get the observation for a specific claimed token.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| tokenId | number | Token ID (1-100) |

**Response:**
```json
{
  "tokenId": 42,
  "observation": "In this fragment, I see the universe breathing...",
  "observer": "0x1234567890123456789012345678901234567890"
}
```

**Unclaimed Token:**
```json
{
  "tokenId": 42,
  "observation": null,
  "observer": null
}
```

---

#### `GET /api/observations`

Get all observations for claimed tokens.

**Response:**
```json
{
  "observations": [
    {
      "tokenId": 1,
      "observation": "Colors dance in harmony...",
      "observer": "0x123..."
    },
    {
      "tokenId": 15,
      "observation": "A story unfolds in shapes...",
      "observer": "0x456..."
    }
  ]
}
```

---

## AI Guardian Evaluation

### Scoring Criteria (1-10)

| Category | Points | Description |
|----------|--------|-------------|
| Authenticity | 1-3 | Is this a genuine human response? |
| Perception | 1-3 | Does it describe what they see/feel? |
| Depth | 1-2 | Personal interpretation or connection? |
| Effort | 1-2 | More than minimal effort invested? |

### Score Outcomes

| Score | Outcome | Description |
|-------|---------|-------------|
| 0-2 | Hard Reject | Counts against 3-strike limit |
| 3-4 | Soft Reject | VTS facilitation, no penalty |
| 5-7 | Approved | Acceptable observation |
| 8-10 | Exceptional | Exceptional depth |

### Aesthetic Archetypes

| Archetype | Characteristics |
|-----------|-----------------|
| The Storyteller | Sees narratives, characters, journeys |
| The Builder | Focuses on structure, composition, technique |
| The Critic | Analyzes meaning, context, artistic intent |
| The Interpreter | Finds personal symbols, metaphors, dreams |
| The Visionary | Perceives cosmic themes, philosophical depths |

---

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 404 | Endpoint not found |
| 429 | Rate limited |
| 500 | Internal server error |
| 503 | Service unavailable (readiness check failed) |

---

## Security Headers

All responses include the following security headers:

- `Content-Security-Policy` - Web3-optimized CSP
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` - HSTS enabled

---

## Rate Limit Headers (IETF Draft-7)

```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1705312200
```

---

## Changelog

### v3.0.0 (2024)
- Added structured JSON logging with request tracing
- Added `/api/metrics` monitoring endpoint
- Added `/api/tx-status/:txHash` for transaction polling
- Added `/api/ready` and `/api/live` health probes
- Added transaction retry mechanism with exponential backoff
- Added graceful shutdown handling
- Added Redis session storage (optional, falls back to in-memory)
- Added support for Upstash Redis with automatic TLS
- Improved error handling with typed responses
- Enhanced Guardian metrics tracking by archetype

### v2.0.0 (2024)
- Added VTS facilitation mode for soft rejections
- Added aesthetic archetype classification
- Added poetic paraphrasing
- Added 3-strike IP blocking

### v1.0.0 (2024)
- Initial release with basic claim functionality
