import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input, cn } from '@dreamward/design-system';

export interface Chip {
  id: string;
  text: string;
}

interface Props {
  chips: Chip[];
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
  placeholder: string;
  addLabel: string;
  /** optional per-chip accent colour (e.g. IKIGAI circle) */
  color?: string;
  className?: string;
}

/** Quick-capture list: type + Enter adds a chip; chips are removable. */
export function ChipInput({ chips, onAdd, onRemove, placeholder, addLabel, color, className }: Props) {
  const [text, setText] = useState('');
  const commit = () => {
    const v = text.trim();
    if (!v) return;
    onAdd(v);
    setText('');
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex gap-2">
        <Input
          dir="auto"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              commit();
            }
          }}
        />
        <Button variant="secondary" onClick={commit} disabled={!text.trim()} aria-label={addLabel}>
          <Plus size={15} />
          <span className="hidden sm:inline">{addLabel}</span>
        </Button>
      </div>
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <li
              key={c.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface py-1 pe-1.5 ps-3 text-sm"
              style={color ? { borderColor: `${color}66`, background: `${color}14` } : undefined}
            >
              <span dir="auto" className="truncate">
                {c.text}
              </span>
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                className="rounded-full p-0.5 text-fg-faint hover:bg-surface-hover hover:text-foreground"
                aria-label={`remove ${c.text}`}
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
