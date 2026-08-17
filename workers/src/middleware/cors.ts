/**
 * CORS middleware for Cloudflare Workers
 * 
 * Handles Cross-Origin Resource Sharing headers for browser-based requests.
 */

/**
 * Allowed browser origins for cross-origin requests.
 */
const ALLOWED_ORIGINS = [
  'http://localhost:4200', // Angular dev server
  'http://localhost:8787', // Worker dev server
  'https://mysongs-qa.web.app', // Firebase Hosting (QA)
  'https://leobee.com',
  'https://www.leobee.com',
  'https://leobee-music.pages.dev', // Cloudflare Pages preview/deploy
];

export function corsHeaders(origin?: string): HeadersInit {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Allow-Credentials': 'true',
  };
}

export function handleCorsPreflight(request: Request): Response {
  const origin = request.headers.get('Origin') || undefined;
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}
