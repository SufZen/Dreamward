import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { LangToggle } from './LangToggle';
import { useLang } from '@/lib/lang';
import { useLogout, useMe } from '@/features/auth/useAuth';
import { AssistantLauncher } from '@/features/assistant/AssistantLauncher';
import { isDesktop } from '@/lib/desktop';

export function AppShell() {
  const { t, lang } = useLang();
  const logout = useLogout();
  const { data: user } = useMe();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setNavOpen(false), [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="fx-glass sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border px-4">
          <button
            onClick={() => setNavOpen(true)}
            className="-ms-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-fg-muted hover:bg-surface hover:text-foreground sm:hidden"
            aria-label={lang === 'he' ? 'תפריט' : 'Menu'}
          >
            <Menu size={20} />
          </button>
          <span className="me-auto truncate text-xs text-fg-subtle">{isDesktop ? '' : user?.email}</span>
          <LangToggle />
          {!isDesktop && (
            <button
              onClick={() => logout.mutate()}
              className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-fg-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              <LogOut size={16} /> <span className="hidden sm:inline">{t('logout')}</span>
            </button>
          )}
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
            <Suspense fallback={<p className="p-6 text-fg-muted">…</p>}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <AssistantLauncher />
    </div>
  );
}
