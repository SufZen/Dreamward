import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, KeyRound, Languages } from 'lucide-react';
import { Button, Card, Input } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { api, ApiError } from '@/lib/api';
import { AiSettings } from './AiSettings';
import { ApiKeysSettings } from './ApiKeysSettings';
import { RoutinesSettings } from './RoutinesSettings';
import { DataSettings } from './DataSettings';
import { isDesktop } from '@/lib/desktop';
import { useSetOnboardingStatus } from '@/features/onboarding/hooks';

export function SettingsPage() {
  const { t, lang, setLang } = useLang();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const setOnboarding = useSetOnboardingStatus();

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/auth/password', { currentPassword: current, newPassword: next });
      setMsg({ ok: true, text: lang === 'he' ? 'הסיסמה עודכנה' : 'Password updated' });
      setCurrent('');
      setNext('');
    } catch (err) {
      const wrong = err instanceof ApiError && err.status === 403;
      setMsg({
        ok: false,
        text: wrong
          ? lang === 'he'
            ? 'הסיסמה הנוכחית שגויה'
            : 'Current password is wrong'
          : lang === 'he'
            ? 'שגיאה — ודא שהסיסמה החדשה באורך 8 תווים לפחות'
            : 'Error — new password must be at least 8 characters',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold">{t('settings')}</h1>

      <AiSettings />

      <RoutinesSettings />

      <ApiKeysSettings />

      <DataSettings />

      <Card className="p-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <Compass size={18} className="text-primary" /> {lang === 'he' ? 'התחלה מודרכת' : 'Guided start'}
        </h2>
        <p className="mb-4 text-sm text-fg-muted">
          {lang === 'he'
            ? 'פרק, גלגל חיים, מיקוד וצעד ראשון — בכ-10 דקות. מה שכבר כתבת נשמר.'
            : 'A chapter, a life wheel, a focus and a first move — in about 10 minutes. What you already wrote is kept.'}
        </p>
        <Button
          variant="secondary"
          size="sm"
          loading={setOnboarding.isPending}
          onClick={() => setOnboarding.mutate('pending', { onSuccess: () => navigate('/start') })}
        >
          {lang === 'he' ? 'פתח את ההתחלה המודרכת' : 'Open guided start'}
        </Button>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Languages size={18} className="text-primary" /> {lang === 'he' ? 'שפת ממשק' : 'UI language'}
        </h2>
        <div className="flex gap-2">
          <Button variant={lang === 'he' ? 'primary' : 'secondary'} size="sm" onClick={() => setLang('he')}>
            עברית
          </Button>
          <Button variant={lang === 'en' ? 'primary' : 'secondary'} size="sm" onClick={() => setLang('en')}>
            English
          </Button>
        </div>
      </Card>

      {!isDesktop && (
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <KeyRound size={18} className="text-primary" /> {lang === 'he' ? 'שינוי סיסמה' : 'Change password'}
          </h2>
          <form onSubmit={changePassword} className="flex max-w-sm flex-col gap-3">
            <Input
              type="password"
              placeholder={lang === 'he' ? 'סיסמה נוכחית' : 'Current password'}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
            <Input
              type="password"
              placeholder={lang === 'he' ? 'סיסמה חדשה (8+ תווים)' : 'New password (8+ chars)'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            {msg && <p className={msg.ok ? 'text-sm text-success' : 'text-sm text-danger'}>{msg.text}</p>}
            <Button type="submit" disabled={busy || !current || next.length < 8} className="self-start">
              {lang === 'he' ? 'עדכן סיסמה' : 'Update password'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
