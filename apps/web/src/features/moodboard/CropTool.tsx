import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Image as KImage, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useImage } from './useImage';
import type { Asset, BoardItem } from './hooks';

export interface CropResult {
  crop: { x: number; y: number; w: number; h: number };
  box: { x: number; y: number; width: number; height: number };
}

interface Props {
  item: BoardItem;
  asset: Asset | undefined;
  canvasWidth: number;
  canvasHeight: number;
  /** report current crop rect upward so the toolbar Apply can read it */
  onResult: (result: CropResult) => void;
}

/**
 * On-canvas crop editor: shows the FULL (uncropped) image dimmed, with a bright,
 * draggable/resizable selection rectangle over the region that will be kept.
 * Lives inside the Konva Layer; Apply/Cancel buttons live in the toolbar.
 */
export function CropTool({ item, asset, canvasWidth, canvasHeight, onResult }: Props) {
  const img = useImage(asset ? `/media/${asset.webPath}` : undefined);
  const rectRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const crop = item.crop ?? { x: 0, y: 0, w: 1, h: 1 };

  // The full image displayed at the same scale the item currently shows its crop at,
  // positioned so the current crop region overlays the item's current box.
  const fullRect = useMemo(
    () => ({
      x: item.x - (crop.x / crop.w) * item.width,
      y: item.y - (crop.y / crop.h) * item.height,
      width: item.width / crop.w,
      height: item.height / crop.h,
    }),
    [item.x, item.y, item.width, item.height, crop.x, crop.y, crop.w, crop.h],
  );

  // selection rect (canvas units) starts at the current visible region
  const [sel, setSel] = useState({ x: item.x, y: item.y, width: item.width, height: item.height });

  const clamp = (s: typeof sel) => {
    const x = Math.max(fullRect.x, Math.min(s.x, fullRect.x + fullRect.width - 20));
    const y = Math.max(fullRect.y, Math.min(s.y, fullRect.y + fullRect.height - 20));
    const width = Math.max(20, Math.min(s.width, fullRect.x + fullRect.width - x));
    const height = Math.max(20, Math.min(s.height, fullRect.y + fullRect.height - y));
    return { x, y, width, height };
  };

  // attach transformer
  useEffect(() => {
    if (rectRef.current && trRef.current) {
      trRef.current.nodes([rectRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [img]);

  // report normalized result whenever selection changes
  useEffect(() => {
    onResult({
      crop: {
        x: (sel.x - fullRect.x) / fullRect.width,
        y: (sel.y - fullRect.y) / fullRect.height,
        w: sel.width / fullRect.width,
        h: sel.height / fullRect.height,
      },
      box: { x: sel.x, y: sel.y, width: sel.width, height: sel.height },
    });
  }, [sel, fullRect, onResult]);

  if (!img) return null;

  return (
    <>
      {/* dim the whole canvas */}
      <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill="rgba(0,0,0,0.55)" listening={false} />
      {/* full image, dimmed (shows what's available outside the crop) */}
      <KImage image={img} x={fullRect.x} y={fullRect.y} width={fullRect.width} height={fullRect.height} opacity={0.45} listening={false} />
      {/* bright region inside the selection */}
      <Group
        clipX={sel.x}
        clipY={sel.y}
        clipWidth={sel.width}
        clipHeight={sel.height}
        listening={false}
      >
        <KImage image={img} x={fullRect.x} y={fullRect.y} width={fullRect.width} height={fullRect.height} />
      </Group>
      {/* draggable / resizable selection */}
      <Rect
        ref={rectRef}
        x={sel.x}
        y={sel.y}
        width={sel.width}
        height={sel.height}
        stroke="#ffcc00"
        strokeWidth={2}
        strokeScaleEnabled={false}
        dash={[6, 4]}
        draggable
        dragBoundFunc={(pos) => pos}
        onDragMove={(e) => setSel((s) => clamp({ ...s, x: e.target.x(), y: e.target.y() }))}
        onTransform={() => {
          const node = rectRef.current;
          if (!node) return;
          const w = node.width() * node.scaleX();
          const h = node.height() * node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          setSel(clamp({ x: node.x(), y: node.y(), width: w, height: h }));
        }}
      />
      <Transformer ref={trRef} rotateEnabled={false} flipEnabled={false} keepRatio={false} />
    </>
  );
}
