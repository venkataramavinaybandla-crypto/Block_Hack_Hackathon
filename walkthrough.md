# Contract Clause Risk Tagger — Project Walkthrough

## Status: RUNNING — End-to-End Flow Verified

---

## Architecture

```
Browser (port 8000 — Python serves frontend)
    |
    +-- JS: POST http://localhost:4021/analyze-contract
                |
                +-- No payment-signature header
                |   +-- HTTP 402 (payment-required header = base64 JSON)
                |       * amount: 10000 microUSDC = $0.01 USDC
                |       * asset:  ASA 10458941 (USDC Testnet)
                |       * payTo:  ENYUYR2Q74BCUIZ...
                |
                +-- Valid payment-signature (USDC on Algorand Testnet)
                        +-- Python FastAPI (port 8000)
                                +-- Ollama mistral:latest
                                        +-- [{clause, risk_level, reason, suggested_rewrite}]
```

---

## Demo Screenshots

### Initial Page Load
![Contract Risk Tagger — Initial Load](file:///C:/Users/Admin/.gemini/antigravity-ide/brain/5c8203c7-eb89-42fd-b573-6ca121cd32d8/initial_page_load_1786079850544.png)

### HTTP 402 Payment Box
![402 Payment Required Box](file:///C:/Users/Admin/.gemini/antigravity-ide/brain/5c8203c7-eb89-42fd-b573-6ca121cd32d8/payment_box_active_1786079882037.png)

### Full Flow Recording
![Contract Risk 402 Demo](file:///C:/Users/Admin/.gemini/antigravity-ide/brain/5c8203c7-eb89-42fd-b573-6ca121cd32d8/contract_risk_402_demo_1786079824120.webp)

---

## Verification Results

| Check | Result |
|-------|--------|
| Python AI backend /health | 200 OK — model: mistral:latest |
| x402 Node server /health | 200 OK — ai_backend: ok |
| POST /analyze-contract without payment | **HTTP 402** confirmed |
| payment-required header decoded | amount:10000, asset:10458941, payTo: ENYUYR... |
| Sample contract loaded | 1,697 chars |
| Frontend 402 box shows receiver + amount | Verified in browser |

---

## Algorand Testnet Wallet

```
Address  : ENYUYR2Q74BCUIZHDET5QPJ3E7XG3NGFASLDV2VR4SQBIP2OQDZTJYQ6J4
Network  : Algorand Testnet
Payment  : USDC (ASA 10458941), $0.01 per analysis
Explorer : https://testnet.explorer.perawallet.app/address/ENYUYR2Q74BCUIZHDET5QPJ3E7XG3NGFASLDV2VR4SQBIP2OQDZTJYQ6J4
```

> [!IMPORTANT]
> **Fund the wallet to complete the demo:**
> 1. Go to https://lora.algokit.io/testnet/fund
> 2. Paste address: `ENYUYR2Q74BCUIZHDET5QPJ3E7XG3NGFASLDV2VR4SQBIP2OQDZTJYQ6J4`
> 3. Opt-in to USDC ASA 10458941 in Pera Wallet (Testnet mode)
> 4. Send 0.01 USDC — copy the TxID
> 5. Paste TxID in the frontend and click Submit

---

## x402 Protocol (Real Spec — NOT Mocked)

The `@x402/hono` middleware returns a **base64-encoded JSON** in the `payment-required` response header:

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "accepts": [{
    "scheme": "exact",
    "network": "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    "amount": "10000",
    "asset": "10458941",
    "payTo": "ENYUYR2Q74BCUIZHDET5QPJ3E7XG3NGFASLDV2VR4SQBIP2OQDZTJYQ6J4",
    "maxTimeoutSeconds": 300
  }]
}
```

Frontend decodes with `atob()`, extracts receiver + amount, shows payment box.

---

## Project Files

| File | Purpose |
|------|---------|
| [x402-server/index.ts](file:///c:/Hackathon/contract-risk-tagger/x402-server/index.ts) | Hono + @x402/hono middleware |
| [x402-server/handlers/contract-analysis.ts](file:///c:/Hackathon/contract-risk-tagger/x402-server/handlers/contract-analysis.ts) | Proxy to Python AI after payment |
| [x402-server/.env](file:///c:/Hackathon/contract-risk-tagger/x402-server/.env) | Wallet + facilitator config |
| [backend/main.py](file:///c:/Hackathon/contract-risk-tagger/backend/main.py) | FastAPI + Ollama AI analysis |
| [frontend/index.html](file:///c:/Hackathon/contract-risk-tagger/frontend/index.html) | Payment flow UI |
| [start.ps1](file:///c:/Hackathon/contract-risk-tagger/start.ps1) | Launch both servers |

## Based on
[marotipatre/x402-Project](https://github.com/marotipatre/x402-Project) — adapted Hono + @x402/hono pattern
