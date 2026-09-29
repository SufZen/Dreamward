interface DailyRow {
  day: string; // YYYY-MM-DD
  userId: number;
  promptTokens: number;
  completionTokens: number;
}

/** Dependency-free stacked bar chart of daily token usage (in + out). */
export function UsageChart({ daily, he }: { daily: DailyRow[]; he: boolean }) {
  // sum per day across users
  const byDay = new Map<string, { in: number; out: number }>();
  for (const r of daily) {
    const d = byDay.get(r.day) ?? { in: 0, out: 0 };
    d.in += r.promptTokens;
    d.out += r.completionTokens;
    byDay.set(r.day, d);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (days.length === 0) {
    return <p className="py-6 text-center text-sm text-fg-muted">{he ? 'אין נתוני שימוש בטווח הזה' : 'No usage in this range'}</p>;
  }

  const max = Math.max(1, ...days.map(([, d]) => d.in + d.out));
  const W = 640;
  const H = 160;
  const pad = { top: 8, bottom: 22, left: 4, right: 4 };
  const bw = (W - pad.left - pad.right) / days.length;
  const barW = Math.min(28, bw * 0.7);
  const scale = (v: number) => ((H - pad.top - pad.bottom) * v) / max;

  return (
    <div dir="ltr" className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="token usage by day">
        {days.map(([day, d], i) => {
          const x = pad.left + i * bw + (bw - barW) / 2;
          const hIn = scale(d.in);
          const hOut = scale(d.out);
          const yOut = H - pad.bottom - hOut;
          const yIn = yOut - hIn;
          const showLabel = days.length <= 16 || i % Math.ceil(days.length / 16) === 0;
          return (
            <g key={day}>
              <rect x={x} y={yIn} width={barW} height={hIn} rx={2} fill="var(--rz-accent)" opacity={0.9}>
                <title>{`${day}: ${d.in} in`}</title>
              </rect>
              <rect x={x} y={yOut} width={barW} height={hOut} rx={2} fill="var(--rz-info)" opacity={0.8}>
                <title>{`${day}: ${d.out} out`}</title>
              </rect>
              {showLabel && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="fill-[color:var(--rz-fg-faint)]" fontSize="9">
                  {day.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center justify-center gap-4 text-2xs text-fg-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--rz-accent)' }} /> {he ? 'קלט' : 'Prompt'}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--rz-info)' }} /> {he ? 'פלט' : 'Completion'}
        </span>
      </div>
    </div>
  );
}
