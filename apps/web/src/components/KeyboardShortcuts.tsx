import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, withViewTransition } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { showCommandPalette } from './CommandPalette';

const GO: Record<string, { path: string; he: string; en: string }> = {
  t: { path: '/', he: 'היום', en: 'Today' },
  c: { path: '/chapter', he: 'הפרק הנוכחי', en: 'Current chapter' },
  b: { path: '/book', he: 'הספר שלי', en: 'My book' },
  g: { path: '/goals', he: 'מטרות', en: 'Goals' },
  a: { path: '/actions', he: 'פעולות', en: 'Actions' },
  j: { path: '/journal', he: 'יומן', en: 'Journal' },
  m: { path: '/moodboard', he: 'לוח חזון', en: 'Vision boards' },
  r: { path: '/review', he: 'סקירה שבועית', en: 'Weekly review' },
};

/** Is the user typing somewhere? Then single-key shortcuts must stay out of the way. */
function typing(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

/**
 * Single-key shortcuts: "/" search, "g" then a letter to go somewhere,
 * "?" to see them all. Ignored while typing or with modifier keys.
 */
export function KeyboardShortcuts() {
  const { lang } = useLang();
  const he = lang === 'he';
  const navigate = useNavigate();
  const [help, setHelp] = useState(false);

  useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e) || document.querySelector('dialog[open]')) return;
      const k = e.key.toLowerCase();
      if (pendingG && Date.now() - pendingG < 1200) {
        pendingG = 0;
        const target = GO[k];
        if (target) {
          e.preventDefault();
          withViewTransition(() => navigate(target.path));
        }
        return;
      }
      if (k === 'g') {
        pendingG = Date.now();
      } else if (k === '/') {
        e.preventDefault();
        showCommandPalette();
      } else if (e.key === '?') {
        e.preventDefault();
        setHelp(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const Key = ({ k }: { k: string }) => (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-xs border border-border-strong bg-surface px-1.5 text-xs font-medium text-foreground shadow-[var(--rz-highlight)]">
      {k}
    </kbd>
  );

  const mod = typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl';
  return (
    <Dialog open={help} onClose={() => setHelp(false)} label={he ? 'קיצורי מקלדת' : 'Keyboard shortcuts'}>
      <div className="flex flex-col gap-4 p-6">
        <h2 className="text-xl font-semibold">{he ? 'קיצורי מקלדת' : 'Keyboard shortcuts'}</h2>
        <ul className="flex flex-col gap-2.5 text-sm">
          <li className="flex items-center justify-between gap-4">
            <span>{he ? 'חיפוש, מעבר או הוספה' : 'Search, jump or add'}</span>
            <span className="flex gap-1">
              <Key k={mod} />
              <Key k="K" />
              <span className="px-1 text-fg-subtle">{he ? 'או' : 'or'}</span>
              <Key k="/" />
            </span>
          </li>
          {Object.entries(GO).map(([k, v]) => (
            <li key={k} className="flex items-center justify-between gap-4">
              <span>{he ? v.he : v.en}</span>
              <span className="flex gap-1" dir="ltr">
                <Key k="G" />
                <Key k={k.toUpperCase()} />
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-4">
            <span>{he ? 'הרשימה הזו' : 'This list'}</span>
            <Key k="?" />
          </li>
        </ul>
        <p className="text-xs text-fg-subtle">
          {he ? 'הקיצורים לא פועלים בזמן כתיבה.' : 'Shortcuts are off while you’re typing.'}
        </p>
      </div>
    </Dialog>
  );
}
