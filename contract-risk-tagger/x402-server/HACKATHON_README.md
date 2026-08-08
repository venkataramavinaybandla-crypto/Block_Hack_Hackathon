# x402 Hackathon Backend Server

> **Production-ready x402 payment server** - Perfect starting point for building monetized APIs in ~55 minutes.

## 🚀 Quick Start

```bash
# 1. Install
npm install

# 2. Configure (.env file)
# Copy values to your wallet address
echo 'AVM_ADDRESS=YOUR_WALLET_HERE
FACILITATOR_URL=https://facilitator.goplausible.xyz
PORT=4021' > .env

# 3. Start
npm start

# 4. Server should say:
# ✅ x402 Resource Server is running!
```

## 📁 Project Structure

```
x402-demo-server/
│
├── 📋 endpoints.config.ts    ← Define payment routes (EDIT THIS!)
│   └─ 5+ example endpoints you can uncomment
│
├── 📦 handlers/              ← Business logic (handlers)
│   ├─ weather.ts            ← Example: Simple API response
│   ├─ analytics.ts          ← Example: Premium analytics
│   ├─ ai-analysis.ts        ← Example: AI integration
│   └─ creator-content.ts    ← Example: Creator payments
│
├── 🔑 index.ts              ← Main server (don't modify)
│   └─ Already set up with CORS, middleware, etc.
│
├── ⚙️ package.json          ← Dependencies
├── 🔧 tsconfig.json         ← TypeScript config
├── .env                     ← Your configuration (CREATE THIS!)
└── .env.example             ← Reference template
```

## 🎯 How to Build Your MVP (55 Minutes)

### Minutes 0-5: Setup

```bash
npm install
cp .env.example .env
# Edit .env with your wallet address
npm start
```

### Minutes 5-40: Build Endpoint

**1. Choose your idea** (from EXAMPLE IDEAS below)

**2. Define endpoint** in `endpoints.config.ts`:
```typescript
'GET /my-api': {
  accepts: [{
    scheme: 'exact',
    price: '$0.005',  // Your price
    network: ALGORAND_TESTNET_CAIP2,
    payTo: avmAddress,
    extra: { asset: USDC_TESTNET_ASA_ID },
  }],
  description: 'Your description',
},
```

**3. Create handler** in `handlers/my-api.ts`:
```typescript
import type { Context } from 'hono';

export function handleMyApi(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - processing request');
    
    // Your business logic:
    // - Call external API
    // - Query database
    // - Compute something
    // - Generate data
    
    return c.json({
      data: 'Your result here',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error:', error);
    return c.json({ error: 'Failed' }, 500);
  }
}
```

**4. Register handler** in `index.ts`:
```typescript
// At top
import { handleMyApi } from './handlers/my-api';

// In ROUTE HANDLERS section
app.get('/my-api', handleMyApi);
```

**5. Test**:
```bash
curl http://localhost:4021/my-api
# Should return 402 Payment Required ✓
```

### Minutes 40-55: Polish & Demo

- Test in browser at `http://localhost:5173`
- Verify payment flow works
- Add error handling
- Prepare 2-min pitch

## 💡 Example Ideas (Pick One!)

### 🤖 AI-Powered Features
```
Endpoint: POST /analyze
Price: $0.001 per request
Flow: User pays → AI analyzes → Returns results
Implementation: 
- Call OpenAI/Hugging Face API
- Charge per request
- Users get premium analysis
Tech: fetch API, JSON parsing
```

### 📊 Analytics Dashboard
```
Endpoint: GET /analytics?user_id=123
Price: $0.01 per dashboard
Flow: User pays → Calculate metrics → Return dashboard
Implementation:
- Query data, compute stats
- Generate insights
- Return formatted analytics
Tech: Map/reduce for aggregation
```

### 🎨 Creator Content
```
Endpoint: GET /exclusive/:id
Price: Varies by creator
Flow: Fan pays creator → Get exclusive content
Implementation:
- Store content by creator
- Track payments & payouts
- Verify payment → unlock content
Tech: Database, user management
```

### 🔍 Premium Search
```
Endpoint: GET /search?q=term
Price: $0.001 per search
Flow: User pays → Search database → Return results
Implementation:
- Full-text search, filters
- Sort by relevance
- Cache popular searches
Tech: Database indexing
```

### 📸 Image Processing
```
Endpoint: POST /enhance-image
Price: $0.02 per image
Flow: User pays → Process image → Return result
Implementation:
- Accept image upload
- Apply filters/effects
- Return enhanced image
Tech: Sharp, Jimp, Canvas
```

### 🌐 API Proxy
```
Endpoint: GET /proxy?url=...
Price: $0.005 per call
Flow: User pays → Call external API → Return data
Implementation:
- Bypass rate limits
- Add auth headers
- Cache responses
Tech: Axios/fetch forwarding
```

### 💬 AI Chat
```
Endpoint: POST /chat
Price: $0.001 per message
Flow: User pays → Chat with AI → Get response
Implementation:
- Maintain conversation history
- Call LLM API
- Return response tokens
Tech: Array for history, fetch for API
```

### 📚 Knowledge Base
```
Endpoint: GET /docs/:page
Price: $0.002 per page
Flow: User pays → Fetch premium docs → Return
Implementation:
- Store as markdown/JSON
- Add search functionality
- Track popular pages
Tech: File system or DB
```

### 🎯 Leaderboards
```
Endpoint: GET /leaderboard
Price: $0.001 per view
Flow: User pays → Get top scores → Display
Implementation:
- Sort users by score
- Add filters/timeframes
- Real-time rankings
Tech: Array sorting, caching
```

