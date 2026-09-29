/* ============================================================================
 * Asset lifecycle: upload creates files, delete removes them, in-use returns
 * 409 with board titles, force-delete detaches, GIFs keep their animation.
 * ========================================================================= */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'dreamward-assets-'));
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.DREAMWARD_EMAIL = 'admin@test.local';
process.env.DREAMWARD_PASSWORD = 'admin-pass-123';

const { buildServer } = await import('../server');
const { closeControlDb } = await import('../db/control');
const { closeAllUserDbs } = await import('../db/registry');

let app: Awaited<ReturnType<typeof buildServer>>['app'];
let cookie: string;

async function pngBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .png()
    .toBuffer();
}
async function gifBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 10, g: 200, b: 90 } } })
    .gif()
    .toBuffer();
}

function multipart(buffer: Buffer, filename: string, mime: string) {
  const boundary = '----lbtest' + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, buffer, tail]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, cookie } };
}

async function upload(buffer: Buffer, filename: string, mime: string) {
  const { payload, headers } = multipart(buffer, filename, mime);
  const res = await app.inject({ method: 'POST', url: '/api/assets', payload, headers });
  return res;
}

beforeAll(async () => {
  ({ app } = await buildServer());
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@test.local', password: 'admin-pass-123' },
  });
  cookie = `lb_session=${login.cookies.find((c) => c.name === 'lb_session')!.value}`;
});

afterAll(async () => {
  await app.close();
  closeAllUserDbs();
  closeControlDb();
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});

const assetsRoot = () => join(process.env.DATA_DIR!, 'users', '1', 'assets');

describe('asset lifecycle', () => {
  it('uploads, writes files, lists with usedIn=0, then deletes files', async () => {
    const up = await upload(await pngBuffer(), 'pic.png', 'image/png');
    expect(up.statusCode).toBe(200);
    const asset = up.json() as { id: string; originalPath: string; webPath: string; thumbPath: string; usedIn: number };
    expect(asset.usedIn).toBe(0);
    expect(existsSync(join(assetsRoot(), asset.originalPath))).toBe(true);
    expect(existsSync(join(assetsRoot(), asset.webPath))).toBe(true);
    expect(existsSync(join(assetsRoot(), asset.thumbPath))).toBe(true);

    const del = await app.inject({ method: 'DELETE', url: `/api/assets/${asset.id}`, headers: { cookie } });
    expect(del.statusCode).toBe(200);
    expect(existsSync(join(assetsRoot(), asset.originalPath))).toBe(false);
    expect(existsSync(join(assetsRoot(), asset.webPath))).toBe(false);
    expect(existsSync(join(assetsRoot(), asset.thumbPath))).toBe(false);

    const list = await app.inject({ method: 'GET', url: '/api/assets', headers: { cookie } });
    expect((list.json() as unknown[]).length).toBe(0);
  });

  it('serves animated GIFs as-is (web === original) with a static thumb', async () => {
    const up = await upload(await gifBuffer(), 'anim.gif', 'image/gif');
    expect(up.statusCode).toBe(200);
    const a = up.json() as { webPath: string; originalPath: string; thumbPath: string; mime: string };
    expect(a.mime).toBe('image/gif');
    expect(a.webPath).toBe(a.originalPath);
    expect(a.thumbPath).not.toBe(a.originalPath);
    expect(existsSync(join(assetsRoot(), a.thumbPath))).toBe(true);
  });

  it('refuses non-image uploads', async () => {
    const res = await upload(Buffer.from('not an image'), 'note.txt', 'text/plain');
    expect(res.statusCode).toBe(415);
  });

  it('blocks delete of an in-use asset (409 with board titles), force detaches', async () => {
    const up = await upload(await pngBuffer(), 'board-pic.png', 'image/png');
    const asset = up.json() as { id: string };

    const board = await app.inject({
      method: 'POST',
      url: '/api/moodboards',
      headers: { cookie },
      payload: { title: 'Vision Board' },
    });
    const boardId = (board.json() as { id: string }).id;
    const putItems = await app.inject({
      method: 'PUT',
      url: `/api/moodboards/${boardId}/items`,
      headers: { cookie },
      payload: {
        items: [{ id: 'item-1', assetId: asset.id, x: 0, y: 0, width: 100, height: 100 }],
      },
    });
    expect(putItems.statusCode).toBe(200);

    // delete without force → 409 listing the board
    const blocked = await app.inject({ method: 'DELETE', url: `/api/assets/${asset.id}`, headers: { cookie } });
    expect(blocked.statusCode).toBe(409);
    const body = blocked.json() as { error: string; boards: { title: string }[] };
    expect(body.error).toBe('in_use');
    expect(body.boards.map((b) => b.title)).toContain('Vision Board');

    // listing shows usedIn=1
    const list = await app.inject({ method: 'GET', url: '/api/assets', headers: { cookie } });
    expect((list.json() as { id: string; usedIn: number }[]).find((r) => r.id === asset.id)?.usedIn).toBe(1);

    // force → detaches from the board and deletes
    const forced = await app.inject({ method: 'DELETE', url: `/api/assets/${asset.id}?force=true`, headers: { cookie } });
    expect(forced.statusCode).toBe(200);
    const after = await app.inject({ method: 'GET', url: `/api/moodboards/${boardId}`, headers: { cookie } });
    expect((after.json() as { items: unknown[] }).items.length).toBe(0);
  });
});
