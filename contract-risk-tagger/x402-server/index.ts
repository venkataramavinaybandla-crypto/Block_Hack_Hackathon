/**
 * 🐕‍🦺 CERBERUS — x402 AI Legal Contract Risk Analyzer
 *
 * Architecture:
 *   Browser → CERBERUS Gateway (Node.js/Hono, port 4021)
 *               ├── No payment header       → HTTP 402 (payment-required header per x402 spec)
 *               ├── x402 Signed Payload     → Verified via @x402/hono & GoPlausible facilitator
 *               └── Direct TxID (On-Chain)  → Verification via Algorand Testnet Indexer
 *                                               │ (Confirmed on-chain, Amount >= 10000, Replay Protection)
 *                                               ▼
 *                                       Python AI Backend (port 8000, Localhost Only)
 *                                       └── Ollama mistral:latest → JSON clause risk analysis
 *
 * Production hardening:
 *   - DEMO_MODE disabled by default (opt-in only via .env)
 *   - TX age window tightened to 5 minutes (matches x402 maxTimeoutSeconds: 300)
 *   - Per-IP rate limiting (configurable via RATE_LIMIT_RPM)
 *   - CORS locked to ALLOWED_ORIGIN env var
 *   - TxID sanitized/validated before on-chain lookup
 *   - Structured JSON audit log for every payment event
 *   - Graceful SIGTERM / SIGINT shutdown
 */

import { config } from 'dotenv';
import path from 'path';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { paymentMiddleware } from '@x402/hono';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import type { ResourceServerExtension } from '@x402/core/types';
import { ExactAvmScheme } from '@x402/avm/exact/server';
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from '@x402/avm';
import { bazaarResourceServerExtension, declareDiscoveryExtension } from '@x402-avm/extensions';

// Our contract analysis handler + shared internal-secret helper
import { handleContractAnalysis, requireInternalSecret } from './handlers/contract-analysis';

// Load .env relative to THIS module (x402-server/.env) so the server works
// regardless of the working directory it is started from.
config({ path: path.join(__dirname, '.env') });

// ════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════════════════════════════════════

const avmAddress     = process.env.AVM_ADDRESS || '2TXWLUCA3XVUNDNEFSI6GNSFDD7KXZMQDAWJOYKTZMBMXNZWTXYT73AGCU';
const facilitatorUrl = process.env.FACILITATOR_URL || 'https://facilitator.goplausible.xyz';
const port           = parseInt(process.env.PORT || '4021', 10);
const aiBackendUrl   = process.env.AI_BACKEND_URL || 'http://localhost:8000';
const expectedAssetId = Number(USDC_TESTNET_ASA_ID) || 10458941;
const expectedAmount  = 10000; // 10,000 micro units ($0.01)

// ALLOWED_ORIGIN — set this in production to your frontend's exact origin.
// Defaults to '*' for local development only.
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';

// RATE_LIMIT_RPM — maximum requests per IP per minute on the paid endpoint.
const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '10', 10);

// INTERNAL_SECRET — NO hardcoded fallback. Shared with the Python AI backend.
const INTERNAL_SECRET_GATEWAY = requireInternalSecret();

// ════════════════════════════════════════════════════════════════════
// DEMO / INSTANT-EXECUTION MODE (opt-in only, off by default in prod)
// ════════════════════════════════════════════════════════════════════
// Set DEMO_MODE=true in .env ONLY for local demonstrations.
// In production this MUST be false (or unset).
// The demo TxID bypasses the Algorand Testnet Indexer check — it is
// NOT a real payment verification and must never reach production.
const DEMO_MODE = (process.env.DEMO_MODE ?? 'false') === 'true';
const DEMO_TXID = process.env.DEMO_TXID || '';

if (DEMO_MODE) {
  console.warn('\n⚠️  WARNING: DEMO_MODE is ON — indexer verification is bypassed for the demo TxID.');
  console.warn('   This is NOT suitable for production. Set DEMO_MODE=false in x402-server/.env.\n');
}

// ════════════════════════════════════════════════════════════════════
// REPLAY ATTACK PREVENTION
// ════════════════════════════════════════════════════════════════════
// In-memory set — cleared on restart. With the 5-minute age window the
// practical replay surface is small. For full persistence use Redis/SQLite.
const usedTxIds = new Set<string>();

