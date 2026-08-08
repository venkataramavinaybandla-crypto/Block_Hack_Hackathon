/**
 * CERBERUS — x402 Payment-Protected Proxy & Cloud AI Handler
 *
 * Payment is verified by x402 middleware / indexer BEFORE this handler runs.
 * On payment success:
 *   1. If a Cloud LLM key is set (GROQ_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY, or LLM_API_KEY),
 *      executes AI analysis directly via cloud API in 1-2 seconds (ideal for Vercel serverless).
 *   2. Otherwise, proxies to Python FastAPI AI backend (http://localhost:8000).
 */

import type { Context } from 'hono';
import { config } from 'dotenv';
import path from 'path';

// Load env
config({ path: path.join(__dirname, '..', '.env') });
config({ path: path.join(__dirname, '..', '..', '.env') });

const AI_BACKEND_URL = process.env.AI_BACKEND_URL || 'http://localhost:8000';

/**
 * INTERNAL_SECRET check helper
 */
export function requireInternalSecret(): string {
  const s = process.env.INTERNAL_SECRET;
  if (!s && !process.env.VERCEL) {
    console.error('FATAL: INTERNAL_SECRET env var is not set in .env. Refusing to start.');
    process.exit(1);
  }
  return s || 'vercel-production-secret';
}

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'vercel-production-secret';

const SYSTEM_PROMPT = `You are a legal risk analysis AI. Analyze contract text and identify risky clauses.

OUTPUT RULES (STRICT):
- Output ONLY a valid JSON array. NO markdown fences, NO explanations, NO preamble.
- Start your response with [ and end with ]
- Each object must have exactly these keys: clause, risk_level, reason, suggested_rewrite
- risk_level must be exactly: "high", "medium", or "low"
- clause: the specific problematic text quoted from the contract (max 150 chars)
- reason: why this is risky (1-2 sentences)
- suggested_rewrite: a safer alternative (1-3 sentences)

Example of correct output format:
[{"clause":"unlimited indemnification clause","risk_level":"high","reason":"Exposes client to unlimited liability.","suggested_rewrite":"Limit indemnification to direct damages caused by client negligence."}]`;

function extractJsonArray(raw: string): any[] {
  let clean = raw.trim();
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  clean = clean.replace(/```(?:json)?/g, '').trim();
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const parsed = JSON.parse(raw.substring(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  throw new Error(`Could not parse JSON array from model output: ${raw.slice(0, 200)}`);
}

async function analyzeWithCloudLLM(contractText: string): Promise<any[]> {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const genericKey = process.env.LLM_API_KEY;

  let endpoint = process.env.LLM_BASE_URL || 'https://api.openai.com/v1/chat/completions';
  let apiKey = genericKey;
  let model = process.env.LLM_MODEL || 'gpt-4o-mini';

  if (groqKey) {
    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    apiKey = groqKey;
    model = process.env.LLM_MODEL || 'llama-3.3-70b-versatile';
  } else if (openaiKey) {
    endpoint = 'https://api.openai.com/v1/chat/completions';
    apiKey = openaiKey;
    model = process.env.LLM_MODEL || 'gpt-4o-mini';
  } else if (deepseekKey) {
    endpoint = 'https://api.deepseek.com/v1/chat/completions';
    apiKey = deepseekKey;
    model = process.env.LLM_MODEL || 'deepseek-chat';
  }

  if (!apiKey) {
    throw new Error('No Cloud LLM API key configured');
  }

  console.log(`   Calling Cloud LLM (${model}) at ${endpoint}...`);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyze this contract and return JSON array:\n\n${contractText}` },
      ],
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloud LLM API error (${res.status}): ${errText}`);
  }

  const data = await res.json() as any;
  const content = data.choices?.[0]?.message?.content || '';
  const parsed = extractJsonArray(content);

  return parsed.map((item: any) => ({
    clause: String(item.clause || '').slice(0, 500),
    risk_level: ['high', 'medium', 'low'].includes(String(item.risk_level).toLowerCase())
      ? String(item.risk_level).toLowerCase()
      : 'medium',
    reason: String(item.reason || ''),
    suggested_rewrite: String(item.suggested_rewrite || ''),
  }));
}

/**
 * POST /analyze-contract
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

    const hasCloudKey = !!(
      process.env.GROQ_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.LLM_API_KEY
    );

    let clauses: any[];

    if (hasCloudKey) {
      console.log('   Using Cloud LLM provider for fast serverless execution');
      clauses = await analyzeWithCloudLLM(contract_text);
    } else {
      console.log(`   Proxying to local AI backend: ${AI_BACKEND_URL}/analyze-contract`);
      const aiResponse = await fetch(`${AI_BACKEND_URL}/analyze-contract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': INTERNAL_SECRET,
        },
        body: JSON.stringify({ contract_text }),
        signal: AbortSignal.timeout(620_000),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`   AI backend error ${aiResponse.status}: ${errText}`);
        return c.json({ error: `AI backend returned ${aiResponse.status}`, detail: errText }, 502);
      }

      clauses = await aiResponse.json();
    }

    console.log(`   AI returned ${Array.isArray(clauses) ? clauses.length : '?'} clauses`);

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
      console.error('   AI analysis timed out');
      return c.json({ error: 'AI analysis timed out. Try with a shorter contract.' }, 504);
    }
    if (error?.cause?.code === 'ECONNREFUSED') {
      console.error('   AI backend not reachable');
      return c.json({
        error: 'AI backend not running or no Cloud LLM API key configured.',
        hint: 'Set GROQ_API_KEY, OPENAI_API_KEY, or DEEPSEEK_API_KEY in environment, or start local backend.',
      }, 503);
    }
    console.error('   Unexpected error:', error);
    return c.json({ error: 'Internal server error', message: String(error.message || error) }, 500);
  }
}
