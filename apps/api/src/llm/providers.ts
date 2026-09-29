import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { decryptSecret } from '../lib/crypto';
import type { ProviderConfig } from './types';

export function toConfig(row: typeof schema.llmProviders.$inferSelect): ProviderConfig {
  return {
    id: row.id,
    name: row.name,
    kind: (row.kind ?? 'openai-compat') as ProviderConfig['kind'],
    baseUrl: row.baseUrl,
    apiKey: row.apiKey ? decryptSecret(row.apiKey) : null,
    model: row.model,
    toolsMode: row.toolsMode as ProviderConfig['toolsMode'],
    toolsDetected: row.toolsDetected,
    contextLength: row.contextLength,
    oauthJson: row.oauthJson ? decryptSecret(row.oauthJson) : null,
  };
}

export function getActiveProvider(): ProviderConfig | null {
  const db = getDb();
  const row = db
    .select()
    .from(schema.llmProviders)
    .where(eq(schema.llmProviders.isActive, 1))
    .orderBy(desc(schema.llmProviders.updatedAt))
    .limit(1)
    .get();
  return row ? toConfig(row) : null;
}

/** Should the agent loop attempt native tool-calling for this provider? */
export function resolveToolSupport(provider: ProviderConfig): boolean {
  if (provider.toolsMode === 'on') return true;
  if (provider.toolsMode === 'off') return false;
  // auto: trust the probe; unknown → try tools (runtime downgrade handles failure)
  return provider.toolsDetected !== 0;
}

/** Persist a runtime tools-capability discovery (downgrade/upgrade). */
export function persistToolsDetected(providerId: string, detected: boolean): void {
  const db = getDb();
  db.update(schema.llmProviders)
    .set({ toolsDetected: detected ? 1 : 0, updatedAt: Date.now() })
    .where(eq(schema.llmProviders.id, providerId))
    .run();
}
