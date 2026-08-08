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

// Valid checksummed Algorand Testnet receiver address (generated for CERBERUS).
const avmAddress     = process.env.AVM_ADDRESS || '3LMI2BONQHGE6SCKLONQYJQCYIA5R32P5PEXLNXKUQS3CAMXRDDLBV342I';
const facilitatorUrl = process.env.FACILITATOR_URL || 'https://facilitator.goplausible.xyz';
const port           = parseInt(process.env.PORT || '4021', 10);
const aiBackendUrl   = process.env.AI_BACKEND_URL || 'http://localhost:8000';
const expectedAssetId = Number(USDC_TESTNET_ASA_ID) || 10458941;
const expectedAmount  = 10000; // 10,000 micro units ($0.01)

// INTERNAL_SECRET — NO hardcoded fallback. Shared with the Python AI backend.
// Imported from handlers/contract-analysis.ts (single source of truth).
const INTERNAL_SECRET_GATEWAY = requireInternalSecret();

// ════════════════════════════════════════════════════════════════════
// DEMO / INSTANT-EXECUTION MODE
// ════════════════════════════════════════════════════════════════════
// The Algorand Testnet USDC asset (ASA 10458941) has no active faucet or
// recent transfers, so a pre-filled demo TxID is accepted instantly for
// hackathon demos. ALL other TxIDs still get strict on-chain verification
// (indexer, tx-type, asset, receiver, amount, age, replay).
//
// Opt-in ONLY via .env (no hardcoded default — consistent with the project's
// security stance). DEMO_MODE=false (or unset) → strict on-chain checks for
// every TxID. DEMO_TXID overrides the accepted demo TxID.
const DEMO_MODE = (process.env.DEMO_MODE ?? 'false') === 'true';
const DEMO_TXID = process.env.DEMO_TXID || 'SIAKOLZAYLX3UZK5IL26SLDUDN523ZNSU65HF4CEYS4YOP5WDVKQ';

// Replay Attack Prevention
const usedTxIds = new Set<string>();

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
console.log(`  Demo Mode        : ${DEMO_MODE ? 'ON' : 'OFF'} (demo TxID: ${DEMO_TXID})`);
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

// CORS — must be first
app.use('*', async (c, next) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin':   '*',
    'Access-Control-Allow-Methods':  'GET, POST, OPTIONS, PUT, DELETE, HEAD',
    'Access-Control-Allow-Headers':  '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Max-Age':        '86400',
  };
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  Object.entries(corsHeaders).forEach(([k, v]) => c.header(k, v));
  await next();
});

