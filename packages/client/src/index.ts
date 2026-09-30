/* ============================================================================
 * @dreamward/client — thin typed HTTP client for the Dreamward agent API
 * (/api/v1, bearer API-key auth). Shared by the MCP server and the CLI.
 * ========================================================================= */

import { resolveBaseUrl } from './desktop';

export { DESKTOP_URL, desktopAppDir, resolveBaseUrl } from './desktop';

/** Linear-time `/+$` removal (a regex here is quadratic on long slash runs). */
function trimTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url.charCodeAt(end - 1) === 47 /* / */) end--;
  return url.slice(0, end);
}

export class DreamwardApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Dreamward API ${status}: ${body}`);
    this.name = 'DreamwardApiError';
  }
}

export interface DreamwardClientOptions {
  /** e.g. https://dreamward.example.com — /api/v1 is appended automatically. `desktop` = the running desktop app. */
  baseUrl: string;
  /** personal API key (lbk_…) created in Dreamward Settings */
  apiKey: string;
}

export class DreamwardClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(opts: DreamwardClientOptions) {
    this.baseUrl = opts.baseUrl;
    this.headers = { Authorization: `Bearer ${opts.apiKey}` };
  }

  /** Resolved per request, so `desktop` follows the app across restarts. */
  private get root(): string {
    return trimTrailingSlashes(resolveBaseUrl(this.baseUrl)) + '/api/v1';
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    // Content-Type only when a body exists — Fastify 400s on empty JSON bodies.
    const res = await fetch(this.root + path, {
      method,
      headers: body === undefined ? this.headers : { ...this.headers, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new DreamwardApiError(res.status, text.slice(0, 500));
    return (text ? JSON.parse(text) : null) as T;
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }
  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }
  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }
  patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }
  del<T = unknown>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}
