# X402 Resource Server - Backend Documentation

> A fully functional x402 (HTTP 402 Payment Required) resource server implementing Algorand TestNet payments for API access.

## Overview

This is a Hono-based resource server that implements the **x402 protocol** for HTTP payment handling. It enforces payment-per-request for APIs using the Algorand blockchain and the ExactAvmScheme.

**Key Features:**
- ✅ HTTP 402 Payment Required responses
- ✅ Automatic payment verification via x402 middleware
- ✅ Algorand TestNet integration (USDC payments)
- ✅ GoPlausible facilitator integration
- ✅ CORS support for browser-based clients
- ✅ Multiple resource endpoints (easily extensible)

## Quick Start

### Prerequisites
- Node.js >=18.0
- npm or yarn
- Algorand TestNet account with receiver address
- GoPlausible facilitator URL (or self-hosted)

### Installation

```bash
cd x402-demo-server
npm install
```

### Configuration

Create `.env` file:

```env
AVM_ADDRESS=YOUR_RECEIVER_ALGORAND_ADDRESS
FACILITATOR_URL=https://facilitator.goplausible.xyz
PORT=4021
```

**Environment Variables:**
- `AVM_ADDRESS`: Algorand account address that receives payments (public key format)
- `FACILITATOR_URL`: URL to x402 facilitator service (default: GoPlausible hosted)
- `PORT`: Server port (default: 4021)

### Running

```bash
npm start
# or with tsx for development:
npx tsx index.ts
```

Server will start on `http://localhost:4021`

#### Health Check

```bash
curl http://localhost:4021/health
# Output: {"status":"ok"}
```

---

## Architecture

### Request Flow (Complete x402 Payment Cycle)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT REQUEST                               │
│  GET /weather (no authorization)                                    │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│  1. CORS MIDDLEWARE (CRITICAL)                                      │
│  - Handles OPTIONS preflight                                        │
│  - Sets Access-Control-Allow-Headers: *                             │
│  - Sets Access-Control-Expose-Headers: *                            │
│  ⚠️  MUST be first middleware before all others                     │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│  2. LOGGING MIDDLEWARE (DEBUGGING)                                  │
│  - Logs request method, path, headers                               │
│  - Logs response status code                                        │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│  3. X402 PAYMENT MIDDLEWARE (CRITICAL)                              │
│  - Checks for payment-signature header                              │
│  - If missing: returns 402 Payment Required + payment object        │
│  - If present: validates with facilitator                           │
│  - If valid: passes request to handler                              │
│  - If invalid: returns 402 again                                    │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
        ┌─────────────────────┴─────────────────────┐
        │                                           │
    [VALID PAYMENT]                          [NO/INVALID PAYMENT]
        │                                           │
        ↓                                           ↓
┌─────────────────────────┐          ┌──────────────────────────────┐
│  4. RESOURCE HANDLER    │          │  RETURN 402 RESPONSE         │
│  GET /weather handler   │          │                              │
│  - Retrieves resource   │          │  Headers:                    │
│  - Returns 200 OK       │          │  - Payment-Required          │
│  - Response body: JSON  │          │  - Payment-Response          │
└─────────────────────────┘          │  - Payment-Signature         │
        │                            │                              │
        ↓                            │  Body: Payment object with:  │
   [SUCCESS]                         │  - scheme: 'exact'           │
                                     │  - network: Algorand TestNet │
                                     │  - amount: 5000 (micro-units)│
                                     │  - assetId: 10458941 (USDC)  │
                                     │  - payTo: receiver address   │
                                     │                              │
                                     └──────────────────────────────┘
                                           ↓
                                    [BACK TO CLIENT]
                                    Client signs transactions
                                    and retries with Payment-Signature
```

---

## Critical Code Sections

### 1. CORS Configuration (Lines 33-56)

**File:** `x402-demo-server/index.ts`

```typescript
// ⚠️ CRITICAL: CORS MUST be first middleware
app.use('*', async (c, next) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, HEAD',
    'Access-Control-Allow-Headers': '*',        // ← Allow ANY header
    'Access-Control-Expose-Headers': '*',       // ← Expose ANY header
    'Access-Control-Max-Age': '86400',
  }
  
  // ⚠️ CRITICAL: Manually handle OPTIONS (browser preflight)
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }
  
  // ⚠️ CRITICAL: Add headers to ALL responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.header(key, value)
  })
  
  await next()
});
```

**Why This Matters:**
- Browser sends OPTIONS preflight before actual request
- Hono's built-in CORS middleware can't expose x402 payment headers properly
- Wildcard headers (`*`) allow x402 client to read payment response headers
- Must be FIRST middleware or it won't catch OPTIONS requests

**Common Issues:**
- ❌ Using `hono/cors` middleware instead of manual handling → Causes preflight errors
- ❌ Putting CORS middleware after payment middleware → Misses preflight requests
- ❌ Restrictive header lists → Blocks x402 payment headers

---

### 2. x402 Server Initialization (Lines 23-30)

**File:** `x402-demo-server/index.ts`

```typescript
// ⚠️ CRITICAL: Initialize x402 server and register schemes
const facilitatorClient = new HTTPFacilitatorClient({ 
  url: facilitatorUrl 
});
const x402Server = new x402ResourceServer(facilitatorClient);

