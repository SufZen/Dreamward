/* ============================================================================
 * Settings → Agent routines: enable/disable the autonomous Lify runs
 * (daily plan, weekly review prep, goal drift), pick the hour, and decide
 * whether action proposals apply automatically or wait for approval.
 * ========================================================================= */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Play, Sparkles } from 'lucide-react';
import { Badge, Button, Card } from '@dreamward/design-system';
import { api } from '@/lib/api';
import { useLang } from '@/lib/lang';

interface RoutineRow {
  id: string;
  kind: 'daily_plan' | 'weekly_review_prep' | 'goal_drift';
  enabled: number;
  scheduleHour: number;
  autoApprove: number;
  lastRunAt: number | null;
  lastStatus: string | null;
}

const KIND_META: Record<RoutineRow['kind'], { he: string; en: string; heDesc: string; enDesc: string }> = {
  daily_plan: {
    he: 'תוכנית יומית',
    en: 'Daily plan',
    heDesc: 'חיימי סוקר מטרות ופעולות ומרכיב את מיקוד היום (מרענן את תדריך הבוקר)',
    enDesc: 'Lify reviews goals & actions and builds today’s focus (refreshes the morning briefing)',
  },
  weekly_review_prep: {
    he: 'הכנה לסקירה שבועית',
    en: 'Weekly review prep',
    heDesc: 'בימי שישי — סיכום השבוע לקראת טקס השבת',
    enDesc: 'Fridays — summarizes the week ahead of the Saturday ritual',
  },
  goal_drift: {
    he: 'איתור מטרות תקועות',
    en: 'Goal drift detection',
    heDesc: 'בימי ראשון ורביעי — מאתר מטרות תקועות/בסיכון ומציע צעדים מתקנים',
    enDesc: 'Sundays & Wednesdays — finds stalled/at-risk goals and proposes corrective steps',
  },
};

export function RoutinesSettings() {
  const { lang } = useLang();
  const he = lang === 'he';
  const qc = useQueryClient();
  const { data: routines } = useQuery({ queryKey: ['routines'], queryFn: () => api.get<RoutineRow[]>('/routines') });

  const update = useMutation({
    mutationFn: (vars: { id: string; enabled?: boolean; scheduleHour?: number; autoApprove?: boolean }) =>
      api.patch(`/routines/${vars.id}`, { ...vars, id: undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  });
  const runNow = useMutation({
    mutationFn: (id: string) => api.post(`/routines/${id}/run`),
    onSettled: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  });

  return (
    <Card className="p-6">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <Sparkles size={18} className="text-primary" /> {he ? 'ריצות אוטומטיות של חיימי' : 'Autonomous Lify routines'}
      </h2>
      <p className="mb-4 text-sm text-fg-muted">
        {he
          ? 'חיימי רץ לבד לפי לוח זמנים, מנתח את ספר החיים ומציע (או מיישם) פעולות. דורש ספק AI פעיל.'
          : 'Lify runs on a schedule, analyzes your book and proposes (or applies) actions. Requires an active AI provider.'}
      </p>

      <div className="flex flex-col gap-4">
        {routines?.map((r) => {
          const meta = KIND_META[r.kind];
          return (
            <div key={r.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={r.enabled === 1}
                    onChange={(e) => update.mutate({ id: r.id, enabled: e.target.checked })}
                    className="h-4 w-4 accent-[color:var(--rz-accent)]"
                  />
                  <span className="font-medium">{he ? meta.he : meta.en}</span>
                </label>
                <span className="text-xs text-fg-subtle">{he ? meta.heDesc : meta.enDesc}</span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2 text-fg-muted">
                  <CalendarCheck size={14} />
                  {he ? 'שעה' : 'Hour'}
                  <select
                    value={r.scheduleHour}
                    onChange={(e) => update.mutate({ id: r.id, scheduleHour: Number(e.target.value) })}
                    className="h-7 rounded-md border border-border bg-surface px-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 text-fg-muted">
                  <input
                    type="checkbox"
                    checked={r.autoApprove === 1}
                    onChange={(e) => update.mutate({ id: r.id, autoApprove: e.target.checked })}
                    className="h-4 w-4 accent-[color:var(--rz-accent)]"
                  />
                  {he ? 'יישום פעולות אוטומטי (ללא אישור)' : 'Auto-apply action proposals'}
                </label>

                <Button
                  size="sm"
                  variant="secondary"
                  disabled={runNow.isPending}
                  onClick={() => runNow.mutate(r.id)}
                >
                  <Play size={13} /> {he ? 'הרץ עכשיו' : 'Run now'}
                </Button>

                {r.lastStatus && (
                  <span className="ms-auto flex items-center gap-1.5 text-xs text-fg-subtle">
                    {r.lastRunAt && new Date(r.lastRunAt).toLocaleString()}
                    <Badge
                      variant={
                        r.lastStatus.startsWith('ok') ? 'success' : r.lastStatus === 'running' ? 'neutral' : 'warning'
                      }
                    >
                      {r.lastStatus.slice(0, 40)}
                    </Badge>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
