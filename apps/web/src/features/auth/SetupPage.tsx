import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, DreamwardLogo } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { api, ApiError } from '@/lib/api';
import type { User } from './useAuth';

/** First run: create the admin account with the one-time token from the server logs. */
export function SetupPage() {
  const [params] = useSearchParams();
  const { lang, toggle } = useLang();
  const he = lang === 'he';
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [token, setToken] = useState(params.get('token') ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => api.get<{ needsSetup: boolean }>('/setup/status'),
  });

  const create = useMutation({
    mutationFn: () => api.post<{ user: User }>('/setup', { token: token.trim(), email, password }),
    onSuccess: (data) => {
      qc.setQueryData(['me'], data.user);
      qc.setQueryData(['setup-status'], { needsSetup: false });
      navigate('/', { replace: true });
    },
  });

  if (status.data && !status.data.needsSetup) return <Navigate to="/login" replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError(he ? 'הסיסמה חייבת להכיל לפחות 8 תווים' : 'Password must be at least 8 characters');
    if (password !== confirm) return setError(he ? 'הסיסמאות אינן תואמות' : 'Passwords do not match');
    create.mutate(undefined, {
      onError: (err) => {
        const code = err instanceof ApiError ? err.message : 'error';
        setError(
          code === 'invalid_token'
            ? he
              ? 'קוד ההתקנה שגוי — העתיקו את הקישור מיומן השרת'
              : 'Wrong setup code — copy the link from the server log'
            : code === 'already_set_up'
              ? he
                ? 'ההתקנה כבר הושלמה'
                : 'Setup is already complete'
              : he
                ? 'שגיאה — נסו שוב'
                : 'Something went wrong — try again',
        );
      },
    });
  };

  return (
    <div className="fx-dot-grid relative flex min-h-screen items-center justify-center p-6">
      <div className="fx-radial-halo" />
      <Card className="relative w-full max-w-sm p-8" featured>
        <div className="mb-6 text-center">
          <DreamwardLogo height={46} className="mx-auto text-foreground" />
          <p className="mt-2 text-sm text-fg-muted">
            {he ? 'ברוכים הבאים! צרו את חשבון המנהל הראשון.' : 'Welcome! Create the first (admin) account.'}
          </p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {!params.get('token') && (
            <div>
              <label className="mb-1.5 block text-sm text-fg-muted">{he ? 'קוד התקנה' : 'Setup code'}</label>
              <Input value={token} onChange={(e) => setToken(e.target.value)} dir="ltr" autoComplete="off" />
              <p className="mt-1 text-xs text-fg-faint">
                {he ? 'מופיע ביומן השרת ובקובץ setup-token בתיקיית הנתונים.' : 'Shown in the server log and in the setup-token file in the data folder.'}
              </p>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm text-fg-muted">{he ? 'אימייל' : 'Email'}</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus dir="ltr" autoComplete="email" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-fg-muted">{he ? 'סיסמה' : 'Password'}</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-fg-muted">{he ? 'אימות סיסמה' : 'Confirm password'}</label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={create.isPending || !token || !email || !password || !confirm} className="w-full">
            {create.isPending ? '…' : he ? 'יצירת חשבון מנהל' : 'Create admin account'}
          </Button>
        </form>
        <button onClick={toggle} className="mt-5 w-full text-center text-xs text-fg-subtle hover:text-fg-muted">
          {he ? 'English' : 'עברית'}
        </button>
      </Card>
    </div>
  );
}
