/**
 * CERBERUS — x402 Payment-Protected Proxy Handler
 *
 * Payment is verified by x402 middleware / indexer BEFORE this handler runs.
 * On payment success, proxies the contract text to the Python AI backend with X-Internal-Secret.
 */

import type { Context } from 'hono';
import { config } from 'dotenv';
import path from 'path';

// Load x402-server/.env BEFORE reading INTERNAL_SECRET.
// index.ts calls config() itself, but ESM imports are evaluated before that
// call runs, so without this the secret would be undefined at module load.
// The path is module-relative (handlers/ → x402-server/.env) so the server
// works regardless of the working directory it is started from.
config({ path: path.join(__dirname, '..', '.env') });

const AI_BACKEND_URL = process.env.AI_BACKEND_URL || 'http://localhost:8000';

/**
 * INTERNAL_SECRET — NO hardcoded fallback. Must come from x402-server/.env.
 * Refuses to start (exit 1) if unset, and returns a type-safe `string`
 * so callers never see `string | undefined`.
 */
export function requireInternalSecret(): string {
  const s = process.env.INTERNAL_SECRET;
  if (!s) {
    console.error('FATAL: INTERNAL_SECRET env var is not set. Set it in x402-server/.env. Refusing to start.');
    process.exit(1);
  }
  return s;
}

const INTERNAL_SECRET = requireInternalSecret();

/**
 * POST /analyze-contract
 *
 * Called ONLY after x402 payment is verified.
 * Proxies to Python FastAPI AI backend for Ollama-powered clause extraction.
 *
 * Request body: { contract_text: string }
 * Response: [{clause, risk_level, reason, suggested_rewrite}, ...]
 */
export async function handleContractAnalysis(c: Context) {
  const timestamp = new Date().toISOString();
  console.log(`\n✅ PAYMENT VERIFIED — executing /analyze-contract at ${timestamp}`);

  try {
    const body = await c.req.json();
    const { contract_text } = body;

    if (!contract_text || typeof contract_text !== 'string') {
      return c.json({ error: 'contract_text (string) is required in request body' }, 400);
    }

    if (contract_text.trim().length < 20) {
      return c.json({ error: 'Contract text too short (min 20 chars)' }, 400);
    }

    console.log(`   Contract length: ${contract_text.length} chars`);
    console.log(`   Proxying to AI backend: ${AI_BACKEND_URL}/analyze-contract`);

    // Proxy to Python FastAPI + Ollama AI backend with internal security secret
    const aiResponse = await fetch(`${AI_BACKEND_URL}/analyze-contract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET,
      },
      body: JSON.stringify({ contract_text }),
      signal: AbortSignal.timeout(180_000), // 3-min timeout for large contracts
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`   AI backend error ${aiResponse.status}: ${errText}`);
      return c.json(
        { error: `AI backend returned ${aiResponse.status}`, detail: errText },
        502
      );
    }

    const clauses = await aiResponse.json();
    console.log(`   AI returned ${Array.isArray(clauses) ? clauses.length : '?'} clauses`);

    // ── Log summary for demo visibility ──────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log('📋 CONTRACT RISK ANALYSIS COMPLETE');
    console.log('═'.repeat(60));
    if (Array.isArray(clauses)) {
      const counts = { high: 0, medium: 0, low: 0 } as Record<string, number>;
      clauses.forEach((c: any) => { if (c.risk_level) counts[c.risk_level] = (counts[c.risk_level] || 0) + 1; });
      console.log(`   Total clauses flagged: ${clauses.length}`);
      console.log(`   🔴 High risk:   ${counts.high || 0}`);
      console.log(`   🟡 Medium risk: ${counts.medium || 0}`);
      console.log(`   🟢 Low risk:    ${counts.low || 0}`);
    }
    console.log('═'.repeat(60) + '\n');

    return c.json(clauses, 200);

  } catch (error: any) {
    if (error?.name === 'TimeoutError') {
      console.error('   AI backend timed out');
      return c.json({ error: 'AI analysis timed out (3 min limit)' }, 504);
    }
    if (error?.cause?.code === 'ECONNREFUSED') {
      console.error('   AI backend not reachable');
      return c.json({
        error: 'AI backend not running',
        hint: `Start with: uvicorn main:app --port 8000 (in backend/ dir)`,
      }, 503);
    }
    console.error('   Unexpected error:', error);
    return c.json({ error: 'Internal server error', message: String(error) }, 500);
  }
}