### 🎟️ Ticketing
```
Endpoint: POST /mint-ticket
Price: $0.05 per ticket
Flow: User pays → Mint NFT ticket → Return
Implementation:
- Generate unique ticket ID
- Create on-chain record
- Return ticket details
Tech: Algorand SDK for minting
```

## ✅ Testing Your Endpoint

### Test 1: Payment Required (No Auth)
```bash
curl -i http://localhost:4021/my-endpoint
```
Expected: `402 Payment Required` ✓

### Test 2: Browser Full Flow
1. Go to `http://localhost:5173`
2. Connect wallet
3. Click your endpoint
4. Approve in wallet
5. See data returned ✓

### Test 3: Check Logs
```
[timestamp] GET /my-endpoint
✓ PAYMENT VERIFIED - handler executing
Response: 200
```

### Test 4: Check Server Health
```bash
curl http://localhost:4021/health
# Returns: {"status":"ok"}
```

## 📚 What's Already Set Up

✅ **CORS Middleware** - Handles browser cross-origin requests  
✅ **x402 Payment Middleware** - Enforces payment on protected routes  
✅ **Error Handling** - Try/catch patterns in place  
✅ **Logging** - Console output for debugging  
✅ **Type Safety** - TypeScript configured  
✅ **Environment Variables** - .env support  
✅ **Hot Reload** - Changes auto-apply (npm run dev)  

## 🔧 Common Patterns

### Pattern 1: Simple Return
```typescript
export function handler(c: Context) {
  return c.json({ result: 'data' });
}
```

### Pattern 2: Query Parameters
```typescript
export function handler(c: Context) {
  const param = c.req.query('name');
  return c.json({ received: param });
}
```

### Pattern 3: URL Parameters
```typescript
export function handler(c: Context) {
  const id = c.req.param('id');  // From /items/:id
  return c.json({ id });
}
```

### Pattern 4: POST Body
```typescript
export async function handler(c: Context) {
  const body = await c.req.json();
  return c.json({ received: body });
}
```

### Pattern 5: External API
```typescript
export async function handler(c: Context) {
  try {
    const res = await fetch('https://api.example.com/data');
    const data = await res.json();
    return c.json(data);
  } catch (error) {
    return c.json({ error: 'API failed' }, 500);
  }
}
```

## ⚠️ Important Notes

- **Handler only runs AFTER payment verified** - x402 middleware handles 402 response automatically
- **No database needed** - Return mock data for demo
- **No authentication needed** - x402 handles access control  
- **Price is fixed** - Set in `endpoints.config.ts`
- **TestNet only** - Needs TestNet USDC (get from [faucet](https://dispenser.testnet.algorand.network))

## 🚨 Troubleshooting

### ❌ "Port 4021 already in use"
```bash
lsof -ti:4021 | xargs kill -9
npm start
```

### ❌ "Cannot find handler"
- Check import path matches file location
- Verify filename is `handlers/my-file.ts`
- Check function is exported: `export function handleX()`

### ❌ "402 always returns"
- Wallet not connected in frontend
- No USDC on TestNet (need 0.005+ minimum)
- Check `AVM_ADDRESS` in `.env` is correct

### ❌ CORS error in browser
- Restart backend: `npm start`
- Check CORS middleware is enabled in `index.ts`

## 🎬 During Presentation

**Pitch (2 minutes):**
- Problem your API solves
- How x402 improves it  
- Target customer/use case

**Demo (1 minute):**
- Show wallet connected
- Trigger payment request
- Show payment in wallet
- See data returned ✓

## 📚 Documentation

- **[HACKATHON_STARTER_KIT.md](../HACKATHON_STARTER_KIT.md)** - Full guide with examples
- **[X402_IMPLEMENTATION_GUIDE.md](../X402_IMPLEMENTATION_GUIDE.md)** - Protocol deep dive
- **[X402_CRITICAL_REFERENCE.md](../X402_CRITICAL_REFERENCE.md)** - Code reference
- **[ARCHITECTURE.md](../ARCHITECTURE.md)** - System design

## 🛠️ Tech Stack

- **Framework:** Hono (lightweight, fast)
- **Language:** TypeScript (type-safe)
- **Payment:** x402 protocol
- **Blockchain:** Algorand TestNet
- **Facilitator:** GoPlausible (hosted)

## 📦 Dependencies

- `hono` - Web framework
- `@x402/hono` - Payment middleware
- `@x402/core` - x402 server logic
- `@hono/node-server` - HTTP server
- `typescript` - Type checking

## 🎯 Key Files to Modify

| File | Purpose | Action |
|------|---------|--------|
| `.env` | Configuration | CREATE & fill |
| `endpoints.config.ts` | Define routes | UNCOMMENT/ADD |
| `handlers/*.ts` | Business logic | CREATE |
| `index.ts` | Register route | ADD app.get() line |

## ✨ Tips for Success

1. **Start simple** - Return mock data first
2. **Test with curl** - Before browser testing
3. **Read the logs** - They tell you what's happening
4. **Look at examples** - handlers/ has 4 examples
5. **Error handling** - Always wrap in try/catch
6. **Use QUICK_REFERENCE.ts** - Copy/paste templates

## 🚀 Ready to Deploy?

This server works on TestNet. To go to production:

1. Use MainNet endpoints
2. Update FACILITATOR_URL
3. Deploy to Vercel/Heroku/AWS
4. Update frontend API_BASE_URL
5. Use real USDC (live trading)

## 💡 Need Ideas?

Check [HACKATHON_STARTER_KIT.md](../HACKATHON_STARTER_KIT.md) for 10+ example ideas you can build in 55 minutes.

---

**Let's go monetize the web! 💰**

Questions? Check the main documentation or ask an AlgoBharat mentor.

**Time to build: ~55 minutes | Complexity: Beginner-Friendly | Impact: Production-Ready**
