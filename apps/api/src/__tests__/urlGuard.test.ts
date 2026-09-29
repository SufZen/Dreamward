/* SSRF guard for AI provider base URLs. */
import { describe, it, expect } from 'vitest';

process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret';
const { assertProviderUrlAllowed, isPrivateAddress, UnsafeUrlError } = await import('../lib/urlGuard');

describe('isPrivateAddress', () => {
  it.each([
    ['127.0.0.1', true],
    ['10.1.2.3', true],
    ['172.20.0.5', true],
    ['192.168.1.10', true],
    ['169.254.169.254', true], // cloud metadata
    ['100.100.1.1', true], // CGNAT / tailnet
    ['::1', true],
    ['fd00::1', true],
    ['::ffff:10.0.0.1', true],
    ['8.8.8.8', false],
    ['2606:4700::1111', false],
  ])('%s → %s', (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected);
  });
});

describe('assertProviderUrlAllowed (multi-user server)', () => {
  const deny = (url: string) => expect(assertProviderUrlAllowed(url, false)).rejects.toBeInstanceOf(UnsafeUrlError);

  it('refuses private, loopback and metadata destinations', async () => {
    await deny('http://localhost:11434/v1');
    await deny('http://127.0.0.1:8000/v1');
    await deny('http://169.254.169.254/latest/meta-data');
    await deny('http://[::1]:11434/v1');
    await deny('http://ollama.local:11434/v1');
  });

  it('refuses non-http schemes and embedded credentials', async () => {
    await deny('file:///etc/passwd');
    await deny('ftp://example.com');
    await deny('https://user:pass@api.example.com/v1');
    await deny('not a url');
  });

  it('allows public IP literals', async () => {
    await expect(assertProviderUrlAllowed('https://8.8.8.8/v1', false)).resolves.toBeUndefined();
  });

  it('allows everything http(s) when private URLs are permitted (single-user / desktop)', async () => {
    await expect(assertProviderUrlAllowed('http://localhost:11434/v1', true)).resolves.toBeUndefined();
    await expect(assertProviderUrlAllowed('file:///x', true)).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});
