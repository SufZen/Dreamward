import { useState } from 'react';
import { Camera, GitCompareArrows } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Badge } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { api } from '@/lib/api';

interface SnapshotSummary {
  id: string;
  label: string;
  createdAt: number;
}

interface SectionRow {
  id: string;
  categoryId: string;
  sectionType: string;
  content: unknown;
  bodyRichtext: string | null;
}

interface Payload {
  sections: SectionRow[];
  lifeVision: { id: string; answerRichtext: string | null }[];
  goals: { id: string; title: string; status: string }[];
}

function diffSummary(a: Payload, b: Payload, lang: string) {
  const key = (s: SectionRow) => `${s.categoryId}:${s.sectionType}`;
  const aMap = new Map(a.sections.map((s) => [key(s), JSON.stringify([s.content, s.bodyRichtext])]));
  let changed = 0;
  for (const s of b.sections) {
    const prev = aMap.get(key(s));
    if (prev !== undefined && prev !== JSON.stringify([s.content, s.bodyRichtext])) changed++;
  }
  const lvChanged = b.lifeVision.filter((v) => {
    const prev = a.lifeVision.find((x) => x.id === v.id);
    return prev && prev.answerRichtext !== v.answerRichtext;
  }).length;
  const goalsDelta = b.goals.length - a.goals.length;
  return lang === 'he'
    ? `${changed} סקשנים השתנו · ${lvChanged} תשובות חזון השתנו · ${goalsDelta >= 0 ? '+' : ''}${goalsDelta} מטרות`
    : `${changed} sections changed · ${lvChanged} life-vision answers changed · ${goalsDelta >= 0 ? '+' : ''}${goalsDelta} goals`;
}

export function SnapshotsPage() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [diffText, setDiffText] = useState<string | null>(null);

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['snapshots'],
    queryFn: () => api.get<SnapshotSummary[]>('/snapshots'),
  });

  const capture = useMutation({
    mutationFn: (l: string) => api.post<{ id: string }>('/snapshots', { label: l }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['snapshots'] }),
  });

  const compare = async (id: string) => {
    setDiffText(lang === 'he' ? 'משווה…' : 'Comparing…');
    const res = await api.get<{ snapshot: Payload; current: Payload }>(`/snapshots/${id}/diff`);
    setDiffText(diffSummary(res.snapshot, res.current, lang));
  };

  const doCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    await capture.mutateAsync(label.trim());
    setLabel('');
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold">{t('snapshots')}</h1>

      <Card className="p-5">
        <form onSubmit={doCapture} className="flex gap-3">
          <Input
            dir="auto"
            placeholder={lang === 'he' ? 'תווית — למשל "יוני 2026"' : 'Label — e.g. "June 2026"'}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={!label.trim() || capture.isPending}>
            <Camera size={15} /> {lang === 'he' ? 'צלם תמונת מצב' : 'Capture snapshot'}
          </Button>
        </form>
      </Card>

      {diffText && (
        <Card featured className="p-4 text-sm">
          {diffText}
        </Card>
      )}

      <Card className="px-5 py-2">
        {isLoading ? (
          <p className="py-4 text-fg-muted">{t('loading')}</p>
        ) : snapshots?.length ? (
          snapshots.map((s) => (
            <div key={s.id} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p dir="auto" className="font-medium">
                  {s.label}
                </p>
                <p className="text-xs text-fg-subtle">
                  {new Date(s.createdAt).toLocaleString(lang === 'he' ? 'he-IL' : 'en-GB')}
                </p>
              </div>
              <Badge variant="accent">{s.id.slice(0, 8)}</Badge>
              <Button variant="secondary" size="sm" onClick={() => compare(s.id)}>
                <GitCompareArrows size={13} /> {lang === 'he' ? 'השווה לעכשיו' : 'Compare to now'}
              </Button>
            </div>
          ))
        ) : (
          <p className="py-4 text-sm text-fg-faint">{t('empty')}</p>
        )}
      </Card>
    </div>
  );
}
