/* ============================================================================
 * apps/api — llm/codex/oauth.ts
 * "Sign in with ChatGPT" OAuth (PKCE) — the flow the official Codex CLI uses.
 *
 * EXPERIMENTAL / ToS GRAY AREA: this borrows the Codex CLI's public OAuth
 * client id and talks to ChatGPT's private Codex backend. OpenAI may rotate
 * the client id or change the backend at any time, and using a ChatGPT
 * subscription outside official clients may violate OpenAI's terms. The
 * feature ships disabled (CODEX_ENABLED=false) and is per-user opt-in.
 *
 * Hosted-app twist: the registered redirect is http://localhost:1455 (the
 * CLI's loopback listener). A hosted server can't catch that — but the
 * redirect_uri only has to MATCH at the token exchange, it is never fetched
 * by us. So: user opens the auth URL → approves → browser lands on
 * localhost:1455 (connection refused) → user pastes that final URL back into
 * Dreamward → we extract the code and exchange it server-side with the PKCE
 * verifier we kept.
 * ========================================================================= */
import { createHash, randomBytes, randomUUID } from 'node:crypto';

// All Codex-specific constants in one place (easy to update when they rotate).
export const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
export const CODEX_AUTH_URL = 'https://auth.openai.com/oauth/authorize';
export const CODEX_TOKEN_URL = 'https://auth.openai.com/oauth/token';
export const CODEX_REDIRECT_URI = 'http://localhost:1455/auth/callback';
export const CODEX_RESPONSES_URL = 'https://chatgpt.com/backend-api/codex/responses';
export const CODEX_ORIGINATOR = 'codex_cli_rs';
// ChatGPT-account Codex backend accepts only current Codex models. As of
// June 2026: gpt-5.5 (default), gpt-5.4, gpt-5.4-mini, gpt-5.3-codex.
// Older slugs (gpt-5.1-codex*, gpt-5.2-codex) are deprecated and rejected.
export const CODEX_DEFAULT_MODEL = 'gpt-5.5';
export const CODEX_KNOWN_MODELS = ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex'];
/**
 * The backend validates the `instructions` field against Codex's own base
 * prompt — arbitrary app prompts are rejected. We send this recognized prefix
 * and carry Dreamward's real system prompt inside the input items instead.
 */
export const CODEX_BASE_INSTRUCTIONS =
  'You are Codex, based on GPT-5. You are running as a coding agent in the Codex CLI on a user’s computer.';

export interface CodexTokens {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  accountId: string | null;
  /** epoch ms when accessToken expires (refresh ahead of it) */
  expiresAt: number;
}

interface PendingFlow {
  verifier: string;
  state: string;
  createdAt: number;
}

// Pending PKCE flows, keyed by flow id. Small, short-lived, in-memory only.
const flows = new Map<string, PendingFlow>();
const FLOW_TTL_MS = 15 * 60 * 1000;

function gcFlows() {
  const cutoff = Date.now() - FLOW_TTL_MS;
  for (const [id, f] of flows) if (f.createdAt < cutoff) flows.delete(id);
}

export function startAuthFlow(): { flowId: string; authUrl: string } {
  gcFlows();
  const verifier = randomBytes(64).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('base64url');
  const flowId = randomUUID();
  flows.set(flowId, { verifier, state, createdAt: Date.now() });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CODEX_CLIENT_ID,
    redirect_uri: CODEX_REDIRECT_URI,
    scope: 'openid profile email offline_access',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
    state,
  });
  return { flowId, authUrl: `${CODEX_AUTH_URL}?${params}` };
}

/** Pull the chatgpt account id out of a JWT's claims (no signature check —
 *  we only use it as a routing header for our own authenticated calls). */
function accountIdFromJwt(jwt: string | undefined): string | null {
  if (!jwt) return null;
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
    const auth = payload['https://api.openai.com/auth'] as Record<string, unknown> | undefined;
    return (auth?.['chatgpt_account_id'] as string | undefined) ?? null;
  } catch {
    return null;
  }
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(CODEX_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`token endpoint returned ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

/**
 * Completes a flow from the URL the user's browser ended up on
 * (http://localhost:1455/auth/callback?code=...&state=...). Accepts the full
 * URL or just the code.
 */
export async function completeAuthFlow(flowId: string, callbackUrlOrCode: string): Promise<CodexTokens> {
  const flow = flows.get(flowId);
  if (!flow) throw new Error('unknown_or_expired_flow');
  flows.delete(flowId);

  let code = callbackUrlOrCode.trim();
  if (code.includes('://') || code.includes('?')) {
    const parsed = new URL(code);
    const fromUrl = parsed.searchParams.get('code');
    if (!fromUrl) throw new Error('callback URL carries no ?code=');
    const state = parsed.searchParams.get('state');
    if (state && state !== flow.state) throw new Error('state_mismatch');
    code = fromUrl;
  }

  const json = await postToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: CODEX_REDIRECT_URI,
    client_id: CODEX_CLIENT_ID,
    code_verifier: flow.verifier,
  });
  if (!json.access_token || !json.refresh_token) throw new Error('token exchange returned no tokens');
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    idToken: json.id_token,
    accountId: accountIdFromJwt(json.id_token) ?? accountIdFromJwt(json.access_token),
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

/** Refresh tokens ROTATE — always persist the bundle this returns. */
export async function refreshTokens(tokens: CodexTokens): Promise<CodexTokens> {
  const json = await postToken({
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
    client_id: CODEX_CLIENT_ID,
    scope: 'openid profile email',
  });
  if (!json.access_token) throw new Error('token refresh returned no access token');
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? tokens.refreshToken,
    idToken: json.id_token ?? tokens.idToken,
    accountId: accountIdFromJwt(json.id_token) ?? tokens.accountId,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}
