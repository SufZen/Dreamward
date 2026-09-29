import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { assetsDir } from './paths';

export interface ProcessedImage {
  originalPath: string; // relative to assets dir
  webPath: string;
  thumbPath: string;
  width: number;
  height: number;
  mime: string;
  bytes: number;
}

/**
 * Persist an original image buffer and generate web (<=1600px) + thumb (320px)
 * webp derivatives. Returns paths RELATIVE to the assets dir (served under /media).
 */
export async function processImage(
  dataRoot: string,
  id: string,
  buffer: Buffer,
  ext: string,
): Promise<ProcessedImage> {
  const root = assetsDir(dataRoot);
  const origRel = join('originals', `${id}.${ext}`);
  const derivedDir = join('derived', id);
  mkdirSync(join(root, derivedDir), { recursive: true });

  const img = sharp(buffer, { failOn: 'none' });
  const meta = await img.metadata();
  const isGif = meta.format === 'gif';

  // write original as-is, then build derivatives in parallel
  const origAbs = join(root, origRel);
  const thumbRel = join(derivedDir, 'thumb.webp');
  const webRel = isGif ? origRel : join(derivedDir, 'web.webp');

  const tasks: Promise<unknown>[] = [sharp(buffer).toFile(origAbs)];

  // Animated GIFs are served as-is (web == original) to preserve animation;
  // we only generate a static first-frame thumbnail for the picker grid.
  if (!isGif) {
    tasks.push(
      sharp(buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(join(root, webRel)),
    );
  }
  tasks.push(
    sharp(buffer)
      .rotate()
      .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toFile(join(root, thumbRel)),
  );
  await Promise.all(tasks);

  return {
    originalPath: origRel.replaceAll('\\', '/'),
    webPath: webRel.replaceAll('\\', '/'),
    thumbPath: thumbRel.replaceAll('\\', '/'),
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    mime: `image/${meta.format ?? ext}`,
    bytes: buffer.length,
  };
}