// ════════════════════════════════════════════════════════════════════
// STRUCTURED AUDIT LOG
// ════════════════════════════════════════════════════════════════════
interface AuditEvent {
  ts?: string; // injected by auditLog(); callers omit it
  event: 'payment_attempt' | 'payment_success' | 'payment_rejected' | 'rate_limited' | 'analysis_complete' | 'analysis_error';
  ip?: string;
  txId?: string;
  reason?: string;
  clauses?: number;
  durationMs?: number;
}

function auditLog(event: AuditEvent): void {
  // Write structured JSON to stdout — can be piped to a log aggregator
  process.stdout.write(JSON.stringify({ ...event, ts: new Date().toISOString() }) + '\n');
}

// ════════════════════════════════════════════════════════════════════
// IN-MEMORY RATE LIMITER (token bucket, per-IP)
// ════════════════════════════════════════════════════════════════════
const rateBuckets = new Map<string, { tokens: number; lastRefill: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const REFILL_INTERVAL_MS = 60_000;
  let bucket = rateBuckets.get(ip);

  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_RPM, lastRefill: now };
    rateBuckets.set(ip, bucket);
  }

  // Refill on new interval
  if (now - bucket.lastRefill >= REFILL_INTERVAL_MS) {
    bucket.tokens = RATE_LIMIT_RPM;
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) return true;
  bucket.tokens--;
  return false;
}

// Periodically clean up stale rate-limit buckets (every 5 min)
setInterval(() => {
  const cutoff = Date.now() - 5 * 60_000;
  rateBuckets.forEach((bucket, ip) => {
    if (bucket.lastRefill < cutoff) rateBuckets.delete(ip);
  });
}, 5 * 60_000);

// ════════════════════════════════════════════════════════════════════
// TXID INPUT VALIDATION
// ════════════════════════════════════════════════════════════════════
// Algorand TxIDs are 52-character base32 (uppercase A-Z, 2-7) strings.
// Sanitize before passing to the indexer API.
const TXID_REGEX = /^[A-Z2-7]{52}$/;

function sanitizeTxId(raw: string): string | null {
  const cleaned = (raw || '').trim().toUpperCase().replace(/\s/g, '');
  if (!TXID_REGEX.test(cleaned)) return null;
  return cleaned;
}

// ════════════════════════════════════════════════════════════════════
// STARTUP LOG
// ════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log('🐕‍🦺 CERBERUS — x402 AI Legal Contract Risk Analyzer');
console.log('═'.repeat(60));
console.log('Configuration:');
console.log(`  Receiver Address : ${avmAddress}`);
console.log(`  Expected Asset ID: ${expectedAssetId} (USDC Testnet)`);
console.log(`  Expected Amount  : ${expectedAmount} microunits ($0.01)`);
console.log(`  Facilitator URL  : ${facilitatorUrl}`);
console.log(`  AI Backend       : ${aiBackendUrl}`);
console.log(`  Port             : ${port}`);
console.log(`  CORS Origin      : ${allowedOrigin}`);
console.log(`  Rate Limit       : ${RATE_LIMIT_RPM} req/min per IP`);
console.log(`  TX Max Age       : 300 s (5 minutes)`);
console.log(`  Demo Mode        : ${DEMO_MODE ? 'ON ⚠️' : 'OFF ✅'}`);
console.log('═'.repeat(60) + '\n');

// ════════════════════════════════════════════════════════════════════
// x402 RESOURCE SERVER SETUP
// ════════════════════════════════════════════════════════════════════

const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const x402Server = new x402ResourceServer(facilitatorClient)
  .register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme())
  .registerExtension(bazaarResourceServerExtension as unknown as ResourceServerExtension);

// ════════════════════════════════════════════════════════════════════
// HONO APP
// ════════════════════════════════════════════════════════════════════

const app = new Hono();

// ── CORS middleware (must be first) ──────────────────────────────────
app.use('*', async (c, next) => {
  const origin = c.req.header('origin') || '';

  // In production, only reflect the configured origin. In dev (ALLOWED_ORIGIN='*') pass-through.
  const reflect = allowedOrigin === '*' ? '*' : (origin === allowedOrigin ? origin : '');

  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods':  'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':  'Content-Type, payment-signature, X-Payment-TxID',
    'Access-Control-Expose-Headers': 'payment-required, X-RateLimit-Remaining',
    'Access-Control-Max-Age':        '600',
    'Vary':                          'Origin',
  };

  if (reflect) {
    corsHeaders['Access-Control-Allow-Origin'] = reflect;
  }

  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  Object.entries(corsHeaders).forEach(([k, v]) => c.header(k, v));
  await next();
});

