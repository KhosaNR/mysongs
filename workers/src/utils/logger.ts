/**
 * PII-masked logger utility
 * 
 * Provides structured logging with automatic PII masking for compliance.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Masks sensitive PII data in log entries
 */
function maskPII(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(maskPII);
  }

  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Mask email addresses
    if (lowerKey.includes('email')) {
      masked[key] = maskString(value as string);
    }
    // Mask phone numbers
    else if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
      masked[key] = maskString(value as string);
    }
    // Mask credit card numbers
    else if (lowerKey.includes('card') || lowerKey.includes('cc')) {
      masked[key] = maskString(value as string);
    }
    // Mask addresses
    else if (lowerKey.includes('address') || lowerKey.includes('location')) {
      masked[key] = maskString(value as string);
    }
    // Mask passwords and tokens
    else if (lowerKey.includes('password') || lowerKey.includes('token') || lowerKey.includes('secret')) {
      masked[key] = '***REDACTED***';
    }
    // Recursively mask nested objects
    else if (typeof value === 'object' && value !== null) {
      masked[key] = maskPII(value);
    }
    else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Masks a string by showing first 3 and last 3 characters
 */
function maskString(str: string): string {
  if (str.length <= 6) return '***';
  return str.substring(0, 3) + '***' + str.substring(str.length - 3);
}

/**
 * Logs a message with optional data
 */
export function log(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
  env?: { ENVIRONMENT: string }
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data: data ? (maskPII(data) as Record<string, unknown>) : undefined
  };

  const logLine = JSON.stringify(entry);

  // In production, only log warnings and errors
  if (env?.ENVIRONMENT === 'production' && level === 'debug') {
    return;
  }

  // Use appropriate console method
  switch (level) {
    case 'debug':
      console.debug(logLine);
      break;
    case 'info':
      console.info(logLine);
      break;
    case 'warn':
      console.warn(logLine);
      break;
    case 'error':
      console.error(logLine);
      break;
  }
}

// Convenience methods
export const logger = {
  debug: (message: string, data?: Record<string, unknown>, env?: { ENVIRONMENT: string }) =>
    log('debug', message, data, env),
  info: (message: string, data?: Record<string, unknown>, env?: { ENVIRONMENT: string }) =>
    log('info', message, data, env),
  warn: (message: string, data?: Record<string, unknown>, env?: { ENVIRONMENT: string }) =>
    log('warn', message, data, env),
  error: (message: string, data?: Record<string, unknown>, env?: { ENVIRONMENT: string }) =>
    log('error', message, data, env)
};