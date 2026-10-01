#!/usr/bin/env node
/* Render the onboarding loops into the web app:
 *   node render.mjs            (all)      node render.mjs wheel steps   (some)
 *
 * Remotion renders PNG frames; ffmpeg (from PATH, or $FFMPEG) encodes them to
 * WebM (VP9) + MP4 (H.264) and saves a still poster for reduced motion.
 * Uses the system ffmpeg on purpose: Remotion's bundled one is unsigned, and
 * Windows Smart App Control blocks it. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ALL = { welcome: 205, chapter: 200, wheel: 200, ikigai: 200, steps: 200, clarity: 200 }; // id → poster frame
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ALL);
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const out = resolve('../apps/web/public/motion');
mkdirSync(out, { recursive: true });

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], shell: cmd === 'npx' && process.platform === 'win32' });

for (const id of ids) {
  if (!(id in ALL)) throw new Error(`unknown composition: ${id}`);
  const frames = resolve('frames', id);
  rmSync(frames, { recursive: true, force: true });
  console.log(`· ${id}`);
  // relative path: on Windows npx runs through a shell, and the repo path may contain spaces
  run('npx', ['remotion', 'render', id, `frames/${id}`, '--sequence', '--image-format=png', '--log=error']);
  const input = ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-i', join(frames, 'element-%03d.png')];
  run(ffmpeg, [...input, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1', '-pix_fmt', 'yuv420p', join(out, `${id}.webm`)]);
  run(ffmpeg, [...input, '-c:v', 'libx264', '-crf', '26', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(out, `${id}.mp4`)]);
  run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', join(frames, `element-${String(ALL[id]).padStart(3, '0')}.png`), '-c:v', 'libwebp', '-quality', '82', join(out, `${id}.webp`)]);
}
console.log(`done → ${out}`);
