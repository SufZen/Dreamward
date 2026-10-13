import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Compass,
  Images,
  ListTodo,
  Moon,
  NotebookPen,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Sunrise,
  Target,
} from 'lucide-react';
import { cn, DreamwardLogo } from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';
import { useTheme } from '@/lib/theme';
import { Icon } from '@/components/Icon';
import { showCommandPalette } from '@/components/CommandPalette';
import { useCategories } from '@/features/book/hooks';
import { useCurrentChapter, useLatestRatings } from '@/features/chapter/hooks';
import { useMe } from '@/features/auth/useAuth';
import { isDesktop } from '@/lib/desktop';
import { TransitionNavLink } from './TransitionNavLink';

function itemClasses({ isActive }: { isActive: boolean }) {
  return cn(
    'dw-nav-item flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-fast',
    isActive ? 'bg-surface font-medium text-foreground' : 'text-fg-muted hover:bg-surface-hover hover:text-foreground',
  );
}

const AREAS_KEY = 'dw-nav-areas-open';

/**
 * Seven places, in the order you use them: today → this season → the book →
 * goals and steps → reflection → inspiration. Life areas are a quiet group:
 * the chapter's focus areas are always visible, the rest one click away.
 * Everything else (gallery, snapshots, every page) is in ⌘K.
 */
export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const { t, lang } = useLang();
  const he = lang === 'he';
  const { data: categories } = useCategories();
  const { data: chapter } = useCurrentChapter();
  const { data: ratings } = useLatestRatings();
  const { data: me } = useMe();
  const { mode, toggle: toggleTheme } = useTheme();
  const [areasOpen, setAreasOpen] = useState(() => {
    try {
      return localStorage.getItem(AREAS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleAreas = () =>
    setAreasOpen((o) => {
      try {
        localStorage.setItem(AREAS_KEY, o ? '0' : '1');
      } catch {
        /* per-session only */
      }
      return !o;
    });

  const focus = chapter?.focusCategoryIds ?? [];
  const score = new Map((ratings ?? []).map((r) => [r.categoryId, r.latest?.score ?? null]));
  const ordered = [...(categories ?? [])].sort(
    (a, b) => Number(focus.includes(b.id)) - Number(focus.includes(a.id)) || a.sortOrder - b.sortOrder,
  );
  const visibleAreas = areasOpen ? ordered : ordered.filter((c) => focus.includes(c.id));

  return (
    <>
      {open && (
        <div
          className="rz-animate-fade-in fixed inset-0 z-40 bg-[color:var(--rz-overlay)] backdrop-blur-[2px] sm:hidden"
          onClick={onClose}
        />
      )}
      <nav
        aria-label={he ? 'ניווט ראשי' : 'Main'}
        data-tour="nav"
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex h-full w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border-e border-border bg-bg-elevated p-3',
          'transition-transform duration-spring ease-spring sm:static sm:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full sm:rtl:translate-x-0',
        )}
      >
        <div className="mb-3 px-2 pt-2 text-foreground">
          <DreamwardLogo height={28} />
        </div>

        <button
          type="button"
          onClick={showCommandPalette}
          data-tour="search"
          className="mb-3 flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-subtle shadow-[var(--rz-highlight)] transition-colors duration-fast hover:border-border-strong hover:text-fg-muted"
        >
          <Search size={16} />
          <span className="flex-1 text-start">{he ? 'חיפוש או הוספה' : 'Search or add'}</span>
          <kbd className="rounded-xs border border-border px-1.5 text-2xs">
            {navigator.platform.startsWith('Mac') ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>

        <TransitionNavLink to="/" end className={itemClasses}>
          <Sunrise size={18} /> {he ? 'היום' : 'Today'}
        </TransitionNavLink>
        <TransitionNavLink to="/chapter" className={itemClasses} data-tour="nav-chapter">
          <Compass size={18} /> {t('chapter')}
        </TransitionNavLink>
        <TransitionNavLink to="/book" end className={itemClasses} data-tour="nav-book">
          <BookOpen size={18} /> {t('myBook')}
        </TransitionNavLink>

        <TransitionNavLink to="/goals" className={itemClasses}>
          <Target size={18} /> {t('goals')}
        </TransitionNavLink>
        <TransitionNavLink to="/actions" className={itemClasses}>
          <ListTodo size={18} /> {t('actions')}
        </TransitionNavLink>
        <TransitionNavLink to="/journal" className={itemClasses}>
          <NotebookPen size={18} /> {t('journal')}
        </TransitionNavLink>
        <TransitionNavLink to="/moodboard" className={itemClasses}>
          <Images size={18} /> {t('moodboard')}
        </TransitionNavLink>

        {/* Life areas: focus areas first, the rest behind a toggle */}
        <button
          type="button"
          onClick={toggleAreas}
          aria-expanded={areasOpen}
          className="mt-4 flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-fg-subtle transition-colors hover:text-fg-muted"
        >
          <span className="flex-1 text-start">
            {focus.length && !areasOpen ? (he ? 'תחומי מיקוד' : 'Focus areas') : he ? 'תחומי חיים' : 'Life areas'}
          </span>
          <ChevronDown
            size={14}
            className={cn('transition-transform duration-spring ease-spring', areasOpen && 'rotate-180')}
          />
        </button>
        <div className={cn('flex flex-col gap-0.5', areasOpen && 'rz-stagger')} data-tour="areas">
          {visibleAreas.map((c, i) => {
            const s = score.get(c.id);
            return (
              <TransitionNavLink
                key={c.id}
                to={`/book/category/${c.id}`}
                className={itemClasses}
                style={{ '--i': i } as React.CSSProperties}
              >
                <Icon name={c.icon} size={17} />
                <span className="min-w-0 flex-1 truncate">{pickLabel(lang, c.labelEn, c.labelHe)}</span>
                {focus.includes(c.id) && (
                  <span className="h-1.5 w-1.5 flex-none rounded-full bg-primary" aria-hidden="true" />
                )}
                {s != null && <span className="tabular flex-none text-xs text-fg-subtle">{s}</span>}
              </TransitionNavLink>
            );
          })}
          {!areasOpen && ordered.length > 0 && (
            <button
              type="button"
              onClick={toggleAreas}
              className="rounded-md px-3 py-1.5 text-start text-xs text-fg-subtle transition-colors hover:text-foreground"
            >
              {focus.length
                ? he
                  ? `כל ${ordered.length} התחומים`
                  : `All ${ordered.length} areas`
                : he
                  ? `הצגת ${ordered.length} התחומים`
                  : `Show all ${ordered.length} areas`}
            </button>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
          {me?.role === 'admin' && !isDesktop && (
            <TransitionNavLink to="/admin" className={itemClasses}>
              <ShieldCheck size={18} /> {he ? 'ניהול' : 'Admin'}
            </TransitionNavLink>
          )}
          <div className="flex items-center gap-1">
            <TransitionNavLink to="/settings" className={(s) => cn(itemClasses(s), 'flex-1')}>
              <Settings size={18} /> {t('settings')}
            </TransitionNavLink>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={mode === 'dark' ? (he ? 'מצב בהיר' : 'Light mode') : he ? 'מצב כהה' : 'Dark mode'}
              title={mode === 'dark' ? (he ? 'מצב בהיר' : 'Light mode') : he ? 'מצב כהה' : 'Dark mode'}
              className="rz-press inline-flex h-9 w-9 flex-none items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              {mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
