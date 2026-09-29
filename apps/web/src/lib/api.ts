/** Thin fetch wrapper for the same-origin Dreamward API (cookie auth). */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    /** full parsed error body when available (e.g. 409 in-use carries `boards`) */
    public body?: unknown,
  ) {
    super(code);
  }
}

/** Called when any request returns 401 — wired to redirect to /login. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError(401, 'unauthorized');
  }
  if (!res.ok) {
    let code = 'error';
    let parsed: unknown;
    try {
      parsed = await res.json();
      code = (parsed as { error?: string }).error ?? code;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, code, parsed);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

/** Multipart upload (images) — separate from JSON requests. */
export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api${path}`, { method: 'POST', credentials: 'same-origin', body: form });
  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError(401, 'unauthorized');
  }
  if (!res.ok) throw new ApiError(res.status, 'upload_failed');
  return (await res.json()) as T;
}
