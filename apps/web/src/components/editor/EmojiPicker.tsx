import { useEffect, useRef } from 'react';

const GROUPS: { name: string; chars: string[] }[] = [
  { name: 'Smileys', chars: ['😀', '😄', '😁', '😊', '🙂', '😉', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😌', '😏', '🤗', '🤔', '😴', '😅', '😂', '🤣'] },
  { name: 'Gestures', chars: ['👍', '👎', '👏', '🙌', '🙏', '💪', '✌️', '🤞', '👋', '🤝', '👌', '🫶', '🤙', '☝️', '✋'] },
  { name: 'Hearts', chars: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💖', '💗', '💓', '💞', '💕', '💟', '❣️'] },
  { name: 'Nature', chars: ['🌱', '🌿', '🍀', '🌳', '🌸', '🌻', '🌟', '⭐', '✨', '⚡', '🔥', '🌈', '☀️', '🌙', '💫'] },
  { name: 'Symbols', chars: ['✅', '✔️', '🎯', '🏆', '🥇', '🎉', '🎊', '🚀', '💡', '📈', '📌', '🔑', '🧭', '⏳', '🗓️'] },
  { name: 'Objects', chars: ['📖', '📝', '✍️', '📚', '💼', '🎨', '🎵', '🏃', '🧘', '🍎', '☕', '🛏️', '🏡', '💰', '🎁'] },
];

interface Props {
  onPick: (emoji: string) => void;
  onClose: () => void;
}

/** Dependency-free emoji popover. Click an emoji to insert; click outside to close. */
export function EmojiPicker({ onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  return (
    <div
      ref={ref}
      dir="ltr"
      className="absolute z-50 mt-1 max-h-64 w-64 overflow-y-auto rounded-md border border-border bg-bg-raised p-2 shadow-rz-3"
    >
      {GROUPS.map((g) => (
        <div key={g.name} className="mb-1.5">
          <div className="px-1 pb-1 text-2xs font-mono uppercase tracking-wider text-fg-faint">{g.name}</div>
          <div className="grid grid-cols-8 gap-0.5">
            {g.chars.map((ch, i) => (
              <button
                key={g.name + i}
                type="button"
                onClick={() => onPick(ch)}
                className="rounded p-1 text-lg leading-none hover:bg-surface"
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
