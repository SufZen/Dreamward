import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Upload, ShieldCheck } from 'lucide-react';
import { Button, Card } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';

/** "Your data": download the whole book, or replace it from an export. */
export function DataSettings() {
  const { lang } = useLang();
  const he = lang === 'he';
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const runImport = async () => {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/me/import?confirm=replace', { method: 'POST', body: form, credentials: 'same-origin' });
      const body = (await res.json().catch(() => ({}))) as { message?: string; importedFrom?: string };
      if (!res.ok) throw new Error(body.message ?? (he ? 'הייבוא נכשל' : 'Import failed'));
      await qc.invalidateQueries();
      setMsg({
        ok: true,
        text: he
          ? `הספר יובא בהצלחה (מגרסה ${body.importedFrom}). הספר הקודם נשמר בגיבוי.`
          : `Book imported (from v${body.importedFrom}). Your previous book was kept as a backup.`,
      });
      setFile(null);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck size={18} className="text-primary" /> {he ? 'הנתונים שלך' : 'Your data'}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          {he
            ? 'הספר שלך שייך לך. הורד עותק מלא (כולל תמונות) — אפשר לייבא אותו לכל התקנה אחרת, בשרת או באפליקציית המחשב. מפתחות AI לא נכללים.'
            : 'Your book belongs to you. Download a complete copy (including images) — you can import it into any other installation, server or desktop app. AI keys are not included.'}
        </p>
      </div>

      <div>
        <a href="/api/me/export" download>
          <Button variant="secondary">
            <Download size={15} /> {he ? 'הורדת הנתונים שלי' : 'Download my data'}
          </Button>
        </a>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <span className="text-sm font-medium">{he ? 'ייבוא ספר מקובץ ייצוא' : 'Import a book from an export'}</span>
        <p className="text-xs text-fg-muted">
          {he
            ? 'הייבוא מחליף את הספר הנוכחי. הספר הנוכחי לא נמחק — הוא נשמר בתיקיית הגיבויים של השרת.'
            : 'Importing replaces your current book. Your current book is not deleted — it is kept in the server’s backup folder.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="ghost" onClick={() => inputRef.current?.click()}>
            <Upload size={15} /> {file ? file.name : he ? 'בחירת קובץ…' : 'Choose file…'}
          </Button>
          {file && (
            <Button variant="danger" loading={busy} onClick={runImport}>
              {he ? 'להחליף את הספר שלי' : 'Replace my book'}
            </Button>
          )}
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
      </div>
    </Card>
  );
}
