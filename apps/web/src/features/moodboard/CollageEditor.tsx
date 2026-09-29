import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Stage, Layer, Rect, Image as KImage, Transformer } from 'react-konva';
import type Konva from 'konva';
import {
  ArrowLeft,
  ArrowUpToLine,
  ArrowDownToLine,
  Trash2,
  Upload,
  LayoutGrid,
  Download,
  Crop,
  Check,
  X,
} from 'lucide-react';
import { TEMPLATES, EXPORT_FORMATS, type ExportFormatId } from '@dreamward/shared';
import { Button, Card, cn } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { useAutosave } from '@/lib/useAutosave';
import { SaveIndicator } from '@/components/SaveIndicator';
import { api } from '@/lib/api';
import { useBoard, useAssets, useSaveItems, useUploadAsset, useDeleteAsset, type Asset, type BoardItem } from './hooks';
import { useImage } from './useImage';
import { exportBoard, exportAllFormats } from './exporter';
import { CropTool, type CropResult } from './CropTool';

function CanvasImage({
  item,
  asset,
  isSelected,
  onSelect,
  onChange,
  onCrop,
}: {
  item: BoardItem;
  asset: Asset | undefined;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<BoardItem>) => void;
  onCrop: () => void;
}) {
  const img = useImage(asset ? `/media/${asset.webPath}` : undefined);
  const ref = useRef<Konva.Image>(null);

  const crop = item.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const cropPx = img
    ? {
        x: crop.x * img.naturalWidth,
        y: crop.y * img.naturalHeight,
        width: crop.w * img.naturalWidth,
        height: crop.h * img.naturalHeight,
      }
    : undefined;

  return (
    <KImage
      ref={ref}
      id={item.id}
      image={img}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      rotation={item.rotation}
      opacity={item.opacity}
      cornerRadius={item.cornerRadius}
      crop={cropPx}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onCrop}
      onDblTap={onCrop}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = ref.current;
        if (!node) return;
        // bake scale into width/height so export stays crisp
        const w = Math.max(20, node.width() * node.scaleX());
        const h = Math.max(20, node.height() * node.scaleY());
        node.scaleX(1);
        node.scaleY(1);
        onChange({ x: node.x(), y: node.y(), width: w, height: h, rotation: node.rotation() });
      }}
      stroke={isSelected ? '#ffcc00' : undefined}
      strokeWidth={isSelected ? 2 : 0}
    />
  );
}