// ── Request logger ────────────────────────────────────────────────
app.use('*', async (c, next) => {
  const ts = new Date().toISOString();
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  console.log(`\n[${ts}] ${c.req.method} ${c.req.path} (ip: ${ip})`);

  const paymentSig = c.req.header('payment-signature') || c.req.header('X-Payment-TxID') || c.req.header('x-payment-txid');
  if (paymentSig) {
    // Log first 12 chars only — don't echo the full TxID to the console log level
    console.log(`  ✓ Payment proof header present: ${paymentSig.substring(0, 12)}...`);
  } else {
    console.log('  ⚡ No payment proof header — will trigger x402 402 challenge if protected');
  }

  await next();
  console.log(`  → Response Status: ${c.res.status}`);
});

// ════════════════════════════════════════════════════════════════════
// PAYMENT CONFIG
// ════════════════════════════════════════════════════════════════════

const paymentConfig = {
  'POST /analyze-contract': {
    accepts: [
      {
        scheme: 'exact' as const,
        price: '$0.01',
        network: ALGORAND_TESTNET_CAIP2,
        payTo: avmAddress,
        extra: { asset: expectedAssetId },
      },
    ],
    description: 'CERBERUS AI Contract Risk Analysis — Pay $0.01 USDC per analysis',
    extensions: declareDiscoveryExtension({
      bodyType: 'json',
      input: { contract_text: '<paste your contract here>' },
      inputSchema: {
        properties: {
          contract_text: { type: 'string', description: 'Full contract text to analyze' },
        },
        required: ['contract_text'],
      },
      output: {
        example: [
          {
            clause: 'The Client shall indemnify the Service Provider...',
            risk_level: 'high',
            reason: 'Unlimited indemnification even for provider negligence',
            suggested_rewrite: 'Indemnification limited to Client negligence only',
          },
        ],
      },
    }),
  },
};

console.log('📋 Registered CERBERUS Protected Endpoints:');
Object.entries(paymentConfig).forEach(([route, cfg]) => {
  const price = cfg.accepts[0]?.price || 'unknown';
  console.log(`   ${route} → ${price} USDC on Algorand Testnet`);
});
console.log();

/**
 * Strict On-Chain TxID Verification for Algorand Testnet
 *
 * Production checks (ALL must pass):
 * 0. Demo mode bypass — only when DEMO_MODE=true AND txId === DEMO_TXID (disabled in prod)
 * 1. TxID format — 52-char Algorand base32 (validated before this function)
 * 2. Replay protection — TxID must NOT have been used in this session
 * 3. Transaction confirmed on Algorand Testnet Indexer (confirmed-round > 0)
 * 4. Transaction type — MUST be ASA asset-transfer (reject native ALGO pay)
 * 5. Asset ID — must equal expectedAssetId (10458941 = USDC Testnet)
 * 6. Receiver — must equal avmAddress (CERBERUS wallet)
 * 7. Amount — must be >= expectedAmount (10000 microunits)
 * 8. Age — round-time must be within last 5 minutes (300 seconds)
 */
const TX_MAX_AGE_SECONDS = 300; // 5 minutes — matches x402 spec maxTimeoutSeconds

