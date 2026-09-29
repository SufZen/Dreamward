import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Target,
  ListTodo,
  NotebookPen,
  Images,
  ImagePlus,
  History,
  Settings,
  Eye,
  Compass,
  Sparkle,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react';
import { cn, DreamwardLogo } from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';
import { useTheme } from '@/lib/theme';
import { Icon } from '@/components/Icon';
import { useCategories } from '@/features/book/hooks';
import { useMe } from '@/features/auth/useAuth';
import { isDesktop } from '@/lib/desktop';

function itemClasses({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
    isActive ? 'bg-surface text-foreground' : 'text-fg-muted hover:bg-surface hover:text-foreground',
  );
}

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const { t, lang } = useLang();
  const { data: categories } = useCategories();
  const { data: me } = useMe();
  const { mode, toggle: toggleTheme } = useTheme();

  return (
    <>
      {/* mobile backdrop */}
      {open && <div className="fixed inset-0 z-40 bg-[color:var(--rz-overlay)] sm:hidden" onClick={onClose} />}
      <nav
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex h-full w-64 shrink-0 flex-col gap-1 overflow-y-auto border-e border-border bg-bg-elevated p-3',
          'transition-transform duration-200 sm:static sm:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full sm:rtl:translate-x-0',
        )}
      >
      <div className="mb-4 px-2 pt-2 text-foreground">
        <DreamwardLogo height={30} />
      </div>

      <NavLink to="/" end className={itemClasses}>
        <LayoutDashboard size={18} /> {t('dashboard')}
      </NavLink>

      <div className="mt-3 px-3 pb-1 text-2xs font-mono uppercase tracking-wider text-fg-faint">{t('myBook')}</div>
      <NavLink to="/chapter" className={itemClasses}>
        <Compass size={18} /> {t('chapter')}
      </NavLink>
      <NavLink to="/ikigai" className={itemClasses}>
        <Sparkle size={18} /> {t('ikigai')}
      </NavLink>
      <NavLink to="/book/cover" className={itemClasses}>
        <BookOpen size={18} /> {t('cover')}
      </NavLink>
      <NavLink to="/book/life-vision" className={itemClasses}>
        <Eye size={18} /> {t('lifeVision')}
      </NavLink>

      <div className="mt-3 px-3 pb-1 text-2xs font-mono uppercase tracking-wider text-fg-faint">{t('categories')}</div>
      {categories?.map((c) => (
        <NavLink key={c.id} to={`/book/category/${c.id}`} className={itemClasses}>
          <Icon name={c.icon} size={18} />
          <span className="truncate">{pickLabel(lang, c.labelEn, c.labelHe)}</span>
        </NavLink>
      ))}

      <div className="mt-3 px-3 pb-1 text-2xs font-mono uppercase tracking-wider text-fg-faint">&nbsp;</div>
      <NavLink to="/goals" className={itemClasses}>
        <Target size={18} /> {t('goals')}
      </NavLink>
      <NavLink to="/actions" className={itemClasses}>
        <ListTodo size={18} /> {t('actions')}
      </NavLink>
      <NavLink to="/journal" className={itemClasses}>
        <NotebookPen size={18} /> {t('journal')}
      </NavLink>
      <NavLink to="/moodboard" className={itemClasses}>
        <Images size={18} /> {t('moodboard')}
      </NavLink>
      <NavLink to="/gallery" className={itemClasses}>
        <ImagePlus size={18} /> {t('gallery')}
      </NavLink>
      <NavLink to="/snapshots" className={itemClasses}>
        <History size={18} /> {t('snapshots')}
      </NavLink>
      <NavLink to="/settings" className={itemClasses}>
        <Settings size={18} /> {t('settings')}
      </NavLink>
      {me?.role === 'admin' && !isDesktop && (
        <NavLink to="/admin" className={itemClasses}>
          <ShieldCheck size={18} /> {lang === 'he' ? 'ניהול' : 'Admin'}
        </NavLink>
      )}

      <button
        onClick={toggleTheme}
        className="mt-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface hover:text-foreground"
      >
        {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        {mode === 'dark' ? (lang === 'he' ? 'מצב בהיר' : 'Light mode') : lang === 'he' ? 'מצב כהה' : 'Dark mode'}
      </button>
      </nav>
    </>
  );
}
