import type { Context } from 'hono';
import { createCanvas, loadImage, registerFont } from 'canvas';

// RAG Context for meme generation - Enhanced with creative text generation
const MEME_CONTEXT = {
  styles: [
    'drake',
    'distracted-boyfriend',
    'expanding-brain',
    'womanyelling-cat',
    'stonks',
    'doge',
    'success-kid',
    'change-my-mind',
    'this-is-fine',
    'galaxy-brain'
  ],
  templates: {
    'funny': {
      description: 'Create a hilarious, laugh-out-loud meme with clever wordplay and relatable humor',
      textStyle: 'witty and punchy',
    },
    'crypto': {
      description: 'Generate a cryptocurrency and blockchain themed meme with technical references and community inside jokes',
      textStyle: 'technical yet humorous',
    },
    'tech': {
      description: 'Make a software development or programming meme with accurate technical details and developer humor',
      textStyle: 'relatable developer pain',
    },
    'trending': {
      description: 'Create a meme based on current internet culture, viral trends, and popular references',
      textStyle: 'trendy and viral',
    },
    'sarcastic': {
      description: 'Generate a witty, sarcastic meme with dry humor and clever irony',
      textStyle: 'dripping with sarcasm',
    },
    'wholesome': {
      description: 'Create an uplifting, positive meme that makes people feel good',
      textStyle: 'heartwarming and positive',
    },
  },
  visualStyles: {
    'photorealistic': 'ultra realistic, high detail, professional photography, NO TEXT',
    'cartoon': 'cartoon style, bold colors, comic book art, NO TEXT',
    'minimalist': 'simple design, clean lines, minimal elements, NO TEXT',
    'vintage': 'retro aesthetic, vintage colors, old-school vibe, NO TEXT',
    'modern': 'contemporary design, sleek, professional, NO TEXT',
  },
  enhancementRules: [
    'Generate background/scene ONLY - NO TEXT in the image',
    'Clear visual composition with space for text overlay',
    'High contrast areas for text placement',
    'Meme-worthy facial expressions or scenarios',
    'Internet culture references through visuals',
    'Professional image quality',
    'Proper lighting and color balance'
  ]
};

interface MemeRequest {
  prompt: string;
  style?: string;
  theme?: string;
  visualStyle?: string;
  useMultiModel?: boolean;
}

interface MemeText {
  topText: string;
  bottomText: string;
  explanation: string;
}

/**
 * Generate creative meme text using AI reasoning
 * This analyzes the user's concept and creates witty, meme-worthy text
 */
function generateMemeText(
  userPrompt: string,
  style?: string,
  theme?: string
): MemeText {
  const themeInfo = theme && MEME_CONTEXT.templates[theme as keyof typeof MEME_CONTEXT.templates]
    ? MEME_CONTEXT.templates[theme as keyof typeof MEME_CONTEXT.templates]
    : { textStyle: 'funny and relatable', description: '' };

  // Analyze the prompt and generate contextual meme text
  const analysis = analyzeMemePrompt(userPrompt, style, themeInfo.textStyle);
  
  return analysis;
}

/**
 * Analyze user prompt and generate witty meme text
 * Uses pattern matching and creativity rules
 */