async function verifyTxIdOnChain(txId: string): Promise<{ valid: boolean; reason?: string }> {
  // 0. DEMO MODE — instant execution for the configured demo TxID.
  //    Only active when DEMO_MODE=true in .env (never the default in production).
  //    Demo TxIDs are NOT added to usedTxIds — they can be re-run without restart.
  if (DEMO_MODE && DEMO_TXID && txId === DEMO_TXID) {
    console.log(`  🎬 DEMO MODE — demo TxID accepted instantly (indexer check skipped): ${txId}`);
    auditLog({ event: 'payment_success', txId, reason: 'demo_mode_bypass' });
    return { valid: true };
  }

  // 1. Replay attack check
  if (usedTxIds.has(txId)) {
    console.warn(`  ❌ Replay Attack Prevented: TxID ${txId.slice(0, 12)}... has already been spent`);
    auditLog({ event: 'payment_rejected', txId, reason: 'replay_attack' });
    return { valid: false, reason: 'Transaction ID has already been used. Each analysis requires a fresh payment.' };
  }

  try {
    const url = `https://testnet-idx.algonode.cloud/v2/transactions/${txId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (res.status === 404) {
      auditLog({ event: 'payment_rejected', txId, reason: 'txid_not_found' });
      return { valid: false, reason: 'Transaction ID not found on Algorand Testnet. Ensure the payment is confirmed (wait ~4 seconds after sending).' };
    }
    if (!res.ok) {
      auditLog({ event: 'payment_rejected', txId, reason: `indexer_error_${res.status}` });
      return { valid: false, reason: `Algorand Indexer returned an error (HTTP ${res.status}). Please try again shortly.` };
    }

    const data = await res.json();
    const tx = data.transaction;

    // 2. Must be confirmed
    if (!tx || !tx['confirmed-round'] || tx['confirmed-round'] <= 0) {
      auditLog({ event: 'payment_rejected', txId, reason: 'unconfirmed' });
      return { valid: false, reason: 'Transaction is pending or failed. Wait for it to be confirmed on-chain before submitting.' };
    }

    // 3. Must be an ASA asset-transfer — reject native ALGO pay transactions
    const assetTx = tx['asset-transfer-transaction'];
    if (!assetTx) {
      const txType = tx['tx-type'] || 'unknown';
      console.warn(`  ❌ Rejected: tx-type "${txType}" — only ASA asset-transfers (axfer) accepted`);
      auditLog({ event: 'payment_rejected', txId, reason: `wrong_tx_type:${txType}` });
      return {
        valid: false,
        reason: `Only USDC asset-transfer transactions are accepted (got tx-type="${txType}"). Please send USDC (ASA ${expectedAssetId}), not native ALGO.`,
      };
    }

    const assetId  = assetTx['asset-id'];
    const receiver = assetTx['receiver'] || '';
    const amount   = assetTx['amount'] || 0;

    // 4. Asset ID must be the USDC testnet ASA
    if (assetId !== expectedAssetId) {
      console.warn(`  ❌ Wrong asset: got ASA ${assetId}, required ASA ${expectedAssetId}`);
      auditLog({ event: 'payment_rejected', txId, reason: `wrong_asset:${assetId}` });
      return { valid: false, reason: `Wrong token sent. Got ASA ${assetId}, required ASA ${expectedAssetId} (USDC on Algorand Testnet).` };
    }

    // 5. Receiver must be the CERBERUS wallet
    if (receiver !== avmAddress) {
      console.warn(`  ❌ Wrong receiver: got ${receiver.slice(0, 12)}..., required ${avmAddress.slice(0, 12)}...`);
      auditLog({ event: 'payment_rejected', txId, reason: 'wrong_receiver' });
      return {
        valid: false,
        reason: `Payment sent to wrong address (got: ${receiver.slice(0, 8)}...). Please send to the displayed CERBERUS wallet address.`,
      };
    }

    // 6. Amount must meet minimum
    if (amount < expectedAmount) {
      console.warn(`  ❌ Amount too low: ${amount} < ${expectedAmount} microunits`);
      auditLog({ event: 'payment_rejected', txId, reason: `insufficient_amount:${amount}` });
      return {
        valid: false,
        reason: `Payment amount too low: sent ${amount} microunits, required ${expectedAmount} microunits ($0.01 USDC).`,
      };
    }

    // 7. Transaction age — round-time is a Unix timestamp in seconds.
    //    Use strict typeof check so null/undefined never silently pass.
    const roundTime = tx['round-time'];
    if (typeof roundTime !== 'number') {
      console.warn('  ❌ Rejected: transaction has no valid round-time');
      auditLog({ event: 'payment_rejected', txId, reason: 'missing_round_time' });
      return { valid: false, reason: 'Transaction is missing a timestamp. Cannot verify it is recent.' };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const ageSec = nowSec - roundTime;
    if (ageSec > TX_MAX_AGE_SECONDS) {
      const ageMin = Math.floor(ageSec / 60);
      console.warn(`  ❌ Transaction too old: ${ageMin} min (max ${TX_MAX_AGE_SECONDS / 60} min)`);
      auditLog({ event: 'payment_rejected', txId, reason: `tx_too_old:${ageMin}min` });
      return {
        valid: false,
        reason: `Transaction is ${ageMin} minutes old. For security, only payments from the last ${TX_MAX_AGE_SECONDS / 60} minutes are accepted. Please submit a fresh payment.`,
      };
    }

    // All checks passed — mark as spent
    usedTxIds.add(txId);
    console.log(`  ✅ On-Chain Verification Passed: TxID ${txId.slice(0, 12)}...`);
    console.log(`     Round: ${tx['confirmed-round']} | Asset: ASA ${assetId} | Amount: ${amount} | Age: ${ageSec}s`);
    auditLog({ event: 'payment_success', txId });
    return { valid: true };

  } catch (e: any) {
    const isTimeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    const reason = isTimeout ? 'indexer_timeout' : 'indexer_exception';
    console.warn(`  ⚠️ Indexer check failed for TxID ${txId.slice(0, 12)}...:`, isTimeout ? 'timeout' : e?.message || e);
    auditLog({ event: 'payment_rejected', txId, reason });
    return {
      valid: false,
      reason: isTimeout
        ? 'Algorand Indexer did not respond in time. Please try again in a few seconds.'
        : 'Could not verify payment on-chain. Please try again.',
    };
  }
}

// ════════════════════════════════════════════════════════════════════
// RATE LIMITER MIDDLEWARE (applied to paid endpoint only)
// ════════════════════════════════════════════════════════════════════
app.use('/analyze-contract', async (c, next) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  if (isRateLimited(ip)) {
    console.warn(`  ⚡ Rate limited: ${ip}`);
    auditLog({ event: 'rate_limited', ip });
    return c.json(
      { error: 'Too many requests. Please wait a moment before trying again.', retryAfterSeconds: 60 },
      429
    );
  }

  // Expose remaining tokens
  const bucket = rateBuckets.get(ip);
  if (bucket) c.header('X-RateLimit-Remaining', String(bucket.tokens));

  await next();
});

// ════════════════════════════════════════════════════════════════════
// TxID INTERCEPTOR — direct on-chain verification before x402 middleware
// ════════════════════════════════════════════════════════════════════
app.use('/analyze-contract', async (c, next) => {
  const rawHeader =
    c.req.header('payment-signature') ||
    c.req.header('X-Payment-TxID') ||
    c.req.header('x-payment-txid') ||
    '';

  // Only intercept raw TxIDs — pass through x402 signed payloads (JSON / base64-JWT)
  if (rawHeader && !rawHeader.startsWith('{') && !rawHeader.startsWith('eyJ')) {

    // Sanitize before doing anything with the user-supplied value
    const txId = sanitizeTxId(rawHeader);
    if (!txId) {
      console.log(`  ❌ Invalid TxID format: "${rawHeader.slice(0, 20)}..."`);
      auditLog({ event: 'payment_rejected', reason: 'invalid_txid_format' });
      return c.json(
        {
          error: 'Invalid transaction ID format.',
          detail: 'A valid Algorand transaction ID is exactly 52 characters, uppercase letters A–Z and digits 2–7.',
          payTo: avmAddress,
          amount: expectedAmount,
          assetId: expectedAssetId,
        },
        402
      );
    }

    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    console.log(`  🔍 On-Chain Check for TxID: ${txId.slice(0, 12)}... (ip: ${ip})`);
    auditLog({ event: 'payment_attempt', ip, txId });

    const result = await verifyTxIdOnChain(txId);

    if (result.valid) {
      return handleContractAnalysis(c);
    } else {
      console.log(`  ❌ TxID Rejected: ${result.reason}`);
      return c.json(
        {
          error: 'Payment verification failed.',
          detail: result.reason,
          payTo: avmAddress,
          amount: expectedAmount,
          assetId: expectedAssetId,
          fundingGuide: 'https://lora.algokit.io/testnet/fund',
        },
        402
      );
    }
  }

  await next();
});

// Apply x402 payment middleware.
// NOTE: paymentMiddleware only gates routes in paymentConfig.
// Free routes (/health, /info, /extract-text) pass straight through.
app.use(paymentMiddleware(paymentConfig as any, x402Server));

// ════════════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════════════

// FREE — server-side text extraction for uploaded contract documents
app.post('/extract-text', async (c) => {
  try {
    const body = await c.req.json();
    const { file_name, file_b64 } = body;
    if (!file_b64 || typeof file_b64 !== 'string' || file_b64.length < 10) {
      return c.json({ error: 'file_b64 (base64) and file_name are required' }, 400);
    }

    // Validate file_name doesn't contain path traversal
    const safeName = (file_name || 'contract.txt').replace(/[^a-zA-Z0-9._-]/g, '_');

    const aiResponse = await fetch(`${aiBackendUrl}/extract-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET_GATEWAY,
      },
      body: JSON.stringify({ file_name: safeName, file_b64 }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      const status = [400, 413, 422].includes(aiResponse.status) ? aiResponse.status : 502;
      return c.json({ error: 'Text extraction failed.', detail: errText }, status as any);
    }
    return c.json(await aiResponse.json(), 200);
  } catch (e: any) {
    if (e?.name === 'TimeoutError') {
      return c.json({ error: 'Text extraction timed out.' }, 504);
    }
    return c.json({ error: 'Extraction error. Please try again.' }, 500);
  }
});

