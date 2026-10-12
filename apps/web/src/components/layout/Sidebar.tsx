import { TransitionNavLink } from './TransitionNavLink';
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
    'dw-nav-item flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-fast',
    isActive ? 'bg-surface font-medium text-foreground' : 'text-fg-muted hover:bg-surface-hover hover:text-foreground',
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
      {open && <div className="rz-animate-fade-in fixed inset-0 z-40 bg-[color:var(--rz-overlay)] backdrop-blur-[2px] sm:hidden" onClick={onClose} />}
      <nav
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex h-full w-64 shrink-0 flex-col gap-1 overflow-y-auto border-e border-border bg-bg-elevated p-3',
          'transition-transform duration-spring ease-spring sm:static sm:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full sm:rtl:translate-x-0',
        )}
      >
      <div className="mb-4 px-2 pt-2 text-foreground">
        <DreamwardLogo height={30} />
      </div>

      <TransitionNavLink to="/" end className={itemClasses}>
        <LayoutDashboard size={18} /> {t('dashboard')}
      </TransitionNavLink>

      <div className="mt-3 px-3 pb-1 text-xs font-medium text-fg-subtle">{t('myBook')}</div>
      <TransitionNavLink to="/chapter" className={itemClasses}>
        <Compass size={18} /> {t('chapter')}
      </TransitionNavLink>
      <TransitionNavLink to="/ikigai" className={itemClasses}>
        <Sparkle size={18} /> {t('ikigai')}
      </TransitionNavLink>
      <TransitionNavLink to="/book/cover" className={itemClasses}>
        <BookOpen size={18} /> {t('cover')}
      </TransitionNavLink>
      <TransitionNavLink to="/book/life-vision" className={itemClasses}>
        <Eye size={18} /> {t('lifeVision')}
      </TransitionNavLink>

      <div className="mt-3 px-3 pb-1 text-xs font-medium text-fg-subtle">{t('categories')}</div>
      {categories?.map((c) => (
        <TransitionNavLink key={c.id} to={`/book/category/${c.id}`} className={itemClasses}>
          <Icon name={c.icon} size={18} />
          <span className="truncate">{pickLabel(lang, c.labelEn, c.labelHe)}</span>
        </TransitionNavLink>
      ))}

      <hr className="mx-3 my-3 border-border" />
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
      <TransitionNavLink to="/gallery" className={itemClasses}>
        <ImagePlus size={18} /> {t('gallery')}
      </TransitionNavLink>
      <TransitionNavLink to="/snapshots" className={itemClasses}>
        <History size={18} /> {t('snapshots')}
      </TransitionNavLink>
      <TransitionNavLink to="/settings" className={itemClasses}>
        <Settings size={18} /> {t('settings')}
      </TransitionNavLink>
      {me?.role === 'admin' && !isDesktop && (
        <TransitionNavLink to="/admin" className={itemClasses}>
          <ShieldCheck size={18} /> {lang === 'he' ? 'ניהול' : 'Admin'}
        </TransitionNavLink>
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