// Register the AVM scheme for Algorand
const avmServerScheme = new ExactAvmScheme();
x402Server.register(ALGORAND_TESTNET_CAIP2, avmServerScheme);
```

**What This Does:**
- `HTTPFacilitatorClient`: Connects to GoPlausible or self-hosted facilitator for payment verification
- `x402ResourceServer`: Manages payment validation logic
- `ExactAvmScheme`: Implements Algorand-specific payment signing (ExactAvmScheme v2)
- `.register()`: Maps network CAIP-2 identifier to scheme implementation

**Key Constants:**
- `ALGORAND_TESTNET_CAIP2`: `"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="`
- `USDC_TESTNET_ASA_ID`: `"10458941"` (Algorand Standard Asset ID for USDC)

---

### 3. Payment Middleware Configuration (Lines 68-85)

**File:** `x402-demo-server/index.ts`

```typescript
// ⚠️ CRITICAL: Define which routes require payment
const weatherConfig = {
  'GET /weather': {
    accepts: [
      {
        scheme: 'exact',                              // Payment scheme type
        price: '$0.005',                              // Human-readable price
        network: ALGORAND_TESTNET_CAIP2,              // Network identifier
        payTo: avmAddress,                            // Receiver address
        extra: { asset: USDC_TESTNET_ASA_ID },        // Asset ID for payment
      },
    ],
    description: 'Weather data access',
  },
}

// ⚠️ CRITICAL: Apply payment middleware globally
app.use(paymentMiddleware(weatherConfig, x402Server));
```

**Important Details:**

| Field | Purpose | Example |
|-------|---------|---------|
| `scheme` | Payment protocol | `'exact'` (Algorand ExactAvmScheme) |
| `price` | Display price | `'$0.005'` (for UI) |
| `network` | Blockchain network | CAIP-2 format |
| `payTo` | Receiver address | Algorand public key (58 chars) |
| `asset` | Token to accept | USDC = `10458941`, ALGO = no asset |

**How It Works:**
1. Client requests resource without payment
2. Middleware intercepts → returns 402 with payment object
3. Client signs transactions with wallet
4. Client retries with `Payment-Signature` header
5. Middleware validates signature with facilitator
6. If valid → request passes to handler

---

### 4. Resource Handler (Lines 88-97)

**File:** `x402-demo-server/index.ts`

```typescript
// ✅ This handler ONLY executes after payment verified
app.get('/weather', (c) => {
  console.log('✓✓✓ PAYMENT VERIFIED - GET /weather handler reached!')
  return c.json({
    report: {
      weather: 'sunny',
      temperature: 70,
      timestamp: new Date().toISOString(),
    },
  });
});
```

**Important:**
- This handler is **protected by paymentMiddleware**
- Will NEVER execute for unpaid requests
- Middleware returns 402 before this code runs
- Return any JSON response once payment verified

---

## Adding New Paid Endpoints

### Example: Add `/forecast` endpoint with different price

**Step 1: Update config**

```typescript
const weatherConfig = {
  'GET /weather': {
    accepts: [{
      scheme: 'exact',
      price: '$0.005',
      network: ALGORAND_TESTNET_CAIP2,
      payTo: avmAddress,
      extra: { asset: USDC_TESTNET_ASA_ID },
    }],
    description: 'Weather data access',
  },
  'GET /forecast': {  // ← NEW
    accepts: [{
      scheme: 'exact',
      price: '$0.01',  // ← Different price
      network: ALGORAND_TESTNET_CAIP2,
      payTo: avmAddress,
      extra: { asset: USDC_TESTNET_ASA_ID },
    }],
    description: 'Weather forecast access',
  },
}
```

**Step 2: Add handler**

```typescript
app.get('/forecast', (c) => {
  console.log('✓✓✓ PAYMENT VERIFIED - GET /forecast handler reached!')
  return c.json({
    forecast: {
      tomorrow: 'rainy',
      temperature: 65,
      confidence: 0.85,
    },
  });
});
```

**Step 3: Restart server** - Payment middleware automatically protects new route

---

## Environment Configuration

### Production Deployment

For production, update `.env`:

```env
# Production receiver address
AVM_ADDRESS=PROD_ALGORAND_ADDRESS_HERE