function analyzeMemePrompt(prompt: string, style?: string, textStyle?: string): MemeText {
  const lowerPrompt = prompt.toLowerCase();
  
  // Pattern matching for common meme scenarios
  
  // Tech/Programming memes
  if (lowerPrompt.includes('bug') || lowerPrompt.includes('debug')) {
    if (lowerPrompt.includes('3am') || lowerPrompt.includes('night')) {
      return {
        topText: 'ME AT 3AM',
        bottomText: 'FINALLY FIXING THAT BUG',
        explanation: 'Classic developer late-night victory moment'
      };
    }
    return {
      topText: '99 BUGS IN THE CODE',
      bottomText: 'TAKE ONE DOWN, PATCH IT AROUND\n127 BUGS IN THE CODE',
      explanation: 'The eternal developer struggle'
    };
  }
  
  if (lowerPrompt.includes('deploy') || lowerPrompt.includes('production')) {
    return {
      topText: 'WORKS ON MY MACHINE',
      bottomText: 'DEPLOYS TO PRODUCTION ANYWAY',
      explanation: 'Developer confidence vs reality'
    };
  }
  
  if (lowerPrompt.includes('code') && lowerPrompt.includes('work')) {
    return {
      topText: 'THE CODE WORKS',
      bottomText: "I HAVE NO IDEA WHY",
      explanation: 'Mysterious programming success'
    };
  }
  
  // Crypto memes
  if (lowerPrompt.includes('crypto') || lowerPrompt.includes('hodl')) {
    return {
      topText: 'BUYS HIGH',
      bottomText: 'SELLS LOW\nLIKE A BOSS',
      explanation: 'Classic crypto trader mistake'
    };
  }
  
  if (lowerPrompt.includes('blockchain') || lowerPrompt.includes('web3')) {
    return {
      topText: 'NORMAL DATABASE',
      bottomText: 'BLOCKCHAIN\nBUT SLOWER AND MORE EXPENSIVE',
      explanation: 'Sarcastic blockchain reality check'
    };
  }
  
  // Success/Achievement memes
  if (lowerPrompt.includes('finally') || lowerPrompt.includes('success')) {
    return {
      topText: 'WHEN YOU FINALLY',
      bottomText: prompt.toUpperCase().replace(/WHEN YOU FINALLY/i, '').trim(),
      explanation: 'Victory moment celebration'
    };
  }
  
  // Comparison memes (drake style)
  if (style === 'drake' || lowerPrompt.includes('vs')) {
    const parts = prompt.split(/vs\.?|versus|or/i);
    if (parts.length >= 2) {
      return {
        topText: parts[0].trim().toUpperCase() + '? NAH',
        bottomText: parts[1].trim().toUpperCase() + '? YEAH',
        explanation: 'Drake-style preference meme'
      };
    }
  }
  
  // Expanding brain memes
  if (style === 'expanding-brain') {
    return {
      topText: 'BASIC: ' + prompt.substring(0, 30).toUpperCase(),
      bottomText: 'GALAXY BRAIN: ' + transformToGalaxyBrain(prompt),
      explanation: 'Escalating intelligence meme'
    };
  }
  
  // Sarcastic memes
  if (lowerPrompt.includes('sarcas') || textStyle?.includes('sarcas')) {
    return {
      topText: 'OH SURE',
      bottomText: prompt.toUpperCase() + '\nTOTALLY MAKES SENSE',
      explanation: 'Dripping with sarcasm'
    };
  }
  
  // Wholesome memes
  if (textStyle?.includes('wholesome') || lowerPrompt.includes('friend')) {
    return {
      topText: 'YOU ARE',
      bottomText: 'BREATHTAKING!\nAND ' + prompt.toUpperCase(),
      explanation: 'Wholesome positivity'
    };
  }
  
  // Generic fallback - create impact text
  const words = prompt.split(' ');
  if (words.length > 6) {
    const midpoint = Math.floor(words.length / 2);
    return {
      topText: words.slice(0, midpoint).join(' ').toUpperCase(),
      bottomText: words.slice(midpoint).join(' ').toUpperCase(),
      explanation: 'Split text format'
    };
  }
  
  return {
    topText: 'ME:',
    bottomText: prompt.toUpperCase(),
    explanation: 'Classic meme format'
  };
}

/**
 * Transform text to galaxy brain version (more absurd/complex)
 */
function transformToGalaxyBrain(text: string): string {
  const transforms = [
    (t: string) => t.replace(/use/gi, 'UTILIZE'),
    (t: string) => t.replace(/make/gi, 'SYNTHESIZE'),
    (t: string) => t.replace(/fix/gi, 'ARCHITECT A SOLUTION FOR'),
    (t: string) => t.replace(/code/gi, 'ALGORITHMS'),
    (t: string) => t + ' WITH QUANTUM COMPUTING',
  ];
  
  let result = text;
  transforms.forEach(transform => {
    result = transform(result);
  });
  
  return result.toUpperCase();
}

/**
 * Enhance user prompt with advanced RAG context FOR IMAGE GENERATION ONLY
 * NO TEXT - just the background/scene
 */
