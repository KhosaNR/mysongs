/**
 * Sliding-window rate limiter middleware
 * 
 * Implements rate limiting using Cloudflare KV for distributed rate limiting.
 * Default: 30 requests per minute per user/IP.
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  identifier: string,
  env: { RATE_LIMIT_KV: KVNamespace },
  limit = 5,
  windowSeconds = 60
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;
  
  const key = `ratelimit:${identifier}`;
  
  try {
    // Get existing requests from KV
    const existingData = await env.RATE_LIMIT_KV.get(key, { type: 'json' }) as number[] | null;
    const requests = existingData || [];
    
    // Filter to only keep requests within the current window
    const recentRequests = requests.filter((timestamp: number) => timestamp > windowStart);
    
    const allowed = recentRequests.length < limit;
    const remaining = Math.max(0, limit - recentRequests.length);
    
    if (allowed) {
      // Add current request timestamp
      recentRequests.push(now);
      
      // Store back to KV with TTL slightly longer than window
      await env.RATE_LIMIT_KV.put(key, JSON.stringify(recentRequests), {
        expirationTtl: windowSeconds + 10
      });
    }
    
    return {
      allowed,
      remaining: allowed ? remaining - 1 : 0,
      resetAt: windowStart + windowSeconds
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request if rate limiter fails
    return { allowed: true, remaining: limit - 1, resetAt: windowStart + windowSeconds };
  }
}

export function rateLimitHeaders(result: RateLimitResult, limit = 30): HeadersInit {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toString()
  };
}