export function CollageEditor() {
  const { boardId = '' } = useParams();
  const { t, lang } = useLang();
  const { data: board, isLoading } = useBoard(boardId);
  const { data: assets } = useAssets();
  const deleteAsset = useDeleteAsset();
  const saveItems = useSaveItems(boardId);
  const upload = useUploadAsset();

  const [items, setItems] = useState<BoardItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const cropResult = useRef<CropResult | null>(null);
  const [exporting, setExporting] = useState(false);
  const stageWrap = useRef<HTMLDivElement>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [viewW, setViewW] = useState(900);

  // initialise draft items once the board loads
  useEffect(() => {
    if (board && items === null) setItems(board.items);
  }, [board, items]);

  // fit stage to container width
  useEffect(() => {
    const el = stageWrap.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setViewW(el.clientWidth));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const assetsById = useMemo(() => new Map((assets ?? []).map((a) => [a.id, a])), [assets]);

  // autosave canvas state
  const status = useAutosave(items ? JSON.stringify(items) : '', async () => {
    if (items) await saveItems.mutateAsync(items);
  });

  // attach transformer to selection (disabled while cropping)
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const node = selectedId && !cropId ? stage.findOne(`#${selectedId}`) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, items, cropId]);

  const enterCrop = useCallback((id: string) => {
    setSelectedId(null);
    cropResult.current = null;
    setCropId(id);
  }, []);

  const applyCrop = () => {
    if (cropId && cropResult.current) {
      const { crop, box } = cropResult.current;
      patchItem(cropId, { crop, ...box });
    }
    setCropId(null);
    cropResult.current = null;
  };

  const cancelCrop = () => {
    setCropId(null);
    cropResult.current = null;
  };

  const patchItem = useCallback(
    (id: string, patch: Partial<BoardItem>) =>
      setItems((prev) => (prev ? prev.map((it) => (it.id === id ? { ...it, ...patch } : it)) : prev)),
    [],
  );

  if (isLoading || !board || items === null) return <p className="text-fg-muted">{t('loading')}</p>;

  const scale = viewW / board.canvasWidth;
  const viewH = board.canvasHeight * scale;
  const bg = (board.background as { color?: string } | null)?.color ?? '#0a0a0f';
  const maxZ = items.reduce((m, it) => Math.max(m, it.zIndex), 0);
  const sorted = items.slice().sort((a, b) => a.zIndex - b.zIndex);
  const cropItem = cropId ? items.find((it) => it.id === cropId) : undefined;

  const addAsset = (asset: Asset) => {
    const w = Math.min(500, board.canvasWidth / 3);
    const h = asset.width ? (w * asset.height) / asset.width : w;
    const it: BoardItem = {
      id: `it_${crypto.randomUUID().slice(0, 8)}`,
      assetId: asset.id,
      x: board.canvasWidth / 2 - w / 2,
      y: board.canvasHeight / 2 - h / 2,
      width: w,
      height: h,
      rotation: 0,
      zIndex: maxZ + 1,
      crop: { x: 0, y: 0, w: 1, h: 1 },
      cornerRadius: 0,
      opacity: 1,
    };
    setItems([...items, it]);
    setSelectedId(it.id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setItems(items.filter((it) => it.id !== selectedId));
    setSelectedId(null);
  };

  const bumpZ = (dir: 1 | -1) => {
    if (!selectedId) return;
    patchItem(selectedId, { zIndex: dir === 1 ? maxZ + 1 : Math.min(...items.map((i) => i.zIndex)) - 1 });
  };

  const applyTemplate = async (templateId: string) => {
    const template = TEMPLATES.find((tp) => tp.id === templateId);
    if (!template) return;
    const slots = template.layout(items.length, board.canvasWidth, board.canvasHeight);
    setItems(
      items.map((it, i) => {
        const s = slots[i];
        return s ? { ...it, x: s.x, y: s.y, width: s.width, height: s.height, rotation: 0 } : it;
      }),
    );
    await api.put(`/moodboards/${board.id}`, { templateId });
  };

  const doExport = async (formatId: ExportFormatId | 'all') => {
    if (!assets) return;
    setExporting(true);
    try {
      const current = { ...board, items };
      if (formatId === 'all') await exportAllFormats(current, assets);
      else await exportBoard(current, assets, formatId);
    } finally {
      setExporting(false);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const asset = await upload.mutateAsync(file);
      addAsset(asset);
    }
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/moodboard" className="text-fg-muted hover:text-foreground">
          <ArrowLeft size={18} className="rtl:rotate-180" />
        </Link>
        <h1 dir="auto" className="me-auto truncate text-2xl font-bold">
          {board.title}
        </h1>
        <SaveIndicator status={status} />
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-surface px-3 text-xs text-foreground hover:bg-surface-hover">
            <Upload size={13} /> {lang === 'he' ? 'העלאת תמונה' : 'Upload image'}
          </span>
        </label>

        <div className="flex items-center gap-1.5">
          <LayoutGrid size={14} className="text-fg-subtle" />
          <select
            defaultValue={board.templateId ?? ''}
            onChange={(e) => e.target.value && applyTemplate(e.target.value)}
            className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">{lang === 'he' ? 'תבנית…' : 'Template…'}</option>
            {TEMPLATES.map((tp) => (
              <option key={tp.id} value={tp.id}>
                {lang === 'he' ? tp.labelHe : tp.labelEn}
              </option>
            ))}
          </select>
        </div>

        {selectedId && !cropId && (
          <>
            <Button variant="secondary" size="sm" onClick={() => enterCrop(selectedId)}>
              <Crop size={13} /> {lang === 'he' ? 'חיתוך' : 'Crop'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => bumpZ(1)}>
              <ArrowUpToLine size={13} /> {lang === 'he' ? 'לחזית' : 'Front'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => bumpZ(-1)}>
              <ArrowDownToLine size={13} /> {lang === 'he' ? 'לרקע' : 'Back'}
            </Button>
            <Button variant="danger" size="sm" onClick={removeSelected}>
              <Trash2 size={13} /> {lang === 'he' ? 'הסר' : 'Remove'}
            </Button>
          </>
        )}

        {cropId && (
          <>
            <span className="text-xs text-fg-muted">
              {lang === 'he' ? 'גרור/שנה את מלבן החיתוך' : 'Drag/resize the crop box'}
            </span>
            <Button variant="primary" size="sm" onClick={applyCrop}>
              <Check size={13} /> {lang === 'he' ? 'החל חיתוך' : 'Apply crop'}
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelCrop}>
              <X size={13} /> {lang === 'he' ? 'ביטול' : 'Cancel'}
            </Button>
          </>
        )}

        <div className="ms-auto flex items-center gap-1.5">
          <Download size={14} className="text-fg-subtle" />
          {EXPORT_FORMATS.map((f) => (
            <Button key={f.id} variant="secondary" size="sm" disabled={exporting} onClick={() => doExport(f.id)}>
              {lang === 'he' ? f.labelHe : f.labelEn}
            </Button>
          ))}
          <Button variant="primary" size="sm" disabled={exporting} onClick={() => doExport('all')}>
            {exporting ? '…' : lang === 'he' ? 'הכל (ZIP)' : 'All (ZIP)'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
        {/* canvas */}
        <div ref={stageWrap} className="overflow-hidden rounded-lg border border-border">
          <Stage
            ref={stageRef}
            width={viewW}
            height={viewH}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) setSelectedId(null);
            }}
          >
            <Layer>
              <Rect
                x={0}
                y={0}
                width={board.canvasWidth}
                height={board.canvasHeight}
                fill={bg}
                onClick={() => setSelectedId(null)}
              />
              {cropItem ? (
                <CropTool
                  item={cropItem}
                  asset={assetsById.get(cropItem.assetId)}
                  canvasWidth={board.canvasWidth}
                  canvasHeight={board.canvasHeight}
                  onResult={(r) => (cropResult.current = r)}
                />
              ) : (
                <>
                  {sorted.map((it) => (
                    <CanvasImage
                      key={it.id}
                      item={it}
                      asset={assetsById.get(it.assetId)}
                      isSelected={selectedId === it.id}
                      onSelect={() => setSelectedId(it.id)}
                      onChange={(patch) => patchItem(it.id, patch)}
                      onCrop={() => enterCrop(it.id)}
                    />
                  ))}
                  <Transformer ref={trRef} rotateEnabled keepRatio={false} flipEnabled={false} />
                </>
              )}
            </Layer>
          </Stage>
        </div>

        {/* asset library */}
        <Card className="max-h-[70vh] overflow-y-auto p-2">
          <p className="px-1 pb-2 text-2xs font-mono uppercase tracking-wider text-fg-faint">
            {lang === 'he' ? 'ספריית תמונות' : 'Asset library'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {assets?.map((a) => (
              <div key={a.id} className="group relative overflow-hidden rounded-md border border-border hover:border-primary">
                <button
                  onClick={() => addAsset(a)}
                  className="block w-full transition-transform hover:scale-[1.04]"
                  title={lang === 'he' ? 'הוסף ללוח' : 'Add to board'}
                >
                  <img src={`/media/${a.thumbPath}`} alt="" loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                </button>
                <button
                  onClick={() => deleteAsset.mutate({ id: a.id, force: true })}
                  className="absolute end-1 top-1 rounded-full bg-bg-sunken/80 p-1 text-danger opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                  title={lang === 'he' ? 'מחק מהספרייה' : 'Delete from library'}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
