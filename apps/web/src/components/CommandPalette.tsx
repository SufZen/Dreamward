import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CalendarCheck,
  Compass,
  CornerDownLeft,
  Eye,
  History,
  Images,
  ImagePlus,
  Languages,
  LayoutDashboard,
  ListTodo,
  Moon,
  NotebookPen,
  Plus,
  Search,
  Settings,
  Sparkle,
  Target,
} from 'lucide-react';
import { Dialog, cn, toast, withViewTransition } from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';
import { useTheme } from '@/lib/theme';
import { Icon } from '@/components/Icon';
import { useCategories } from '@/features/book/hooks';
import { useCreateAction } from '@/features/actions/hooks';
import { useCreateGoal, useGoals } from '@/features/goals/hooks';
import { startTour } from '@/features/tour/Tour';
import { useJournal } from '@/features/journal/hooks';

interface Command {
  id: string;
  group: 'create' | 'found' | 'go' | 'areas' | 'prefs';
  label: string;
  /** extra words that should match (e.g. the other language) */
  keywords?: string;
  icon: ReactNode;
  run: (query: string) => void;
  /** create commands use the typed text as the new item's title */
  takesText?: boolean;
}

let openPalette: (() => void) | null = null;
/** Open the palette from anywhere (e.g. a header button). */
export function showCommandPalette() {
  openPalette?.();
}

/**
 * ⌘K / Ctrl+K: jump anywhere in the book, or capture a step, goal or journal
 * entry without leaving the page. Typing filters; with text typed, the
 * "Add …" commands create an item with that title.
 */
