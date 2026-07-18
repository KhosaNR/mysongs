/**
 * CORS middleware for Cloudflare Workers
 * 
 * Handles Cross-Origin Resource Sharing headers for browser-based requests.
 */

export function corsHeaders(origin?: string): HeadersInit {
  const allowedOrigins = [
    'http://localhost:4200', // Angular dev server
    'http://localhost:8787', // Worker dev server
    'https://leobee.com',
    'https://www.leobee.com'
  ];

  const allowedOrigin = origin && allowedOrigins.includes(origin) 
    ? origin 
    : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Allow-Credentials': 'true'
  };
}

export function handleCorsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}