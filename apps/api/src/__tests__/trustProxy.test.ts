/* ============================================================================
 * Client IP behind the shipped proxies. A client must not be able to choose its
 * own IP with X-Forwarded-For: the login rate limit (5/min) keys on it.
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveTrustProxy } from '../env';

const root = mkdtempSync(join(tmpdir(), 'dreamward-proxy-'));
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = root;
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.TRUST_PROXY = 'auto';
delete process.env.DEPLOY_PROFILES;

const { buildServer } = await import('../server');
const { closeControlDb } = await import('../db/control');
const { closeAllUserDbs } = await import('../db/registry');

let app: Awaited<ReturnType<typeof buildServer>>['app'];

beforeAll(async () => {
  ({ app } = await buildServer());
});

afterAll(async () => {
  await app.close();
  closeAllUserDbs();
  closeControlDb();
  rmSync(root, { recursive: true, force: true });
});

const base = { TRUST_PROXY: 'auto', DEPLOY_PROFILES: undefined, DESKTOP_MODE: false };

describe('resolveTrustProxy', () => {
  it('trusts nginx only by default, and Caddy too in https mode', () => {
    expect(resolveTrustProxy(base)).toBe(1);
    expect(resolveTrustProxy({ ...base, DEPLOY_PROFILES: 'https' })).toBe(2);
    expect(resolveTrustProxy({ ...base, DEPLOY_PROFILES: 'other, https' })).toBe(2);
  });

  it('accepts a hop count, false, or a list of proxy addresses', () => {
    expect(resolveTrustProxy({ ...base, TRUST_PROXY: '3' })).toBe(3);
    expect(resolveTrustProxy({ ...base, TRUST_PROXY: 'false' })).toBe(false);
    expect(resolveTrustProxy({ ...base, TRUST_PROXY: '10.0.0.1, 172.16.0.0/12' })).toEqual(['10.0.0.1', '172.16.0.0/12']);
  });

  it('refuses to trust every hop, and trusts nothing on the desktop', () => {
    expect(() => resolveTrustProxy({ ...base, TRUST_PROXY: 'true' })).toThrow(/X-Forwarded-For/);
    expect(resolveTrustProxy({ ...base, DESKTOP_MODE: true })).toBe(false);
  });
});

describe('login rate limit behind nginx', () => {
  it('cannot be reset by rotating X-Forwarded-For', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: '172.18.0.3', // the nginx container
        // nginx appends the address it saw; everything before it came from the client.
        headers: { 'x-forwarded-for': `10.9.8.${i}, 203.0.113.7` },
        payload: { email: 'nobody@example.com', password: 'wrong-password-1' },
      });
      codes.push(res.statusCode);
    }
    expect(codes.slice(0, 5)).not.toContain(429);
    expect(codes.slice(5)).toEqual([429, 429]);
  });
});
