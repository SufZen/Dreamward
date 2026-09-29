/* ============================================================================
 * apps/api — agent/searchIndex.ts
 * Global FTS5 index across all Dreamward content for the search_content tool.
 * Wholesale-rebuilt lazily (corpus <100KB → ms); no write-path hooks.
 * ========================================================================= */
import { asc, sql } from 'drizzle-orm';
import type { ListItem } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { stripHtml } from './text';
import { contentVersion } from './digest';

let indexedVersion = -1;

interface Doc {
  docType: string;
  docId: string;
  title: string;
  body: string;
}

function collectDocs(): Doc[] {
  const db = getDb();
  const docs: Doc[] = [];

  const categories = new Map(
    db.select().from(schema.categories).all().map((c) => [c.id, c.labelHe]),
  );
  const types = new Map(db.select().from(schema.sectionTypes).all().map((t) => [t.id, t.labelHe]));

  for (const s of db.select().from(schema.categorySections).all()) {
    const c = s.content as
      | { items?: ListItem[]; habits?: ListItem[]; leverages?: ListItem[]; quote?: string }
      | null;
    const body = [
      stripHtml(s.bodyRichtext),
      ...(c?.items ?? []).map((i) => i.text),
      ...(c?.habits ?? []).map((i) => i.text),
      ...(c?.leverages ?? []).map((i) => i.text),
      c?.quote ?? '',
    ]
      .filter(Boolean)
      .join('\n');
    if (body) {
      docs.push({
        docType: 'section',
        docId: s.id,
        title: `${categories.get(s.categoryId) ?? s.categoryId} · ${types.get(s.sectionType) ?? s.sectionType}`,
        body,
      });
    }
  }

  for (const b of db.select().from(schema.contentBlocks).all()) {
    const items = ((b.content as { items?: ListItem[] } | null)?.items ?? []).map((i) => i.text);
    const body = [stripHtml(b.bodyRichtext), ...items].filter(Boolean).join('\n');
    if (body) docs.push({ docType: 'content_block', docId: b.id, title: b.labelHe, body });
  }

  for (const p of db.select().from(schema.lifeVisionPrompts).all()) {
    const body = stripHtml(p.answerRichtext);
    if (body) docs.push({ docType: 'life_vision', docId: p.id, title: p.question, body });
  }

  for (const g of db.select().from(schema.goals).all()) {
    docs.push({
      docType: 'goal',
      docId: g.id,
      title: g.title,
      body: [g.description ?? '', `status: ${g.status}`].filter(Boolean).join('\n'),
    });
  }

  for (const e of db.select().from(schema.journalEntries).orderBy(asc(schema.journalEntries.entryDate)).all()) {
    docs.push({
      docType: 'journal_entry',
      docId: e.id,
      title: e.title ?? new Date(e.entryDate).toISOString().slice(0, 10),
      body: stripHtml(e.bodyRichtext),
    });
  }

  return docs;
}

export function rebuildContentIndex(): void {
  const db = getDb();
  const docs = collectDocs();
  db.run(sql`DELETE FROM content_fts`);
  for (const d of docs) {
    db.run(
      sql`INSERT INTO content_fts (doc_type, doc_id, title, body) VALUES (${d.docType}, ${d.docId}, ${d.title}, ${d.body})`,
    );
  }
  indexedVersion = contentVersion();
}

export interface SearchHit {
  docType: string;
  docId: string;
  title: string;
  snippet: string;
}

export function searchContent(query: string, limit = 8): SearchHit[] {
  const version = contentVersion();
  if (version !== indexedVersion) rebuildContentIndex();

  const db = getDb();
  // sanitize: FTS5 syntax chars break MATCH; quote each term, prefix-match the last
  const terms = query.replace(/["'*()^]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const match = terms.map((t, i) => (i === terms.length - 1 ? `"${t}"*` : `"${t}"`)).join(' ');

  try {
    return db.all<SearchHit>(sql`
      SELECT doc_type AS docType, doc_id AS docId, title,
             snippet(content_fts, 3, '«', '»', '…', 24) AS snippet
      FROM content_fts WHERE content_fts MATCH ${match}
      ORDER BY rank LIMIT ${limit}
    `);
  } catch {
    return []; // malformed MATCH despite sanitization — return empty, not 500
  }
}
