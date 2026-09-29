import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Card, Input, DreamwardLogo } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { useLogin } from './useAuth';
import { ApiError } from '@/lib/api';
import { desktop } from '@/lib/desktop';
import { BRAND } from '@dreamward/shared';

export function LoginPage() {
  const { t, toggle, lang } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? '/';
  // Fresh install with no accounts yet → first-run setup.
  const setup = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => api.get<{ needsSetup: boolean }>('/setup/status'),
    staleTime: 60_000,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? lang === 'he'
            ? 'אימייל או סיסמה שגויים'
            : 'Wrong email or password'
          : lang === 'he'
            ? 'שגיאה'
            : 'Error',
      );
    }
  };

  // Desktop app: there is no password — ask the shell to reopen the local session.
  const [desktopFailed, setDesktopFailed] = useState(false);
  useEffect(() => {
    if (!desktop) return;
    let cancelled = false;
    desktop
      .signIn()
      .then((ok) => {
        if (cancelled) return;
        if (ok) window.location.replace(from);
        else setDesktopFailed(true);
      })
      .catch(() => !cancelled && setDesktopFailed(true));
    return () => {
      cancelled = true;
    };
  }, [from]);

  if (desktop) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-fg-muted">
        {desktopFailed
          ? lang === 'he'
            ? 'לא הצלחנו לפתוח את הספר. נסו להפעיל מחדש את האפליקציה.'
            : 'Could not open your book. Please restart the app.'
          : lang === 'he'
            ? 'פותחים את הספר שלך…'
            : 'Opening your book…'}
      </div>
    );
  }

  if (setup.data?.needsSetup) return <Navigate to="/setup" replace />;

  return (
    <div className="fx-dot-grid relative flex min-h-screen items-center justify-center p-6">
      <div className="fx-radial-halo" />
      <Card className="relative w-full max-w-sm p-8" featured>
        <div className="mb-6 text-center">
          <DreamwardLogo height={46} className="mx-auto text-foreground" />
          <p className="mt-2 text-sm text-fg-muted">
            {lang === 'he' ? BRAND.tagline.he : BRAND.tagline.en}
          </p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm text-fg-muted">{lang === 'he' ? 'אימייל' : 'Email'}</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
              dir="ltr"
              aria-invalid={error ? true : undefined}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-fg-muted">{t('password')}</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-invalid={error ? true : undefined}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={login.isPending || !password || !email} className="w-full">
            {login.isPending ? '…' : t('login')}
          </Button>
        </form>
        <button onClick={toggle} className="mt-5 w-full text-center text-xs text-fg-subtle hover:text-fg-muted">
          {lang === 'he' ? 'English' : 'עברית'}
        </button>
      </Card>
    </div>
  );
}
