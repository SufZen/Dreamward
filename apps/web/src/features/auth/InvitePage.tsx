import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, DreamwardLogo } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { api, ApiError } from '@/lib/api';
import type { User } from './useAuth';

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { lang, toggle } = useLang();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const he = lang === 'he';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validity = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.get<{ valid: boolean; note: string | null }>(`/invites/${token}`),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api.post<{ user: User }>(`/invites/${token}/accept`, { email, password }),
    onSuccess: (data) => {
      qc.setQueryData(['me'], data.user);
      navigate('/', { replace: true });
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError(he ? 'הסיסמה חייבת להכיל לפחות 8 תווים' : 'Password must be at least 8 characters');
    if (password !== confirm) return setError(he ? 'הסיסמאות אינן תואמות' : 'Passwords do not match');
    accept.mutate(undefined, {
      onError: (err) => {
        const code = err instanceof ApiError ? err.message : 'error';
        setError(
          code === 'email_taken'
            ? he
              ? 'האימייל כבר בשימוש'
              : 'This email is already taken'
            : code === 'max_users_reached'
              ? he
                ? 'אין מקומות פנויים'
                : 'No seats available'
              : he
                ? 'שגיאה — נסו שוב'
                : 'Something went wrong — try again',
        );
      },
    });
  };

  const invalidReason =
    validity.error instanceof ApiError
      ? validity.error.message === 'already_used'
        ? he
          ? 'ההזמנה כבר נוצלה'
          : 'This invite was already used'
        : validity.error.message === 'expired'
          ? he
            ? 'תוקף ההזמנה פג'
            : 'This invite has expired'
          : he
            ? 'הזמנה לא תקינה'
            : 'Invalid invite link'
      : null;

  return (
    <div className="fx-dot-grid relative flex min-h-screen items-center justify-center p-6">
      <div className="fx-radial-halo" />
      <Card className="relative w-full max-w-sm p-8" featured>
        <div className="mb-6 text-center">
          <DreamwardLogo height={46} className="mx-auto text-foreground" />
          <p className="mt-2 text-sm text-fg-muted">
            {he ? 'הוזמנת להתחיל את המסע אל החזון שלך 🌱' : 'You’re invited to start the journey to your vision 🌱'}
          </p>
        </div>

        {validity.isLoading ? (
          <p className="text-center text-sm text-fg-muted">…</p>
        ) : invalidReason ? (
          <p className="text-center text-sm text-danger">{invalidReason}</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
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
            <Button type="submit" disabled={accept.isPending || !email || !password || !confirm} className="w-full">
              {accept.isPending ? '…' : he ? 'יצירת חשבון' : 'Create account'}
            </Button>
          </form>
        )}

        <button onClick={toggle} className="mt-5 w-full text-center text-xs text-fg-subtle hover:text-fg-muted">
          {he ? 'English' : 'עברית'}
        </button>
      </Card>
    </div>
  );
}