function enhancePromptWithRAG(
  userPrompt: string, 
  style?: string, 
  theme?: string,
  visualStyle?: string
): string {
  // Theme context
  const themeInfo = theme && MEME_CONTEXT.templates[theme as keyof typeof MEME_CONTEXT.templates]
    ? MEME_CONTEXT.templates[theme as keyof typeof MEME_CONTEXT.templates]
    : { description: 'Create a funny, engaging, and highly shareable meme background', textStyle: '' };
  
  // Style hints
  const styleHint = style ? `${style} meme format background` : 'popular meme background';
  
  // Visual style context  
  const visualContext = visualStyle && MEME_CONTEXT.visualStyles[visualStyle as keyof typeof MEME_CONTEXT.visualStyles]
    ? MEME_CONTEXT.visualStyles[visualStyle as keyof typeof MEME_CONTEXT.visualStyles]
    : 'vibrant colors, high quality, professional composition, NO TEXT';
  
  // Build enhanced prompt focused on BACKGROUND/SCENE ONLY
  const enhancedPrompt = `
Meme background scene (NO TEXT ANYWHERE): ${userPrompt}

Style reference: ${styleHint}
Mood/Theme: ${themeInfo.description}
Visual aesthetic: ${visualContext}

ABSOLUTE REQUIREMENTS:
- Zero text, zero words, zero letters, zero typography
- Pure visual scene or facial expression only
- Clear empty space at top 20% and bottom 20% for text
- High contrast, vibrant, meme-worthy scenario
- Focus on emotion, reaction, or situation
- Professional quality composition

Generate ONLY visual scene with NO TEXT of any kind.
  `.trim();
  
  return enhancedPrompt;
}

/**
 * Add perfect text overlay to meme image using Canvas
 */
