import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, History, KeyRound, Languages, Waves } from 'lucide-react';
import { Button, Card, Input, PageHeader, buttonVariants } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { api, ApiError } from '@/lib/api';
import { AiSettings } from './AiSettings';
import { ApiKeysSettings } from './ApiKeysSettings';
import { RoutinesSettings } from './RoutinesSettings';
import { DataSettings } from './DataSettings';
import { isDesktop } from '@/lib/desktop';
import { useMotionPreference } from '@/lib/motion';
import { startTour } from '@/features/tour/Tour';
import { useSetOnboardingStatus } from '@/features/onboarding/hooks';

export function SettingsPage() {
  const { t, lang, setLang } = useLang();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const setOnboarding = useSetOnboardingStatus();
  const [motion, setMotion] = useMotionPreference();

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
      <PageHeader
        title={t('settings')}
        description={
          lang === 'he'
            ? 'Clarity, הרגלים אוטומטיים, גישה לסוכנים, הנתונים שלך והמראה.'
            : 'Clarity, routines, agent access, your data, and how Dreamward looks.'
        }
      />

      <AiSettings />

      <RoutinesSettings />

      <ApiKeysSettings />

      <DataSettings />

      <Card className="flex flex-wrap items-center gap-4 p-6">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <History size={18} className="text-primary" /> {t('snapshots')}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {lang === 'he'
              ? 'עותק של כל הספר ברגע נתון — להשוואה, או כדי לחזור אחורה.'
              : 'A copy of your whole book at a moment in time — to compare, or to go back.'}
          </p>
        </div>
        <Link to="/snapshots" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          {lang === 'he' ? 'לתמונות המצב' : 'Open snapshots'}
        </Link>
      </Card>

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
        <Button
          variant="ghost"
          size="sm"
          className="ms-2"
          onClick={() => {
            navigate('/');
            setTimeout(startTour, 300);
          }}
        >
          {lang === 'he' ? 'סיור במערכת' : 'Take the tour'}
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

      <Card className="p-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <Waves size={18} className="text-primary" /> {lang === 'he' ? 'תנועה' : 'Motion'}
        </h2>
        <p className="mb-4 text-sm text-fg-muted">
          {lang === 'he'
            ? 'אנימציות קטנות מראות מה השתנה. "מופחתת" מחליפה אותן במעבר עמעום קצר.'
            : 'Small animations show what changed. Reduced swaps them for a short fade.'}
        </p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={lang === 'he' ? 'תנועה' : 'Motion'}>
          {(
            [
              ['system', 'כמו במכשיר', 'Match my device'],
              ['reduced', 'מופחתת', 'Reduced'],
              ['full', 'מלאה', 'Full'],
            ] as const
          ).map(([value, he, en]) => (
            <Button
              key={value}
              role="radio"
              aria-checked={motion === value}
              variant={motion === value ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMotion(value)}
            >
              {lang === 'he' ? he : en}
            </Button>
          ))}
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
