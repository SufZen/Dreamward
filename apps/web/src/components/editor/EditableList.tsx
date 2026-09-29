import { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import type { ListItem } from '@dreamward/shared';
import { Button, Textarea, cn } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';

interface Props {
  items: ListItem[];
  onChange: (items: ListItem[]) => void;
}

const reindex = (items: ListItem[]): ListItem[] => items.map((it, i) => ({ ...it, order: i }));

function Row({
  item,
  onText,
  onRemove,
}: {
  item: ListItem;
  onText: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-start gap-2', isDragging && 'z-10 opacity-80')}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-2.5 cursor-grab touch-none text-fg-faint hover:text-fg-muted active:cursor-grabbing"
        aria-label="drag to reorder"
        type="button"
      >
        <GripVertical size={16} />
      </button>
      <Textarea
        dir="auto"
        rows={1}
        value={item.text}
        onChange={(e) => onText(item.id, e.target.value)}
        className="min-h-9 flex-1 leading-relaxed"
      />
      <Button variant="ghost" size="icon" onClick={() => onRemove(item.id)} aria-label="delete item">
        <Trash2 size={15} />
      </Button>
    </div>
  );
}

export function EditableList({ items, onChange }: Props) {
  const { lang } = useLang();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const from = items.findIndex((it) => it.id === active.id);
      const to = items.findIndex((it) => it.id === over.id);
      onChange(reindex(arrayMove(items, from, to)));
    },
    [items, onChange],
  );

  const setText = (id: string, text: string) =>
    onChange(items.map((it) => (it.id === id ? { ...it, text } : it)));

  const remove = (id: string) => onChange(reindex(items.filter((it) => it.id !== id)));

  const add = () =>
    onChange(reindex([...items, { id: `new_${crypto.randomUUID().slice(0, 8)}`, text: '', order: items.length }]));

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
          {items.map((it) => (
            <Row key={it.id} item={it} onText={setText} onRemove={remove} />
          ))}
        </SortableContext>
      </DndContext>
      <Button variant="ghost" size="sm" onClick={add} className="self-start">
        <Plus size={14} /> {lang === 'he' ? 'הוסף פריט' : 'Add item'}
      </Button>
    </div>
  );
}