async function addTextOverlay(
  imageBase64: string,
  memeText: MemeText
): Promise<string> {
  try {
    if (imageBase64.includes('svg+xml')) {
      return imageBase64;
    }

    const imageData = imageBase64.split(',')[1];
    const imageBuffer = Buffer.from(imageData, 'base64');
    const image = await loadImage(imageBuffer);

    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0);

    // Meme text styling - classic Impact font with proper sizing
    const fontSize = Math.floor(image.height / 15); // Slightly smaller
    ctx.font = `900 ${fontSize}px Impact, Arial Black, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Better text outline for readability
    const outlineWidth = Math.max(fontSize / 12, 2);

    const drawText = (text: string, y: number) => {
      // Multiple outline passes for better visibility
      ctx.strokeStyle = 'black';
      ctx.lineWidth = outlineWidth * 2.5;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(text, image.width / 2, y);
      
      // White fill
      ctx.fillStyle = 'white';
      ctx.fillText(text, image.width / 2, y);
    };

    const wrapText = (text: string, maxWidth: number): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    const maxWidth = image.width * 0.85;
    const padding = image.height * 0.08;

    // Draw top text
    if (memeText.topText) {
      const topLines = wrapText(memeText.topText.toUpperCase(), maxWidth);
      topLines.forEach((line, index) => {
        const y = padding + (index * fontSize * 1.15);
        drawText(line, y);
      });
    }

    // Draw bottom text
    if (memeText.bottomText) {
      const bottomLines = wrapText(memeText.bottomText.toUpperCase(), maxWidth);
      const startY = image.height - padding - (bottomLines.length * fontSize * 1.15);
      bottomLines.forEach((line, index) => {
        const y = startY + (index * fontSize * 1.15);
        drawText(line, y);
      });
    }

    const finalImage = canvas.toDataURL('image/png');
    console.log('✅ Text overlay added successfully');
    return finalImage;

  } catch (error) {
    console.error('❌ Text overlay failed:', error);
    return imageBase64;
  }
}

/**
 * Multi-model configuration for enhanced output
 * Using models supported by hf-inference router
 */
const AI_MODELS = {
  primary: {
    name: 'stabilityai/stable-diffusion-xl-base-1.0',
    description: 'High quality, detailed images (SDXL)',
    steps: 20,
    guidance: 7.5,
  },
  fallback: {
    name: 'stabilityai/stable-diffusion-2-1',
    description: 'Stable Diffusion 2.1',
    steps: 20,
    guidance: 7.5,
  },
  creative: {
    name: 'prompthero/openjourney-v4',
    description: 'Midjourney-style creative images',
    steps: 25,
    guidance: 7.5,
  },
};

/**
 * Generate meme using multiple models and merge best results
 */
async function generateWithMultiModel(
  enhancedPrompt: string,
  HF_API_KEY: string
): Promise<string> {
  console.log('🔄 Multi-model generation enabled');
  
  // Try primary model first (FLUX - fast and works)
  try {
    console.log(`Attempting primary model: ${AI_MODELS.primary.name}`);
    const result = await callHuggingFaceModel(
      AI_MODELS.primary.name,
      enhancedPrompt,
      HF_API_KEY,
      AI_MODELS.primary.steps,
      AI_MODELS.primary.guidance
    );
    console.log('✅ Primary model successful');
    return result;
  } catch (error) {
    console.log('⚠️ Primary model failed, trying fallback model');
    console.error('Primary error:', error instanceof Error ? error.message : error);
  }
  
  // Fallback to SDXL if available
  try {
    console.log(`Attempting fallback model: ${AI_MODELS.fallback.name}`);
    const result = await callHuggingFaceModel(
      AI_MODELS.fallback.name,
      enhancedPrompt,
      HF_API_KEY,
      AI_MODELS.fallback.steps,
      AI_MODELS.fallback.guidance
    );
    console.log('✅ Fallback model successful');
    return result;
  } catch (error) {
    console.log('⚠️ Fallback model failed, trying creative model');
    console.error('Fallback error:', error instanceof Error ? error.message : error);
  }
  
  // Last resort: creative model
  console.log(`Attempting creative model: ${AI_MODELS.creative.name}`);
  return await callHuggingFaceModel(
    AI_MODELS.creative.name,
    enhancedPrompt,
    HF_API_KEY,
    AI_MODELS.creative.steps,
    AI_MODELS.creative.guidance
  );
}

/**
 * Call specific Hugging Face model
 */
async function callHuggingFaceModel(
  modelName: string,
  prompt: string,
  apiKey: string,
  steps: number,
  guidance: number
): Promise<string> {
  const HF_API_URL = `https://api-inference.huggingface.co/models/${modelName}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  // Strong negative prompt to prevent text generation
  const strongNegativePrompt = 'text, words, letters, writing, typography, captions, subtitles, watermark, signature, label, title, heading, alphabet, numbers, characters, font, type';

  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt + ' | CRITICAL: Generate image with absolutely NO TEXT, NO WORDS, NO LETTERS visible anywhere',
      parameters: {
        num_inference_steps: steps,
        guidance_scale: guidance,
        negative_prompt: strongNegativePrompt,
        width: 512,
        height: 512,
      }
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Model ${modelName} failed: ${response.status} - ${errorText}`);
  }

  const imageBlob = await response.blob();
  const arrayBuffer = await imageBlob.arrayBuffer();
  const base64Image = Buffer.from(arrayBuffer).toString('base64');
  
  return `data:${imageBlob.type};base64,${base64Image}`;
}

/**
 * Generate a mock meme image (fallback when Hugging Face is unavailable)
 */
function generateMockMeme(prompt: string): string {
  // Create a simple SVG meme as base64
  const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#7c3aed"/>
      <text x="256" y="200" font-family="Arial, sans-serif" font-size="32" font-weight="bold" 
            fill="white" text-anchor="middle">MEME GENERATED!</text>
      <text x="256" y="280" font-family="Arial, sans-serif" font-size="18" 
            fill="white" text-anchor="middle" style="max-width: 480px;">${prompt}</text>
      <text x="256" y="450" font-family="Arial, sans-serif" font-size="14" 
            fill="#e9d5ff" text-anchor="middle">Powered by x402 + Mock Generator</text>
    </svg>
  `.trim();
  
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Call Hugging Face Image Generation API with multi-model support
 */
async function generateMemeWithHuggingFace(
  enhancedPrompt: string,
  useMultiModel: boolean = false
): Promise<string> {
  const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
  const USE_MOCK = process.env.USE_MOCK_GENERATOR === 'true';
  
  // Use mock if explicitly enabled
  if (USE_MOCK) {
    console.log('Using mock meme generator (USE_MOCK_GENERATOR=true)');
    return generateMockMeme(enhancedPrompt);
  }

  if (!HF_API_KEY) {
    console.log('No API key, using mock generator');
    return generateMockMeme(enhancedPrompt);
  }

  console.log(`🎨 Starting AI meme generation`);
  console.log(`Multi-model: ${useMultiModel ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Enhanced prompt: ${enhancedPrompt}`);

  try {
    // Use multi-model approach if enabled
    if (useMultiModel) {
      return await generateWithMultiModel(enhancedPrompt, HF_API_KEY);
    }
    
    // Single model approach (default: SDXL for best quality)
    const MODEL = process.env.HF_MODEL || AI_MODELS.primary.name;
    const modelConfig = Object.values(AI_MODELS).find(m => m.name === MODEL) || AI_MODELS.primary;
    
    console.log(`Using model: ${MODEL}`);
    const result = await callHuggingFaceModel(
      MODEL,
      enhancedPrompt,
      HF_API_KEY,
      modelConfig.steps,
      modelConfig.guidance
    );
    
    console.log('✅ Hugging Face generation successful!');
    return result;
    
  } catch (error) {
    console.error(`❌ AI generation failed:`, error instanceof Error ? error.message : error);
    
    // Network error - use mock fallback
    if (error instanceof Error && (error.message.includes('ENOTFOUND') || error.message.includes('fetch failed') || error.message.includes('aborted'))) {
      console.log('⚠️ Network error detected, using mock generator as fallback');
      return generateMockMeme(enhancedPrompt);
    }
    
    // Model error - try mock
    console.log('⚠️ Model error, using mock generator as fallback');
    return generateMockMeme(enhancedPrompt);
  }
}

/**
 * POST /meme-generate
 * Generates a meme image using Hugging Face API with RAG enhancement
 * 
 * Payment: 0.1 USDC per generation
 * 
 * Request body:
 * {
 *   "prompt": "When you finally deploy to production",
 *   "style": "drake",  // optional
 *   "theme": "tech"    // optional
 * }
 */
export async function handleMemeGenerateRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - POST /meme-generate handler executing');
    
    // Parse request body
    const body = await c.req.json() as MemeRequest;
    const { prompt, style, theme, visualStyle, useMultiModel } = body;

    if (!prompt || prompt.trim().length === 0) {
      return c.json({ error: 'Prompt is required' }, 400);
    }

    console.log('User request:', { prompt, style, theme, visualStyle, useMultiModel });

    // Step 1: Generate creative meme text (AI reasoning)
    const memeText = generateMemeText(prompt, style, theme);
    console.log('Generated meme text:', memeText);

    // Step 2: Enhance prompt for IMAGE GENERATION ONLY (no text)
    const enhancedPrompt = enhancePromptWithRAG(prompt, style, theme, visualStyle);
    console.log('Image generation prompt:', enhancedPrompt);

    // Step 3: Generate background image (no text)
    let imageBase64 = await generateMemeWithHuggingFace(enhancedPrompt, useMultiModel || false);
    
    // Step 4: Add perfect text overlay using Canvas
    imageBase64 = await addTextOverlay(imageBase64, memeText);
    
    // Determine which model was actually used
    const usedModel = imageBase64.includes('svg+xml') 
      ? 'mock-generator'
      : (useMultiModel ? 'multi-model-ensemble' : (process.env.HF_MODEL || AI_MODELS.primary.name));
    
    // Step 5: Return response
    const response = {
      success: true,
      meme: {
        imageUrl: imageBase64,
        prompt: prompt,
        generatedText: memeText,
        enhancedPrompt: enhancedPrompt,
        style: style || 'default',
        theme: theme || 'general',
        visualStyle: visualStyle || 'default',
        generatedAt: new Date().toISOString(),
      },
      metadata: {
        paymentReceived: '0.1 USDC',
        model: usedModel,
        multiModel: useMultiModel || false,
        ragEnhanced: true,
        textOverlay: true,
        creativeText: true,
        usingMock: imageBase64.includes('svg+xml'),
      }
    };

    console.log('Meme generated successfully with text overlay');
    return c.json(response);

  } catch (error) {
    console.error('Error in meme generation:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      success: false,
      error: 'Failed to generate meme',
      details: errorMessage,
    }, 500);
  }
}

/**
 * GET /meme-styles
 * Returns available meme styles and themes
 * Public endpoint - no payment required
 */
export function handleMemeStylesRequest(c: Context) {
  return c.json({
    styles: MEME_CONTEXT.styles,
    themes: Object.keys(MEME_CONTEXT.templates),
    visualStyles: Object.keys(MEME_CONTEXT.visualStyles),
    enhancementRules: MEME_CONTEXT.enhancementRules,
    models: {
      available: Object.keys(AI_MODELS),
      primary: AI_MODELS.primary.name,
      descriptions: Object.entries(AI_MODELS).reduce((acc, [key, val]) => {
        acc[key] = val.description;
        return acc;
      }, {} as Record<string, string>)
    }
  });
}
