/* ============================================================================
 * apps/api — lib/urlGuard.ts
 * SSRF guard for user-supplied AI provider base URLs. On a shared server a
 * user must not be able to aim the backend at the host's private network
 * (cloud metadata, databases, admin panels). Single-user / desktop / dev
 * installs keep local model servers (Ollama, LM Studio) working.
 * ========================================================================= */
import { BlockList, isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { loadEnv } from '../env';

const blocked = new BlockList();
// IPv4
blocked.addSubnet('0.0.0.0', 8, 'ipv4');
blocked.addSubnet('10.0.0.0', 8, 'ipv4');
blocked.addSubnet('100.64.0.0', 10, 'ipv4'); // CGNAT / Tailscale
blocked.addSubnet('127.0.0.0', 8, 'ipv4');
blocked.addSubnet('169.254.0.0', 16, 'ipv4'); // link-local + cloud metadata
blocked.addSubnet('172.16.0.0', 12, 'ipv4');
blocked.addSubnet('192.168.0.0', 16, 'ipv4');
blocked.addSubnet('224.0.0.0', 3, 'ipv4'); // multicast + reserved
// IPv6
blocked.addAddress('::', 'ipv6');
blocked.addAddress('::1', 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6'); // unique local
blocked.addSubnet('fe80::', 10, 'ipv6'); // link-local

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

export function isPrivateAddress(ip: string): boolean {
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return blocked.check(mapped[1]!, 'ipv4');
  const family = isIP(ip);
  if (family === 4) return blocked.check(ip, 'ipv4');
  if (family === 6) return blocked.check(ip, 'ipv6');
  return true; // not an IP → treat as unsafe
}

/** Private targets are allowed unless this is a multi-user production server (overridable). */
export function privateUrlsAllowed(): boolean {
  const env = loadEnv();
  if (env.ALLOW_PRIVATE_AI_URLS) return env.ALLOW_PRIVATE_AI_URLS === 'true';
  return env.NODE_ENV !== 'production' || env.MAX_USERS <= 1;
}

/** Throws UnsafeUrlError for non-http(s) URLs and (when not allowed) private destinations. */
export async function assertProviderUrlAllowed(raw: string, allowPrivate = privateUrlsAllowed()): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Invalid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeUrlError('Only http(s) URLs are allowed.');
  if (url.username || url.password) throw new UnsafeUrlError('Credentials in the URL are not allowed — use the API key field.');
  if (allowPrivate) return;

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) {
    throw new UnsafeUrlError('Local/private addresses are disabled on this server (ask the admin to set ALLOW_PRIVATE_AI_URLS).');
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw new UnsafeUrlError(`Cannot resolve ${host}.`);
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError('Local/private addresses are disabled on this server (ask the admin to set ALLOW_PRIVATE_AI_URLS).');
  }
}