app.post('/analyze-contract', handleContractAnalysis);

app.get('/health', async (c) => {
  let aiStatus = 'unknown';
  try {
    const r = await fetch(`${aiBackendUrl}/health`, { signal: AbortSignal.timeout(3000) });
    aiStatus = r.ok ? 'ok' : `error:${r.status}`;
  } catch { aiStatus = 'unreachable'; }

  return c.json({
    status: 'ok',
    service: 'CERBERUS — x402 Contract Risk Gateway',
    version: '2.0.0',
    uptime_seconds: Math.floor(process.uptime()),
    algorand_network: 'testnet',
    receiver_address: avmAddress,
    demo_mode: DEMO_MODE,
    rate_limit_rpm: RATE_LIMIT_RPM,
    tx_max_age_seconds: TX_MAX_AGE_SECONDS,
    ai_backend: { url: aiBackendUrl, status: aiStatus },
  });
});

app.get('/info', (c) => c.json({
  service: 'CERBERUS — AI Legal Contract Risk Analyzer',
  version: '2.0.0',
  network: 'Algorand TestNet',
  receiver: avmAddress,
  payment: '$0.01 USDC (ASA 10458941)',
  tx_max_age_seconds: TX_MAX_AGE_SECONDS,
  endpoints: [
    { method: 'POST', path: '/analyze-contract', protected: true,  price: '$0.01 USDC' },
    { method: 'POST', path: '/extract-text',     protected: false, price: 'free'       },
    { method: 'GET',  path: '/health',           protected: false, price: 'free'       },
    { method: 'GET',  path: '/info',             protected: false, price: 'free'       },
  ],
  fund_wallet: 'https://lora.algokit.io/testnet/fund',
  testnet_explorer: `https://testnet.explorer.perawallet.app/address/${avmAddress}`,
}));