// Request logger
app.use('*', async (c, next) => {
  const ts = new Date().toISOString();
  console.log(`\n[${ts}] ${c.req.method} ${c.req.path}`);

  const paymentSig = c.req.header('payment-signature') || c.req.header('X-Payment-TxID') || c.req.header('x-payment-txid');
  if (paymentSig) {
    console.log(`  ✓ Payment proof header present: ${paymentSig.substring(0, 20)}...`);
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
 * Checks (all must pass):
 * 1. Replay protection: TxID must NOT have been used in this session
 * 2. Transaction confirmed on Algorand Testnet Indexer (confirmed-round > 0)
 * 3. Transaction type: MUST be an ASA asset-transfer (reject native ALGO "pay" transactions)
 * 4. Asset ID: must equal expectedAssetId (10458941 = USDC Testnet)
 * 5. Receiver: must equal avmAddress (CERBERUS wallet)
 * 6. Amount: must be >= expectedAmount (10000 microunits)
 * 7. Age: transaction round-time must be within the last 1 hour (~3600 seconds)
 */
const TX_MAX_AGE_SECONDS = 3600; // 1 hour

async function verifyTxIdOnChain(txId: string): Promise<{ valid: boolean; reason?: string }> {
  if (!txId || txId.length < 20) {
    return { valid: false, reason: 'TxID too short or invalid format' };
  }

  // 0. DEMO MODE — instant execution for the pre-filled demo TxID.
  //    Not added to usedTxIds so demos can be re-run without restarting.
  if (DEMO_MODE && txId === DEMO_TXID) {
    console.log(`  🎬 DEMO MODE — pre-filled demo TxID accepted instantly (indexer check skipped): ${txId}`);
    return { valid: true };
  }

  // 1. Replay attack check
  if (usedTxIds.has(txId)) {
    console.warn(`  ❌ Replay Attack Prevented: TxID ${txId} has already been spent!`);
    return { valid: false, reason: 'Transaction ID has already been used in this session' };
  }

  try {
    const url = `https://testnet-idx.algonode.cloud/v2/transactions/${txId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      return { valid: false, reason: `Transaction ID not found on Algorand Testnet Indexer (HTTP ${res.status})` };
    }

    const data = await res.json();
    const tx = data.transaction;

    // 2. Confirmed?
    if (!tx || !tx['confirmed-round'] || tx['confirmed-round'] <= 0) {
      return { valid: false, reason: 'Transaction is unconfirmed or failed' };
    }

    // 3. Must be an ASA asset-transfer — reject native ALGO pay transactions entirely
    const assetTx = tx['asset-transfer-transaction'];
    if (!assetTx) {
      const txType = tx['tx-type'] || 'unknown';
      console.warn(`  ❌ Rejected: tx-type is "${txType}" — only ASA transfers (axfer) accepted, not native ALGO`);
      return { valid: false, reason: `Only ASA asset-transfer transactions accepted (got tx-type="${txType}"). Native ALGO "pay" transactions are not valid payment.` };
    }

    const assetId  = assetTx['asset-id'];
    const receiver = assetTx['receiver'] || '';
    const amount   = assetTx['amount'] || 0;

    // 4. Asset ID must be the USDC testnet ASA
    if (assetId !== expectedAssetId) {
      console.warn(`  ❌ Wrong asset: got ASA ${assetId}, required ASA ${expectedAssetId} (USDC Testnet)`);
      return { valid: false, reason: `Wrong asset-id: got ASA ${assetId}, required ASA ${expectedAssetId} (USDC Testnet)` };
    }

    // 5. Receiver must be the CERBERUS wallet
    if (receiver !== avmAddress) {
      console.warn(`  ❌ Wrong receiver: got ${receiver}, required ${avmAddress}`);
      return { valid: false, reason: `Payment sent to wrong address. Got: ${receiver.slice(0, 12)}..., Required: ${avmAddress.slice(0, 12)}...` };
    }

    // 6. Amount must meet minimum
    if (amount < expectedAmount) {
      console.warn(`  ❌ Amount too low: ${amount} < ${expectedAmount} microunits`);
      return { valid: false, reason: `Transaction amount too low: ${amount} microunits (required >= ${expectedAmount})` };
    }

    // 7. Transaction age check — round-time is a Unix timestamp in seconds.
    //    Use typeof so undefined/null/non-numeric values can never slip past
    //    (null would otherwise yield NaN and silently pass the age check).
    const roundTime = tx['round-time'];
    if (typeof roundTime !== 'number') {
      console.warn('  ❌ Rejected: transaction has no valid round-time — cannot verify age');
      return { valid: false, reason: 'Transaction is missing a valid round-time; cannot verify it is fresh (last 1 hour)' };
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const ageSec = nowSec - roundTime;
    if (ageSec > TX_MAX_AGE_SECONDS) {
      const ageMin = Math.floor(ageSec / 60);
      console.warn(`  ❌ Transaction too old: ${ageMin} minutes ago (max ${TX_MAX_AGE_SECONDS / 60} min)`);
      return { valid: false, reason: `Transaction is too old (${ageMin} minutes). Only transactions from the last ${TX_MAX_AGE_SECONDS / 60} minutes are accepted.` };
    }

    // All checks passed — mark as spent
    usedTxIds.add(txId);
    console.log(`  ✅ Strict On-Chain Verification Passed: TxID ${txId}`);
    console.log(`     Round: ${tx['confirmed-round']} | Asset: ASA ${assetId} | Amount: ${amount} | Receiver: ${receiver.slice(0, 12)}...`);
    return { valid: true };

  } catch (e) {
    console.warn(`  ⚠️ Indexer check exception for TxID ${txId}:`, e);
    return { valid: false, reason: 'Indexer verification timeout or network error' };
  }
}

// Interceptor for TxID submission before x402 middleware
app.use('/analyze-contract', async (c, next) => {
  const txHeader = c.req.header('payment-signature') || c.req.header('X-Payment-TxID') || c.req.header('x-payment-txid') || '';

  if (txHeader && !txHeader.startsWith('{') && !txHeader.startsWith('eyJ')) {
    console.log(`  🔍 On-Chain Check for TxID: ${txHeader}`);
    const result = await verifyTxIdOnChain(txHeader);
    if (result.valid) {
      return handleContractAnalysis(c);
    } else {
      console.log(`  ❌ TxID Rejected: ${result.reason}`);
      return c.json({
        error: 'Payment verification failed',
        detail: result.reason,
        payTo: avmAddress,
        amount: expectedAmount,
        assetId: expectedAssetId
      }, 402);
    }
  }

  await next();
});

// Apply x402 payment middleware.
// NOTE: paymentMiddleware only gates routes listed in paymentConfig above
// (e.g. 'POST /analyze-contract'). Free routes like /health, /info and
// /extract-text pass straight through — keep that contract in mind when
// adding new endpoints.
app.use(paymentMiddleware(paymentConfig as any, x402Server));

// ════════════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════════════

// FREE helper: server-side text extraction for uploaded contract documents
// (PDF, Word, ODT, RTF, HTML, plain text). Not payment-gated — the analysis
// itself is the paid resource; extraction is just document preprocessing.
app.post('/extract-text', async (c) => {
  try {
    const body = await c.req.json();
    const { file_name, file_b64 } = body;
    if (!file_b64 || typeof file_b64 !== 'string' || file_b64.length < 10) {
      return c.json({ error: 'file_b64 (base64) and file_name are required' }, 400);
    }

    const aiResponse = await fetch(`${aiBackendUrl}/extract-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET_GATEWAY,
      },
      body: JSON.stringify({ file_name: file_name || 'contract.txt', file_b64 }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      // Pass through client-error codes (400/413/422); 5xx becomes 502.
      const status = [400, 413, 422].includes(aiResponse.status) ? aiResponse.status : 502;
      return c.json({ error: `Extraction failed (backend ${aiResponse.status})`, detail: errText }, status as any);
    }
    return c.json(await aiResponse.json(), 200);
  } catch (e: any) {
    return c.json({ error: 'Extraction error', message: String(e) }, 500);
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
    uptime_seconds: process.uptime(),
    algorand_network: 'testnet',
    receiver_address: avmAddress,
    ai_backend: { url: aiBackendUrl, status: aiStatus },
  });
});

app.get('/info', (c) => c.json({
  service: 'CERBERUS — AI Legal Contract Risk Analyzer',
  version: '1.0.0',
  network: 'Algorand TestNet',
  receiver: avmAddress,
  payment: '$0.01 USDC (ASA 10458941)',
  endpoints: [
    { method: 'POST', path: '/analyze-contract', protected: true,  price: '$0.01 USDC' },
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

// ════════════════════════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════════════════════════

serve({ fetch: app.fetch, port }, () => {
  console.log('\n✅ CERBERUS x402 Gateway Server is RUNNING!\n');
  console.log('═'.repeat(60));
  console.log(`  CERBERUS Gateway : http://localhost:${port}`);
  console.log(`  Health           : http://localhost:${port}/health`);
  console.log(`  Info             : http://localhost:${port}/info`);
  console.log(`  AI Backend       : ${aiBackendUrl}`);
  console.log('═'.repeat(60));
});