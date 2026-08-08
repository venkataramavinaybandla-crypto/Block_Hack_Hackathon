/**
 * X402 Handler Template - Weather Data
 *
 * This handler processes a payment-protected request and returns data.
 * Teams: Copy this file, rename it, and modify for your use case!
 *
 * HANDLER PATTERN:
 * 1. Only called AFTER payment is verified by x402 middleware
 * 2. Perform business logic (fetch data, compute, query DB)
 * 3. Return JSON response
 * 4. Log for debugging
 */

import type { Context } from 'hono';

/**
 * GET /weather
 * Returns weather information after payment verified
 *
 * Flow:
 * 1. Client makes request with Payment-Signature header
 * 2. x402 middleware validates payment on blockchain
 * 3. This handler is called only if payment valid
 * 4. Return premium weather data
 */
export function handleWeatherRequest(c: Context) {
  try {
    // ✓ Payment is already verified at this point
    console.log('✓ PAYMENT VERIFIED - GET /weather handler executing');

    // TODO: Add your business logic here
    // Examples:
    // - Fetch from external API
    // - Query database
    // - Compute analytics
    // - Generate report

    // For demo: Return mock weather data
    const weatherData = {
      report: {
        location: 'San Francisco, CA',
        weather: 'sunny',
        temperature: 70,
        humidity: 65,
        windSpeed: 8,
        timestamp: new Date().toISOString(),
      },
      premium: {
        forecast: '7-day premium forecast included',
        alerts: 'You have 0 weather alerts',
        premium_feature: 'This data is premium and paid for via x402',
      },
    };

    console.log('Returning weather data:', JSON.stringify(weatherData, null, 2));
    return c.json(weatherData);
  } catch (error) {
    console.error('Error in weather handler:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

/**
 * Alternative: Async handler for external API calls
 *
 * export async function handleWeatherRequestAsync(c: Context) {
 *   try {
 *     console.log('✓ Payment verified - fetching weather data');
 *
 *     // Fetch from external API
 *     const response = await fetch('https://api.example.com/weather');
 *     const data = await response.json();
 *
 *     return c.json({
 *       premium_data: data,
 *       access_at: new Date().toISOString(),
 *     });
 *   } catch (error) {
 *     console.error('Error fetching weather:', error);
 *     return c.json({ error: 'Failed to fetch weather' }, 500);
 *   }
 * }
 */
