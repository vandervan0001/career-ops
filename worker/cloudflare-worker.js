/**
 * Cloudflare Worker — Vanguard email tracking
 *
 * Handles 2 routes:
 *   GET /t/{msgId}.png         → returns 1x1 transparent PNG, logs open
 *   GET /c/{msgId}?u={url}     → 302 redirect to {url}, logs click
 *
 * Logs are POSTed to the local CRM via webhook (CRM_WEBHOOK env var)
 * which must be a publicly reachable URL forwarding to localhost:7777.
 *
 * For local-only setup (Mac always on), use a Cloudflare Tunnel:
 *   cloudflared tunnel --url http://localhost:7777
 * which gives you a *.trycloudflare.com URL to set as CRM_WEBHOOK.
 *
 * For production, host the CRM on a small VM and set CRM_WEBHOOK to its public URL.
 *
 * Environment variables (set in wrangler.toml or Cloudflare dashboard):
 *   CRM_WEBHOOK          required - URL of the CRM /api/track/* endpoints (e.g. https://crm.vanguard-systems.ch)
 *   WEBHOOK_SECRET       optional - shared secret for HMAC auth (TODO)
 *
 * Deploy:
 *   cd worker && wrangler deploy
 */

// 1x1 transparent PNG (43 bytes)
const PIXEL_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Open tracking: GET /t/{msgId}.png
    const openMatch = path.match(/^\/t\/([^/]+)\.png$/);
    if (openMatch) {
      const msgId = decodeURIComponent(openMatch[1]);
      const ip = request.headers.get('CF-Connecting-IP') || '';
      const ua = request.headers.get('User-Agent') || '';
      // Fire-and-forget webhook (don't block response)
      ctx.waitUntil(
        fetch(`${env.CRM_WEBHOOK}/api/track/open`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ msgId, ip, ua }),
        }).catch(() => {})
      );
      return new Response(PIXEL_BYTES, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
        },
      });
    }

    // Click tracking: GET /c/{msgId}?u={encoded_url}
    const clickMatch = path.match(/^\/c\/([^/]+)$/);
    if (clickMatch) {
      const msgId = decodeURIComponent(clickMatch[1]);
      const targetUrl = url.searchParams.get('u');
      if (!targetUrl) return new Response('missing u', { status: 400 });
      const ip = request.headers.get('CF-Connecting-IP') || '';
      const ua = request.headers.get('User-Agent') || '';
      ctx.waitUntil(
        fetch(`${env.CRM_WEBHOOK}/api/track/click`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ msgId, url: targetUrl, ip, ua }),
        }).catch(() => {})
      );
      return Response.redirect(targetUrl, 302);
    }

    return new Response('Vanguard tracker — paths /t/{msgId}.png and /c/{msgId}?u={url}', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  },
};
