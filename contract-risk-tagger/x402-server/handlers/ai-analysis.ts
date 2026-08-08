/**
 * X402 Handler Template - AI Analysis API
 *
 * Use case: Pay-per-use AI features
 * Example: Code analysis, content moderation, sentiment analysis, image processing
 *
 * Teams: This is a great example for:
 * - LLM API integration
 * - Image processing services
 * - Content analysis
 * - Code quality analysis
 * - Spam/fraud detection
 */

import type { Context } from 'hono';

/**
 * POST /ai-analysis
 * Analyze content using AI models after payment
 *
 * Request body example:
 * {
 *   "content": "code snippet or text to analyze",
 *   "analysis_type": "code-quality" | "sentiment" | "spam" | "summary"
 * }
 */
export async function handleAIAnalysisRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - POST /ai-analysis handler executing');

    // Get request body
    const body = await c.req.json();
    const { content, analysis_type = 'general' } = body;

    if (!content) {
      return c.json({ error: 'Content required' }, 400);
    }

    // Simulate AI analysis (replace with real LLM API call)
    const analysis = performAnalysis(content, analysis_type);

    return c.json({
      input_length: content.length,
      analysis_type,
      results: analysis,
      model: 'gpt-4-turbo',
      tokens_used: 145,
      cost_in_usdc: 0.01,
      paid_via_x402: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in AI analysis:', error);
    return c.json({ error: 'Analysis failed' }, 500);
  }
}

/**
 * POST /ai-analysis/batch
 * Analyze multiple items (bulk payment model)
 *
 * Great for high-volume use cases
 */
export async function handleAIAnalysisBatchRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - POST /ai-analysis/batch handler executing');

    const body = await c.req.json();
    const { items, analysis_type = 'general' } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'Items array required' }, 400);
    }

    const results = items.map(item => ({
      input: item,
      analysis: performAnalysis(item, analysis_type),
    }));

    return c.json({
      batch_size: items.length,
      analysis_type,
      results,
      total_cost_usdc: 0.01 * items.length,
      paid_via_x402: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in batch analysis:', error);
    return c.json({ error: 'Batch analysis failed' }, 500);
  }
}

/**
 * Helper function for analysis
 * Replace this with actual LLM API call
 */
function performAnalysis(
  content: string,
  type: string
): Record<string, unknown> {
  // Mock analysis results - replace with real API
  const analyses: Record<string, Record<string, unknown>> = {
    'code-quality': {
      score: 78,
      issues: 3,
      warnings: [
        'Missing error handling in line 42',
        'Unused variable detected',
      ],
      suggestions: [
        'Add try-catch block',
        'Consider using async/await',
      ],
    },
    'sentiment': {
      overall: 'positive',
      score: 0.82,
      emotions: {
        joy: 0.6,
        trust: 0.4,
        fear: 0.0,
      },
    },
    'spam': {
      is_spam: false,
      confidence: 0.99,
      reasons: [],
    },
    'summary': {
      summary: `Content summarized: "${content.substring(0, 50)}..."`,
      key_points: [
        'First main point',
        'Second main point',
      ],
      word_count: content.split(' ').length,
    },
  };

  return analyses[type] || analyses['general'] || { raw_analysis: content };
}

/**
 * Integration Examples:
 *
 * 1. OpenAI API:
 * ──────────────
 * const response = await fetch('https://api.openai.com/v1/chat/completions', {
 *   method: 'POST',
 *   headers: {
 *     'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
 *   },
 *   body: JSON.stringify({
 *     model: 'gpt-4-turbo',
 *     messages: [{ role: 'user', content }],
 *   }),
 * });
 *
 * 2. Hugging Face:
 * ────────────────
 * const response = await fetch(
 *   'https://api-inference.huggingface.co/models/...',
 *   { headers: { Authorization: `Bearer ${HF_TOKEN}` } }
 * );
 *
 * 3. Local Model (Ollama):
 * ────────────────────────
 * const response = await fetch('http://localhost:11434/api/generate', {
 *   method: 'POST',
 *   body: JSON.stringify({ model: 'llama2', prompt: content }),
 * });
 */