export function CommandPalette() {
  const { lang, toggle: toggleLang } = useLang();
  const he = lang === 'he';
  const navigate = useNavigate();
  const { mode, toggle: toggleTheme } = useTheme();
  const { data: categories } = useCategories();
  const { data: goals } = useGoals();
  const { data: journal } = useJournal();
  const createAction = useCreateAction();
  const createGoal = useCreateGoal();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    openPalette = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      openPalette = null;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQ('');
      setActive(0);
    } else {
      window.dispatchEvent(new Event('dw:palette-open')); // the product tour listens
    }
  }, [open]);

  const go = (path: string) => withViewTransition(() => navigate(path));

  const commands = useMemo<Command[]>(() => {
    const L = (h: string, e: string) => (he ? h : e);
    const list: Command[] = [
      {
        id: 'new-action',
        group: 'create',
        label: L('צעד חדש', 'Add a step'),
        keywords: 'action task todo פעולה משימה',
        icon: <ListTodo size={16} />,
        takesText: true,
        run: (text) => {
          if (!text) return go('/actions');
          createAction.mutate(
            { title: text },
            {
              onSuccess: () =>
                toast(L(`הצעד נוסף: ${text}`, `Step added: ${text}`), {
                  tone: 'success',
                  action: {
                    label: L('הצג', 'View'),
                    onClick: () => go('/actions'),
                  },
                }),
            },
          );
        },
      },
      {
        id: 'new-goal',
        group: 'create',
        label: L('מטרה חדשה', 'Add a goal'),
        keywords: 'goal מטרה',
        icon: <Target size={16} />,
        takesText: true,
        run: (text) => {
          if (!text) return go('/goals');
          createGoal.mutate(
            { title: text },
            {
              onSuccess: () =>
                toast(L(`המטרה נוספה: ${text}`, `Goal added: ${text}`), {
                  tone: 'success',
                  action: {
                    label: L('הצג', 'View'),
                    onClick: () => go('/goals'),
                  },
                }),
            },
          );
        },
      },
      {
        id: 'new-journal',
        group: 'create',
        label: L('כתיבה ביומן', 'Write in the journal'),
        keywords: 'journal entry write יומן רשומה',
        icon: <NotebookPen size={16} />,
        run: () => go('/journal?new=1'),
      },
      {
        id: 'tour',
        group: 'prefs',
        label: L('סיור במערכת', 'Take the tour'),
        keywords: 'tour tutorial help guide סיור הדרכה עזרה',
        icon: <Compass size={16} />,
        run: () => {
          navigate('/');
          setTimeout(startTour, 300);
        },
      },
      {
        id: 'review',
        group: 'create',
        label: L('סקירה שבועית', 'Weekly review'),
        keywords: 'review week reflect סקירה שבוע',
        icon: <CalendarCheck size={16} />,
        run: () => go('/review'),
      },
      {
        id: 'go-home',
        group: 'go',
        label: L('היום', 'Today'),
        keywords: 'home dashboard בית לוח',
        icon: <LayoutDashboard size={16} />,
        run: () => go('/'),
      },
      {
        id: 'go-chapter',
        group: 'go',
        label: L('הפרק הנוכחי', 'Current chapter'),
        keywords: 'chapter season פרק',
        icon: <Compass size={16} />,
        run: () => go('/chapter'),
      },
      {
        id: 'go-goals',
        group: 'go',
        label: L('מטרות', 'Goals'),
        keywords: 'goals מטרות',
        icon: <Target size={16} />,
        run: () => go('/goals'),
      },
      {
        id: 'go-actions',
        group: 'go',
        label: L('צעדים', 'Steps'),
        keywords: 'actions tasks פעולות',
        icon: <ListTodo size={16} />,
        run: () => go('/actions'),
      },
      {
        id: 'go-journal',
        group: 'go',
        label: L('יומן', 'Journal'),
        keywords: 'journal יומן',
        icon: <NotebookPen size={16} />,
        run: () => go('/journal'),
      },
      {
        id: 'go-areas',
        group: 'go',
        label: L('הספר שלי', 'My book'),
        keywords: 'book areas categories life areas ספר תחומי חיים קטגוריות',
        icon: <BookOpen size={16} />,
        run: () => go('/book'),
      },
      {
        id: 'go-vision',
        group: 'go',
        label: L('חיי החלומות', 'Dream life'),
        keywords: 'vision חזון',
        icon: <Eye size={16} />,
        run: () => go('/book/life-vision'),
      },
      {
        id: 'go-ikigai',
        group: 'go',
        label: L('איקיגאי', 'IKIGAI'),
        keywords: 'ikigai',
        icon: <Sparkle size={16} />,
        run: () => go('/ikigai'),
      },
      {
        id: 'go-cover',
        group: 'go',
        label: L('שער', 'Cover'),
        keywords: 'cover שער',
        icon: <BookOpen size={16} />,
        run: () => go('/book/cover'),
      },
      {
        id: 'go-moodboard',
        group: 'go',
        label: L('לוח חזון', 'Moodboards'),
        keywords: 'moodboard לוח',
        icon: <Images size={16} />,
        run: () => go('/moodboard'),
      },
      {
        id: 'go-gallery',
        group: 'go',
        label: L('גלריה', 'Gallery'),
        keywords: 'gallery images גלריה',
        icon: <ImagePlus size={16} />,
        run: () => go('/gallery'),
      },
      {
        id: 'go-snapshots',
        group: 'go',
        label: L('תמונות מצב', 'Snapshots'),
        keywords: 'snapshots history גרסאות',
        icon: <History size={16} />,
        run: () => go('/snapshots'),
      },
      {
        id: 'go-settings',
        group: 'go',
        label: L('הגדרות', 'Settings'),
        keywords: 'settings הגדרות',
        icon: <Settings size={16} />,
        run: () => go('/settings'),
      },
      ...(categories ?? []).map<Command>((c) => ({
        id: `area-${c.id}`,
        group: 'areas',
        label: pickLabel(lang, c.labelEn, c.labelHe),
        keywords: `${c.labelEn} ${c.labelHe}`,
        icon: <Icon name={c.icon} size={16} />,
        run: () => go(`/book/category/${c.id}`),
      })),
      {
        id: 'theme',
        group: 'prefs',
        label: mode === 'dark' ? L('מצב בהיר', 'Light mode') : L('מצב כהה', 'Dark mode'),
        keywords: 'theme dark light ערכת',
        icon: <Moon size={16} />,
        run: () => toggleTheme(),
      },
      {
        id: 'lang',
        group: 'prefs',
        label: he ? 'English' : 'עברית',
        keywords: 'language שפה',
        icon: <Languages size={16} />,
        run: () => toggleLang(),
      },
    ];
    // Your own content: goals and journal entries, found by title (only when typing).
    for (const g of goals ?? []) {
      list.push({
        id: `goal-${g.id}`,
        group: 'found',
        label: g.title,
        icon: <Target size={16} />,
        run: () => go(`/goals#goal-${g.id}`),
      });
    }
    for (const j of journal ?? []) {
      const text = (j.title || j.bodyRichtext.replace(/<[^>]*>/g, ' ')).replace(/s+/g, ' ').trim().slice(0, 80);
      if (!text) continue;
      list.push({
        id: `journal-${j.id}`,
        group: 'found',
        label: text,
        keywords: new Date(j.entryDate).toLocaleDateString(he ? 'he-IL' : 'en-GB'),
        icon: <NotebookPen size={16} />,
        run: () => go(`/journal/${j.id}`),
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [he, lang, categories, mode, goals, journal]);

  const text = q.trim();
  const matches = useMemo(() => {
    if (!text) return commands.filter((c) => c.group !== 'found');
    const needle = text.toLowerCase();
    const hit = commands.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(needle));
    // With free text, offer to create it even if no command name matched.
    const creators = commands.filter((c) => c.takesText && !hit.includes(c));
    // keyboard order must match the order groups are drawn in
    const order = ['found', 'create', 'go', 'areas', 'prefs'];
    return [...hit, ...creators].sort((x, y) => order.indexOf(x.group) - order.indexOf(y.group));
  }, [commands, text]);

  useEffect(() => setActive(0), [text]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (c: Command) => {
    setOpen(false);
    c.run(c.takesText ? text : '');
  };

  const GROUPS: Record<Command['group'], string> = {
    create: he ? 'יצירה' : 'Create',
    go: he ? 'מעבר אל' : 'Go to',
    found: he ? 'מהספר שלך' : 'From your book',
    areas: he ? 'תחומי חיים' : 'Life areas',
    prefs: he ? 'העדפות' : 'Preferences',
  };

  let index = -1;
  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      label={he ? 'פקודות וחיפוש' : 'Commands and search'}
      placement="top"
    >
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search size={18} className="flex-none text-fg-subtle" />
        <input
          autoFocus
          dir="auto"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, matches.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const c = matches[active];
              if (c) run(c);
            }
          }}
          placeholder={he ? 'לאן, או מה להוסיף?' : 'Go somewhere, or add something…'}
          className="h-14 flex-1 bg-transparent text-md text-foreground placeholder:text-fg-faint focus:outline-none"
          role="combobox"
          aria-expanded="true"
          aria-controls="dw-palette-list"
        />
        <kbd className="rounded-xs border border-border px-1.5 py-0.5 text-2xs text-fg-subtle">Esc</kbd>
      </div>
      <div ref={listRef} id="dw-palette-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
        {matches.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-fg-muted">{he ? 'לא נמצא' : 'Nothing found'}</p>
        )}
        {(['found', 'create', 'go', 'areas', 'prefs'] as const).map((g) => {
          const items = matches.filter((m) => m.group === g);
          if (!items.length) return null;
          return (
            <div key={g} className="mb-1">
              <div className="px-3 pb-1 pt-2 text-xs font-medium text-fg-subtle">{GROUPS[g]}</div>
              {items.map((c) => {
                index = matches.indexOf(c);
                const isActive = index === active;
                const i = index;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-active={isActive}
                    onMouseMove={() => setActive(i)}
                    onClick={() => run(c)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-start text-sm transition-colors duration-fast',
                      isActive ? 'bg-surface-hover text-foreground' : 'text-fg-muted',
                    )}
                  >
                    <span className={cn('flex-none', isActive ? 'text-primary' : 'text-fg-subtle')}>
                      {c.takesText && text ? <Plus size={16} /> : c.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {c.label}
                      {c.takesText && text && (
                        <span className="text-foreground">
                          {he ? ': ' : ': '}
                          <span dir="auto" className="font-medium">
                            “{text}”
                          </span>
                        </span>
                      )}
                    </span>
                    {isActive && <CornerDownLeft size={14} className="flex-none text-fg-subtle" />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
