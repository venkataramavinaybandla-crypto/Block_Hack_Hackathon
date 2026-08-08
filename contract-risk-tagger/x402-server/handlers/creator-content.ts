/**
 * X402 Handler Template - Creator Monetization / Token-Gated Content
 *
 * Use case: Creators get paid per access to exclusive content
 * Example: Exclusive NFT content, digital art, tutorials, music, merchandise
 *
 * Teams: Perfect for:
 * - Creator economy platforms
 * - Exclusive content platforms
 * - Micropayment-based access
 * - Digital asset monetization
 */

import type { Context } from 'hono';

/**
 * GET /exclusive-content/:id
 * Access creator's exclusive content after payment
 *
 * URL: /exclusive-content/456
 * User pays → Creator receives payment → Content unlocked
 */
export function handleCreatorContentRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - GET /exclusive-content handler executing');

    const contentId = c.req.param('id') || '';
    const userAddress = c.req.query('user_address') || 'anonymous';

    if (!contentId) {
      return c.json({ error: 'Content ID required' }, 400);
    }

    // Mock content data - in real app, fetch from database
    const content = getCreatorContent(contentId);

    if (!content) {
      return c.json({ error: 'Content not found' }, 404);
    }

    // Log access for creator analytics
    console.log(`✓ Content "${content.title}" accessed by ${userAddress}`);

    return c.json({
      content_id: contentId,
      title: content.title,
      creator: content.creator,
      creator_wallet: content.creator_wallet,
      type: content.type,
      content: content.data, // This is the paid content
      accessed_by: userAddress,
      payment_received: {
        amount: content.price,
        currency: 'USDC',
        creator_receives: `${parseFloat(content.price) * 0.9} USDC`, // 10% platform fee
      },
      timestamp: new Date().toISOString(),
      access_verified: true,
    });
  } catch (error) {
    console.error('Error accessing creator content:', error);
    return c.json({ error: 'Failed to access content' }, 500);
  }
}

/**
 * GET /creators/:wallet/content
 * List all paid content from a creator
 *
 * URL: /creators/WALLET_ADDRESS/content
 */
export function handleCreatorContentListRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - GET /creators/:wallet/content handler executing');

    const creatorWallet = c.req.param('wallet') || 'unknown';

    // In real app: fetch from database filtered by creator
    const creatorContent = [
      {
        id: '1',
        title: 'Advanced Algorand Tutorial',
        creator: 'AlgoExpert',
        price: '$0.05',
        type: 'tutorial',
        preview: 'Learn advanced Algorand development...',
        duration: '45 min',
        views: 234,
      },
      {
        id: '2',
        title: 'Exclusive NFT Art Collection',
        creator: 'AlgoExpert',
        price: '$0.10',
        type: 'nft-art',
        preview: 'Limited edition digital art pieces...',
        items: 25,
        views: 567,
      },
    ];

    return c.json({
      creator: creatorWallet,
      total_content: creatorContent.length,
      content: creatorContent,
      total_earnings: '$1,234.56', // Creator's total revenue
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error listing creator content:', error);
    return c.json({ error: 'Failed to list content' }, 500);
  }
}

/**
 * POST /creators/publish
 * Creator publishes new paid content
 *
 * Requires payment to publish (optional - can be free)
 * Request body:
 * {
 *   "title": "My Exclusive Content",
 *   "type": "tutorial|art|music|merchandise",
 *   "price": "0.05",
 *   "content": "...",
 *   "creator_wallet": "..."
 * }
 */
export async function handleCreatorPublishRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - POST /creators/publish handler executing');

    const body = await c.req.json();
    const { title, type, price, content, creator_wallet } = body;

    if (!title || !type || !price || !content || !creator_wallet) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // In real app: save to database
    const contentId = generateContentId();

    return c.json({
      status: 'published',
      content_id: contentId,
      title,
      type,
      price,
      creator: creator_wallet,
      published_at: new Date().toISOString(),
      access_url: `https://api.example.com/exclusive-content/${contentId}`,
      share_link: `https://app.example.com/content/${contentId}`,
    });
  } catch (error) {
    console.error('Error publishing content:', error);
    return c.json({ error: 'Failed to publish content' }, 500);
  }
}

/**
 * GET /creators/:wallet/earnings
 * Creator dashboard - view earnings
 *
 * URL: /creators/WALLET_ADDRESS/earnings
 */
export function handleCreatorEarningsRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - GET /creators/:wallet/earnings handler executing');

    const creatorWallet = c.req.param('wallet');

    const earnings = {
      creator: creatorWallet,
      total_earned: '$5,432.10',
      period: {
        start: '2026-05-01',
        end: '2026-05-18',
      },
      breakdown: {
        by_content: [
          {
            content_id: '1',
            title: 'Advanced Tutorial',
            sales: 142,
            revenue: '$2,130',
          },
          {
            content_id: '2',
            title: 'NFT Collection',
            sales: 33,
            revenue: '$3,302.10',
          },
        ],
        by_day: [
          { date: '2026-05-18', sales: 12, revenue: '$432.10' },
          { date: '2026-05-17', sales: 8, revenue: '$288' },
        ],
      },
      payout_details: {
        pending: '$432.10',
        next_payout_date: '2026-06-01',
        payout_wallet: creatorWallet,
      },
      verified: true,
    };

    return c.json(earnings);
  } catch (error) {
    console.error('Error fetching creator earnings:', error);
    return c.json({ error: 'Failed to fetch earnings' }, 500);
  }
}

/**
 * HELPER FUNCTIONS
 */

interface CreatorContent {
  title: string;
  creator: string;
  creator_wallet: string;
  type: string;
  price: string;
  data: string;
}

function getCreatorContent(contentId: string): CreatorContent | null {
  // Mock database
  const content: Record<string, CreatorContent> = {
    '456': {
      title: 'Advanced Algorand Development Guide',
      creator: 'AlgoMaster',
      creator_wallet: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
      type: 'tutorial',
      price: '0.05',
      data: '# Advanced Algorand Development\n\nThis is exclusive content paid via x402...',
    },
    '789': {
      title: 'Exclusive NFT Art Collection',
      creator: 'DigitalArtist',
      creator_wallet: 'KJZZ5BNRJQ3TJXJQQYUU4BQZZYWOZLQQZQWYAICGQBMDG3ZXDQ3JCCQJI',
      type: 'nft',
      price: '0.10',
      data: 'ipfs://Qm... (NFT image/metadata)',
    },
  };

  return content[contentId] || null;
}

function generateContentId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * DEPLOYMENT IDEAS FOR TEAMS:
 *
 * 1. Creator Platform
 *    - Host multiple creators' content
 *    - Take small fee (10%)
 *    - Creator dashboard with earnings
 *    - Leaderboard of top creators
 *
 * 2. Educational Content
 *    - Tutorials, courses, workshops
 *    - Pay per access or subscription
 *    - Track student progress
 *    - Certificate generation
 *
 * 3. Digital Art Marketplace
 *    - Exclusive digital art
 *    - Limited edition NFTs
 *    - Artist verification
 *    - Royalties on resale
 *
 * 4. Music/Audio Platform
 *    - Premium music tracks
 *    - Podcast episodes
 *    - Sound effects library
 *    - Royalty splits with artists
 *
 * 5. Data/Reports
 *    - Research reports
 *    - Market analysis
 *    - White papers
 *    - Proprietary data
 */