# Self-hosted or commercial facilitator
FACILITATOR_URL=https://your-facilitator-domain.com

# Production port
PORT=4021
```

### Facilitator Options

**1. GoPlausible (Hosted)**
```
FACILITATOR_URL=https://facilitator.goplausible.xyz
```
- ✅ No setup required
- ✅ Managed service
- ✅ Free to use
- ⚠️ Depends on external service

**2. Self-Hosted**
- Deploy your own x402 facilitator
- ⚠️ Requires additional infrastructure
- ✅ Full control
- See x402-js documentation for setup

---

## Testing Endpoints

### 1. Health Check (No Payment)

```bash
curl http://localhost:4021/health
```

Response:
```json
{"status":"ok"}
```

### 2. Paid Endpoint (First Request - 402)

```bash
curl http://localhost:4021/weather
```

Response:
```
HTTP/1.1 402 Payment Required
Payment-Required: true
Payment-Response: {...payment object...}

{...payment details...}
```

### 3. With Payment Signature (After Client Signs)

```bash
curl \
  -H "Payment-Signature: eyJ4NDAyVmVyc2lvbiI6MiwiY..." \
  http://localhost:4021/weather
```

Response (on success):
```json
{
  "report": {
    "weather": "sunny",
    "temperature": 70,
    "timestamp": "2026-05-18T08:45:13.271Z"
  }
}
```

---

## Debugging

### Enable Detailed Logging

The server logs all requests:

```
[2026-05-18T08:45:13.271Z] GET /weather
Request Headers: {
  "payment-signature": "eyJ...",
  "origin": "http://localhost:5173",
  ...
}
Response Status: 200
```

### Common Issues

**Issue: Always returns 402 even with signature**
- ✅ Check facilitator is running and reachable
- ✅ Verify payment signature is valid
- ✅ Check client has sufficient USDC balance
- ✅ Verify AVM_ADDRESS is correct receiver

**Issue: CORS error in browser**
- ✅ Ensure CORS middleware is FIRST
- ✅ Check wildcard headers are set: `*`
- ✅ Verify no other middleware modifies headers

**Issue: Payment signature not accepted**
- ✅ Verify client signed with correct scheme (exact)
- ✅ Check network is TestNet (not MainNet)
- ✅ Verify transaction sender has USDC

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    X402 RESOURCE SERVER                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 1. CORS Middleware                                         │ │
│  │    - Handle OPTIONS preflight                              │ │
│  │    - Set wildcard headers (*)                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                               ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 2. Logging Middleware                                      │ │
│  │    - Log request/response                                  │ │
│  │    - Debug payment flow                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                               ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 3. X402 Payment Middleware (CRITICAL)                      │ │
│  │    - Check payment signature header                         │ │
│  │    - Verify with facilitator                               │ │
│  │    - Enforce payment per route                             │ │
│  │                                                             │ │
│  │    x402ResourceServer ─────→ HTTPFacilitatorClient        │ │
│  │         ↓                              ↓                    │ │
│  │    ExactAvmScheme          GoPlausible/Self-hosted         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                               ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 4. Route Handlers (Protected)                              │ │
│  │    - GET /weather  → $0.005 USDC                           │ │
│  │    - GET /forecast → $0.01 USDC                            │ │
│  │    - GET /health   → No payment (public)                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Technologies

- **Framework:** Hono (lightweight web framework)
- **Payment Protocol:** x402 (HTTP 402 Payment Required)
- **Blockchain:** Algorand TestNet
- **Payment Scheme:** ExactAvmScheme (ECDSA signing)
- **Facilitator:** GoPlausible (payment verification)
- **Runtime:** Node.js

---

## References

- [x402 Protocol](https://x402.money)
- [Algorand Developer Docs](https://developer.algorand.org)
- [Hono Documentation](https://hono.dev)
- [GoPlausible Facilitator](https://goplausible.xyz)

---

## License

MIT

---

## Support

For issues or questions about x402 implementation:
1. Check the logging output
2. Verify environment variables
3. Test with health endpoint first
4. Check facilitator connectivity
