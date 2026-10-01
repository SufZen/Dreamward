import ReactMarkdown from 'react-markdown';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, RefreshCw, CalendarCheck } from 'lucide-react';
import { Button, Card, ClarityAvatar } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { api, ApiError } from '@/lib/api';
import { useAssistantStore } from './store';

interface BriefingResponse {
  date: string;
  content: string;
  cached: boolean;
  stale: boolean;
}

export function BriefingCard() {
  const { lang } = useLang();
  const qc = useQueryClient();
  const openPanel = useAssistantStore((s) => s.openPanel);
  const isSaturday = new Date().getDay() === 6;

  const briefing = useQuery({
    queryKey: ['briefing'],
    queryFn: () => api.get<BriefingResponse>('/agent/briefing'),
    retry: false,
    staleTime: 60 * 60_000,
  });

  const regenerate = useMutation({
    mutationFn: () => api.post<BriefingResponse>('/agent/briefing/regenerate'),
    onSuccess: (data) => qc.setQueryData(['briefing'], data),
  });

  const startReview = useMutation({
    mutationFn: () => api.post<{ conversationId: string }>('/agent/weekly-review/start'),
    onSuccess: (data) =>
      openPanel({
        conversationId: data.conversationId,
        focusMode: true,
        autoSend: lang === 'he' ? 'בוא נתחיל את הסקירה השבועית 🌱' : "Let's begin the weekly review 🌱",
      }),
  });

  // no provider configured → don't show the card at all
  if (briefing.isError && briefing.error instanceof ApiError && briefing.error.status === 503) return null;

  return (
    <Card featured className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <ClarityAvatar size={28} state={briefing.isLoading || regenerate.isPending ? 'thinking' : 'idle'} aria-hidden title="" />
        <h2 className="text-lg font-semibold">{lang === 'he' ? 'הבוקר שלך עם Clarity' : 'Your morning with Clarity'}</h2>
        <button
          onClick={() => regenerate.mutate()}
          disabled={regenerate.isPending}
          title={lang === 'he' ? 'רענן' : 'Regenerate'}
          className="ms-auto text-fg-subtle hover:text-foreground"
        >
          <RefreshCw size={15} className={regenerate.isPending ? 'animate-spin' : ''} />
        </button>
      </div>

      {briefing.isLoading || regenerate.isPending ? (
        <p className="text-sm text-fg-muted">{lang === 'he' ? 'התדריך של Clarity בדרך…' : 'Clarity is preparing something for you…'}</p>
      ) : briefing.data ? (
        <div dir="auto" className="dw-prose prose-sm">
          <ReactMarkdown>{briefing.data.content}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-fg-faint">{lang === 'he' ? 'אין תדריך כרגע.' : 'No briefing.'}</p>
      )}

      <div className="mt-4">
        <Button variant={isSaturday ? 'primary' : 'secondary'} size="sm" onClick={() => startReview.mutate()} disabled={startReview.isPending}>
          <CalendarCheck size={14} /> {lang === 'he' ? 'התחל סקירה שבועית' : 'Start weekly review'}
        </Button>
      </div>
    </Card>
  );
}
