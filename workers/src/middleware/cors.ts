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

/**
 * Matches Firebase Hosting preview channels for the QA and production projects,
 * e.g. `https://mysongs-qa--dev-abc123.web.app`. Channel URLs are stable per
 * channel name but include a per-deploy hash, so they are matched by pattern.
 */
function isAllowedOrigin(origin: string): boolean {
  return (
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/(?:mysongs-qa|leo-bee-music)--[a-z0-9-]+\.web\.app$/.test(origin)
  );
}

/**
 * Builds CORS headers for a response.
 *
 * @param origin - The request's Origin header value, or undefined/null when absent.
 * @returns Headers echoing the origin when it is allowlisted; otherwise no
 * `Access-Control-Allow-Origin` header is sent so browsers block the read.
 */
export function corsHeaders(origin?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Allow-Credentials': 'true',
  };

  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

/**
 * Builds CORS headers for a request, reflecting the request's Origin when it is
 * allowlisted so the browser can read the response cross-origin.
 */
export function corsForRequest(request: Request): HeadersInit {
  return corsHeaders(request.headers.get('Origin'));
}

export function handleCorsPreflight(request: Request): Response {
  const origin = request.headers.get('Origin') || undefined;
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}
