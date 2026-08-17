/**
 * Shared service-account resolver for maintenance scripts.
 *
 * Resolution order:
 *   1. GOOGLE_APPLICATION_CREDENTIALS - path to a service-account JSON file (wins when set)
 *   2. `--env qa` - firebaseServiceAccount from src/environments/environment.qa.ts
 *   3. default - firebaseServiceAccount from environment.ts
 */
import { readFileSync } from 'node:fs';
import { environment as defaultEnvironment } from '../../src/environments/environment';

export type TargetEnv = 'default' | 'qa';

export function resolveTargetEnv(): TargetEnv {
  const idx = process.argv.indexOf('--env');
  return idx >= 0 && process.argv[idx + 1] === 'qa' ? 'qa' : 'default';
}

export async function resolveServiceAccount(target: TargetEnv = 'default'): Promise<Record<string, unknown>> {
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credsPath) {
    return JSON.parse(readFileSync(credsPath, 'utf8')) as Record<string, unknown>;
  }
  if (target === 'qa') {
    // Dynamic import so scripts still run on checkouts lacking the private QA file.
    const { environment: qaEnvironment } = await import('../../src/environments/environment.qa');
    return qaEnvironment.firebaseServiceAccount;
  }
  return defaultEnvironment.firebaseServiceAccount;
}
