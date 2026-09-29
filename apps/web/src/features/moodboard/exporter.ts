/* ============================================================================
 * Moodboard exporter — renders the board to PNG at multiple aspect ratios
 * using an off-screen Konva stage. Fit/letterbox mode (always safe), or
 * reflow-to-template when the board has a template applied.
 * ========================================================================= */
import Konva from 'konva';
import { EXPORT_FORMATS, getTemplate, type ExportFormatId } from '@dreamward/shared';
import { downloadZip } from 'client-zip';
import { loadImage } from './useImage';
import type { Asset, BoardItem, BoardWithItems } from './hooks';

export type ExportMode = 'fit' | 'reflow';

async function renderBoard(
  board: BoardWithItems,
  assetsById: Map<string, Asset>,
  targetW: number,
  targetH: number,
  mode: ExportMode,
): Promise<Blob> {
  const container = document.createElement('div');
  const stage = new Konva.Stage({ container, width: targetW, height: targetH });
  const layer = new Konva.Layer();
  stage.add(layer);

  // background
  const bg = (board.background as { color?: string } | null)?.color ?? '#0a0a0f';
  layer.add(new Konva.Rect({ x: 0, y: 0, width: targetW, height: targetH, fill: bg }));

  const items = board.items.slice().sort((a, b) => a.zIndex - b.zIndex);

  let placements: { item: BoardItem; x: number; y: number; w: number; h: number }[];

  const template = mode === 'reflow' && board.templateId ? getTemplate(board.templateId) : undefined;
  if (template) {
    const slots = template.layout(items.length, targetW, targetH);
    placements = items.map((item, i) => {
      const s = slots[i] ?? slots[slots.length - 1] ?? { x: 0, y: 0, width: targetW, height: targetH };
      return { item, x: s.x, y: s.y, w: s.width, h: s.height };
    });
  } else {
    // uniform fit/letterbox of the design canvas into the target
    const scale = Math.min(targetW / board.canvasWidth, targetH / board.canvasHeight);
    const offX = (targetW - board.canvasWidth * scale) / 2;
    const offY = (targetH - board.canvasHeight * scale) / 2;
    placements = items.map((item) => ({
      item,
      x: offX + item.x * scale,
      y: offY + item.y * scale,
      w: item.width * scale,
      h: item.height * scale,
    }));
  }

  for (const p of placements) {
    const asset = assetsById.get(p.item.assetId);
    if (!asset) continue;
    const img = await loadImage(`/media/${asset.webPath}`);
    const crop = p.item.crop ?? { x: 0, y: 0, w: 1, h: 1 };
    layer.add(
      new Konva.Image({
        image: img,
        x: p.x,
        y: p.y,
        width: p.w,
        height: p.h,
        rotation: template ? 0 : p.item.rotation,
        opacity: p.item.opacity,
        cornerRadius: p.item.cornerRadius,
        crop: {
          x: crop.x * img.naturalWidth,
          y: crop.y * img.naturalHeight,
          width: crop.w * img.naturalWidth,
          height: crop.h * img.naturalHeight,
        },
      }),
    );
  }

  layer.draw();
  const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: 1 });
  stage.destroy();

  const res = await fetch(dataUrl);
  return res.blob();
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportBoard(
  board: BoardWithItems,
  assets: Asset[],
  formatId: ExportFormatId,
  mode: ExportMode = 'fit',
): Promise<void> {
  const format = EXPORT_FORMATS.find((f) => f.id === formatId)!;
  const assetsById = new Map(assets.map((a) => [a.id, a]));
  const blob = await renderBoard(board, assetsById, format.width, format.height, mode);
  const safe = board.title.replace(/[^\w֐-׿-]+/g, '_').slice(0, 40);
  download(blob, `${safe}_${format.id}_${format.width}x${format.height}.png`);
}

export async function exportAllFormats(
  board: BoardWithItems,
  assets: Asset[],
  mode: ExportMode = 'fit',
): Promise<void> {
  const assetsById = new Map(assets.map((a) => [a.id, a]));
  const safe = board.title.replace(/[^\w֐-׿-]+/g, '_').slice(0, 40);
  const files: { name: string; input: Blob }[] = [];
  for (const format of EXPORT_FORMATS) {
    const blob = await renderBoard(board, assetsById, format.width, format.height, mode);
    files.push({ name: `${safe}_${format.id}_${format.width}x${format.height}.png`, input: blob });
  }
  const zip = await downloadZip(files).blob();
  download(zip, `${safe}_all_formats.zip`);
}
