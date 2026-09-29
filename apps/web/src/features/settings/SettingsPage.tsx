import { useState } from 'react';
import { KeyRound, Languages } from 'lucide-react';
import { Button, Card, Input } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { api, ApiError } from '@/lib/api';
import { AiSettings } from './AiSettings';
import { ApiKeysSettings } from './ApiKeysSettings';
import { RoutinesSettings } from './RoutinesSettings';
import { DataSettings } from './DataSettings';
import { isDesktop } from '@/lib/desktop';

export function SettingsPage() {
  const { t, lang, setLang } = useLang();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

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
