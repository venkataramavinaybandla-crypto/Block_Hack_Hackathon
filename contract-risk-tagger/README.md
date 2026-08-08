# Contract Clause Risk Tagger
## AI-powered legal contract analyzer with Algorand x402 payments

---

## Architecture

```
Browser (port 8000)
    │
    ├── GET / → Python FastAPI serves index.html
    │
    └── POST /analyze-contract (via JS → port 4021)
            │
            ▼
    Node.js x402 Server (port 4021, Hono + @x402/hono)
            │
            ├── No payment-signature header
            │   └── HTTP 402 + USDC payment requirements
            │
            └── Valid payment (USDC, Algorand Testnet)
                    │
                    ▼
            Python FastAPI AI Backend (port 8000)
                    │
                    └── Ollama mistral:latest → clause analysis JSON
```

## Environment Setup (REQUIRED — servers refuse to start without it)

Both servers load `INTERNAL_SECRET` **only** from their local `.env` file — there is no hardcoded default. Create both files (copy the templates) with the **same** secret value:

```powershell
# backend/.env  (see backend/.env.example)
INTERNAL_SECRET=change-me-to-a-long-random-string

# x402-server/.env  (see x402-server/.env.example)
INTERNAL_SECRET=change-me-to-a-long-random-string   # MUST match backend/.env
AVM_ADDRESS=3LMI2BONQHGE6SCKLONQYJQCYIA5R32P5PEXLNXKUQS3CAMXRDDLBV342I
DEMO_MODE=true                                       # instant-execution demo TxID
DEMO_TXID=SIAKOLZAYLX3UZK5IL26SLDUDN523ZNSU65HF4CEYS4YOP5WDVKQ
```

If `INTERNAL_SECRET` is missing, the server prints `FATAL: INTERNAL_SECRET env var is not set` and exits.

## Security Model

- **AI backend binds to 127.0.0.1 only** — port 8000 is never exposed externally. Direct calls to `/analyze-contract` without the correct `X-Internal-Secret` header are rejected with **403**.
- **On-chain payment verification** (`verifyTxIdOnChain`) rejects anything that is not a fresh USDC (ASA **10458941**) asset-transfer of ≥ 10,000 microunits to the CERBERUS wallet **within the last hour** — native ALGO `pay` transactions, wrong receivers, wrong assets, and stale TxIDs are all rejected with **HTTP 402**. TxIDs are replay-protected per session.

## Quick Start

### 1. Fund Wallet (Algorand Testnet USDC)
- Visit: https://lora.algokit.io/testnet/fund
- Wallet: `3LMI2BONQHGE6SCKLONQYJQCYIA5R32P5PEXLNXKUQS3CAMXRDDLBV342I`

> **Demo / instant execution**: the frontend pre-fills a well-formed demo TxID
> (`SIAKOLZAYLX3UZK5IL26SLDUDN523ZNSU65HF4CEYS4YOP5WDVKQ`) which the gateway
> accepts instantly when `DEMO_MODE=true` — no wallet or indexer needed for the
> demo. Set `DEMO_MODE=false` to force strict on-chain verification for ALL TxIDs.

### 2. Start Services
```powershell
.\start.ps1
```

Or manually:
```powershell
# Terminal 1 — Python AI backend (127.0.0.1 only)
cd backend
uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2 — Node x402 server  
cd x402-server
npm run dev
```

### 3. Run the security test suite
```powershell
python test_paid_flow.py   # exits non-zero on ANY failed security check
```

### 3. Open Frontend
http://localhost:8000

## x402 Payment Flow

1. Click **Analyze Contract** → x402 server returns **HTTP 402**
2. Response contains: `{ accepts: [{ price: "$0.01", payTo: "...", asset: USDC }] }`
3. User sends 0.01 USDC on Algorand Testnet via Pera Wallet
4. User submits Transaction ID → x402 server verifies via GoPlausible facilitator
5. Payment verified → request proxied to AI backend → results returned

## Wallet

- **Address**: `3LMI2BONQHGE6SCKLONQYJQCYIA5R32P5PEXLNXKUQS3CAMXRDDLBV342I`
- **Network**: Algorand Testnet
- **Payment**: USDC (ASA 10458941)
- **Price**: $0.01 USDC per analysis
- **Explorer**: https://testnet.explorer.perawallet.app/address/3LMI2BONQHGE6SCKLONQYJQCYIA5R32P5PEXLNXKUQS3CAMXRDDLBV342I

## Stack

| Component | Tech |
|-----------|------|
| x402 Payment Gate | Node.js + Hono + @x402/hono |
| AI Analysis | Python FastAPI + Ollama + Mistral |
| Blockchain | Algorand Testnet (USDC) |
| Facilitator | GoPlausible (https://facilitator.goplausible.xyz) |
| Frontend | Vanilla HTML/CSS/JS |

## Reference
Based on: https://github.com/marotipatre/x402-Project