app.notFound((c) => c.json({
  error: 'Endpoint not found',
  path: c.req.path,
  hint: 'Try GET /health or GET /info',
}, 404));

// Export app for Vercel serverless & testing
export { app };
export default app;

// ════════════════════════════════════════════════════════════════════
// START + GRACEFUL SHUTDOWN (Node.js standalone mode only)
// ════════════════════════════════════════════════════════════════════

if (!process.env.VERCEL) {
  const server = serve({ fetch: app.fetch, port }, () => {
    console.log('\n✅ CERBERUS x402 Gateway Server is RUNNING!\n');
    console.log('═'.repeat(60));
    console.log(`  CERBERUS Gateway : http://localhost:${port}`);
    console.log(`  Health           : http://localhost:${port}/health`);
    console.log(`  Info             : http://localhost:${port}/info`);
    console.log(`  AI Backend       : ${aiBackendUrl}`);
    console.log('═'.repeat(60));
  });

  function gracefulShutdown(signal: string) {
    console.log(`\n[shutdown] ${signal} received — closing CERBERUS gateway...`);
    auditLog({ event: 'analysis_complete', reason: `shutdown:${signal}` });
    (server as any).close?.(() => {
      console.log('[shutdown] Server closed cleanly.');
      process.exit(0);
    });
    setTimeout(() => {
      console.warn('[shutdown] Force-exiting after timeout.');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
}