/* ============================================================================
 * Framework packs: the default pack covers the whole structure; a custom pack
 * (FRAMEWORK_PACK_FILE) relabels areas, sections and vision prompts in every
 * book without touching content; an invalid pack stops the server at boot.
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CATEGORY_KEYS,
  CONTENT_BLOCK_KEYS,
  DEFAULT_PACK,
  SECTION_TYPE_KEYS,
  VISION_PROMPT_KEYS,
  frameworkPackOverrideSchema,
  mergePack,
  structureFor,
} from '@dreamward/shared';

const root = mkdtempSync(join(tmpdir(), 'dreamward-frameworks-'));
const packFile = join(root, 'pack.json');
writeFileSync(
  packFile,
  JSON.stringify({
    id: 'my-coach-pack',
    categories: { health_fitness: { en: 'Vitality' }, career: { en: 'Craft', he: 'מלאכה' } },
    sectionTypes: { premises: { en: 'Core beliefs' } },
    visionPrompts: { ideal_day: { en: 'My best Tuesday', he: 'יום שלישי הכי טוב שלי' } },
  }),
);

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = join(root, 'data');
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.DREAMWARD_EMAIL = 'packs@example.com';
process.env.DREAMWARD_PASSWORD = 'packs-password-1';
process.env.FRAMEWORK_PACK_FILE = packFile;

const { buildServer } = await import('../server');
const { closeControlDb } = await import('../db/control');
const { closeAllUserDbs } = await import('../db/registry');
const { resetFrameworkCache } = await import('../lib/framework');

let app: Awaited<ReturnType<typeof buildServer>>['app'];
let cookie = '';

beforeAll(async () => {
  ({ app } = await buildServer());
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'packs@example.com', password: 'packs-password-1' } });
  cookie = `lb_session=${res.cookies.find((c) => c.name === 'lb_session')!.value}`;
});

afterAll(async () => {
  await app.close();
  closeAllUserDbs();
  closeControlDb();
  rmSync(root, { recursive: true, force: true });
});

describe('framework packs', () => {
  it('the default pack labels every id in both languages', () => {
    for (const [keys, labels] of [
      [CATEGORY_KEYS, DEFAULT_PACK.categories],
      [SECTION_TYPE_KEYS, DEFAULT_PACK.sectionTypes],
      [CONTENT_BLOCK_KEYS, DEFAULT_PACK.contentBlocks],
      [VISION_PROMPT_KEYS, DEFAULT_PACK.visionPrompts],
    ] as const) {
      for (const k of keys) {
        const l = (labels as Record<string, { en: string; he: string }>)[k];
        expect(l?.en, k).toBeTruthy();
        expect(l?.he, k).toBeTruthy();
      }
    }
    const s = structureFor(DEFAULT_PACK);
    expect(s.categories).toHaveLength(12);
    expect(s.visionPrompts).toHaveLength(VISION_PROMPT_KEYS.length);
  });

  it('merges a partial pack over the default one', () => {
    const merged = mergePack({ categories: { love: { en: 'Us' } } });
    expect(merged.categories.love).toEqual({ en: 'Us', he: DEFAULT_PACK.categories.love.he });
    expect(merged.categories.career).toEqual(DEFAULT_PACK.categories.career);
  });

  it('rejects unknown ids and unknown keys', () => {
    expect(frameworkPackOverrideSchema.safeParse({ categories: { hobbies: { en: 'x' } } }).success).toBe(false);
    expect(frameworkPackOverrideSchema.safeParse({ colors: {} }).success).toBe(false);
  });

  it("applies the server's custom pack to the book", async () => {
    const cats = (await app.inject({ method: 'GET', url: '/api/categories', headers: { cookie } })).json() as { id: string; labelEn: string; labelHe: string }[];
    expect(cats.find((c) => c.id === 'health_fitness')).toMatchObject({ labelEn: 'Vitality', labelHe: DEFAULT_PACK.categories.health_fitness.he });
    expect(cats.find((c) => c.id === 'career')).toMatchObject({ labelEn: 'Craft', labelHe: 'מלאכה' });

    const cat = (await app.inject({ method: 'GET', url: '/api/categories/health_fitness', headers: { cookie } })).json() as {
      sections: { sectionType: string; labelEn: string }[];
    };
    expect(cat.sections.find((s) => s.sectionType === 'premises')?.labelEn).toBe('Core beliefs');

    const prompts = (await app.inject({ method: 'GET', url: '/api/life-vision', headers: { cookie } })).json() as { id: string; labelEn: string; labelHe: string }[];
    expect(prompts.find((p) => p.id === 'ideal_day')).toMatchObject({ labelEn: 'My best Tuesday', labelHe: 'יום שלישי הכי טוב שלי' });
  });

  it('refuses to boot with an invalid pack', async () => {
    const bad = join(root, 'bad.json');
    writeFileSync(bad, JSON.stringify({ categories: { not_an_area: { en: 'x' } } }));
    process.env.FRAMEWORK_PACK_FILE = bad;
    resetFrameworkCache();
    try {
      await expect(buildServer()).rejects.toThrow(/not a valid framework pack/);
    } finally {
      process.env.FRAMEWORK_PACK_FILE = packFile;
      resetFrameworkCache();
    }
  });
});
