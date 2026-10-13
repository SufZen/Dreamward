/**
 * Living reference for the design system (dev builds only — not linked from
 * the app, not translated). Every swatch, curve and component here is the
 * real token or component, so this page is also the visual regression check.
 */
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Badge,
  BreathingOrb,
  Button,
  Card,
  CardDescription,
  CardTitle,
  Check,
  ClarityAvatar,
  CountUp,
  EmptyState,
  Input,
  ProgressRing,
  Skeleton,
  StarBurst,
  Twinkles,
  setMotionPreference,
  useSpotlight,
  withViewTransition,
  type MotionPreference,
  type StarBurstHandle,
} from '@dreamward/design-system';
import { useTheme } from '@/lib/theme';
import { ScoreSlider } from '@/components/ScoreSlider';

const RAMPS: { name: string; steps: string[] }[] = [
  { name: 'Ink · night sky', steps: ['ink-0', 'ink-1', 'ink-2', 'ink-3', 'ink-4', 'ink-5', 'ink-6'] },
  { name: 'Mist · text on night', steps: ['mist-4', 'mist-3', 'mist-2', 'mist-1'] },
  { name: 'Day · light theme', steps: ['day-1', 'day-2', 'day-3', 'day-4', 'day-5'] },
  { name: 'Gold · the star', steps: ['gold-7', 'gold-8', 'gold-9', 'gold-10', 'gold-11'] },
  { name: 'Dawn · ambient only', steps: ['dawn'] },
];

const SEMANTIC = [
  ['--rz-bg', 'Page'],
  ['--rz-bg-sunken', 'Sidebar'],
  ['--rz-bg-raised', 'Card'],
  ['--rz-surface', 'Input · popover'],
  ['--rz-surface-hover', 'Hover'],
  ['--rz-accent', 'Primary'],
  ['--rz-success', 'Success'],
  ['--rz-warning', 'Warning'],
  ['--rz-danger', 'Danger'],
  ['--rz-info', 'Info'],
];

const TEXT = [
  ['--rz-fg', 'Body text', '16.7:1'],
  ['--rz-fg-muted', 'Secondary', '9.6:1'],
  ['--rz-fg-subtle', 'Tertiary', '6.7:1'],
  ['--rz-fg-faint', 'Faint · placeholders', '4.9:1'],
  ['--rz-accent-text', 'Gold as text', '11.9:1'],
];

const TYPE = [
  ['6xl', 'text-6xl font-semibold', 'The life you envision'],
  ['4xl', 'text-4xl font-semibold', 'Current chapter'],
  ['2xl', 'text-2xl font-semibold', 'Health & vitality'],
  ['xl', 'text-xl font-semibold', 'Run the half-marathon in spring'],
  ['lg', 'text-lg', 'What would make this season feel well lived?'],
  ['base', 'text-base', 'Three small steps this week move you toward the star. Pick one and begin.'],
  ['sm', 'text-sm', 'Rated 7 of 10 · two weeks ago'],
  ['xs', 'text-xs', 'Last saved a moment ago'],
];

const CURVES = [
  ['ease-standard', '--rz-ease-standard', '--rz-dur-moderate', 'Routine UI, colour, opacity'],
  ['ease-enter', '--rz-ease-enter', '--rz-dur-moderate', 'Things arriving'],
  ['ease-exit', '--rz-ease-exit', '--rz-dur', 'Things leaving (0.7× entrance)'],
  ['spring-snappy', '--rz-spring-snappy', '--rz-spring-snappy-dur', 'Press, toggle, small moves'],
  ['spring', '--rz-spring', '--rz-spring-dur', 'Cards, panels, layout'],
  ['spring-dream', '--rz-spring-dream', '--rz-spring-dream-dur', 'Celebrations, the star'],
  ['spring-gentle', '--rz-spring-gentle', '--rz-spring-gentle-dur', 'Large surfaces, sheets'],
] as const;

function Section({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  return (
    <section className="space-y-5 border-t border-border pt-10">
      <div className="max-w-2xl space-y-1.5">
        <h2 className="text-2xl">{title}</h2>
        {lede && <p className="text-fg-muted">{lede}</p>}
      </div>
      {children}
    </section>
  );
}

function CurveRow({ name, ease, dur, use, run }: { name: string; ease: string; dur: string; use: string; run: number }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] items-center gap-4 sm:grid-cols-[10rem_1fr_14rem]">
      <code className="text-xs text-fg-muted">{name}</code>
      <div className="relative h-8 rounded-full bg-bg-sunken">
        <span
          key={run}
          className="absolute top-1 h-6 w-6 rounded-full bg-primary"
          style={
            {
              insetInlineStart: 4,
              animation: run ? `ds-travel var(${dur}) var(${ease}) both` : undefined,
            } as CSSProperties
          }
        />
      </div>
      <span className="hidden text-sm text-fg-subtle sm:block">{use}</span>
    </div>
  );
}

const TASKS = ['Book the physio appointment', 'Ten minutes of journaling', 'Call Dana about the trip'];

function GoalDemo() {
  const [open, setOpen] = useState(false);
  const spot = useSpotlight<HTMLDivElement>();
  const toggle = () => withViewTransition(() => setOpen((o) => !o));
  if (open) {
    return (
      <Card className="space-y-4 p-6" style={{ viewTransitionName: 'goal-card' } as CSSProperties}>
        <div className="flex items-center gap-4">
          <ProgressRing value={0.6} size={64} label="60%" ariaLabel="60% done" />
          <div>
            <h3 className="text-xl" style={{ viewTransitionName: 'goal-title' } as CSSProperties}>
              Run the half-marathon in spring
            </h3>
            <p className="text-sm text-fg-muted">Health & vitality · 6 of 10 steps</p>
          </div>
        </div>
        <p className="dw-prose text-fg-muted">
          Three runs a week, one of them long. The long run grows by a kilometre every second week until the taper in
          March.
        </p>
        <Button variant="secondary" onClick={toggle}>
          Back to goals
        </Button>
      </Card>
    );
  }
  return (
    <Card
      ref={spot}
      interactive
      onClick={toggle}
      className="flex items-center gap-4"
      style={{ viewTransitionName: 'goal-card' } as CSSProperties}
    >
      <ProgressRing value={0.6} size={44} stroke={4} ariaLabel="60% done" />
      <div className="min-w-0">
        <CardTitle className="text-md" style={{ viewTransitionName: 'goal-title' } as CSSProperties}>
          Run the half-marathon in spring
        </CardTitle>
        <CardDescription>Health & vitality · click to open</CardDescription>
      </div>
    </Card>
  );
}

export function DesignSystemPage() {
  const { mode, setMode } = useTheme();
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr');
  const [motion, setMotion] = useState<MotionPreference>('system');
  const [run, setRun] = useState(0);
  const [done, setDone] = useState<boolean[]>([true, false, false]);
  const [score, setScore] = useState(6);
  const goalBurst = useRef<StarBurstHandle>(null);
  const chapterBurst = useRef<StarBurstHandle>(null);

  return (
    <div dir={dir} className="mx-auto max-w-5xl space-y-12 px-6 pb-24">
      <style>{'@keyframes ds-travel { from { inset-inline-start: 4px } to { inset-inline-start: calc(100% - 28px) } }'}</style>
      {/* Hero: the sky this system is built from */}
      <header className="dw-sky relative -mx-6 overflow-hidden rounded-b-2xl px-6 pb-12 pt-16">
        <Twinkles density={0.7} />
        <div className="relative max-w-2xl space-y-4">
          <h1 className="text-5xl leading-[var(--rz-lh-heading-lg)]">Night sky</h1>
          <p className="text-lg text-fg-muted">
            Dreamward’s design system: a calm night, one gold star, and motion that answers you — the step counts, the
            wheel moves, the ritual breathes.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>
              {mode === 'dark' ? 'Light theme' : 'Dark theme'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDir(dir === 'ltr' ? 'rtl' : 'ltr')}>
              {dir === 'ltr' ? 'Right to left' : 'Left to right'}
            </Button>
            {(['system', 'reduced', 'full'] as const).map((m) => (
              <Button
                key={m}
                variant={motion === m ? 'outline' : 'ghost'}
                size="sm"
                aria-pressed={motion === m}
                onClick={() => {
                  setMotion(m);
                  setMotionPreference(m);
                }}
              >
                Motion: {m}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <Section title="Colour" lede="OKLCH ramps (tier 1) feed semantic tokens (tier 2). The ink is a blue-violet night, raised by lightness; gold is the one star on a screen.">
        <div className="space-y-4">
          {RAMPS.map((r) => (
            <div key={r.name} className="grid items-center gap-3 sm:grid-cols-[12rem_1fr]">
              <span className="text-sm text-fg-muted">{r.name}</span>
              <div className="flex overflow-hidden rounded-lg border border-border">
                {r.steps.map((s) => (
                  <div key={s} className="h-14 flex-1" style={{ background: `var(--dw-${s})` }} title={`--dw-${s}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SEMANTIC.map(([v, label]) => (
            <div key={v} className="space-y-1.5">
              <div className="h-16 rounded-lg border border-border" style={{ background: `var(${v})` }} />
              <div className="text-sm">{label}</div>
              <code className="text-2xs text-fg-subtle">{v}</code>
            </div>
          ))}
        </div>
        <Card className="divide-y divide-border p-0">
          {TEXT.map(([v, label, ratio]) => (
            <div key={v} className="flex items-center justify-between gap-4 px-4 py-3">
              <span style={{ color: `var(${v})` }}>{label} — the steps lead to the star</span>
              <span className="tabular text-xs text-fg-subtle">{ratio} on card (dark)</span>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Type" lede="Poppins with Rubik under it: Hebrew falls through glyph by glyph, so mixed lines keep one rhythm. Ratio 1.2; display sizes are fluid.">
        <div className="space-y-4">
          {TYPE.map(([size, cls, sample]) => (
            <div key={size} className="grid items-baseline gap-2 sm:grid-cols-[4rem_1fr]">
              <code className="text-xs text-fg-faint">{size}</code>
              <p className={cls}>{sample}</p>
            </div>
          ))}
        </div>
        <Card className="grid gap-6 sm:grid-cols-2">
          <div dir="ltr" className="space-y-2">
            <h3 className="text-xl">My dream life</h3>
            <p className="text-fg-muted">A home full of light, mornings that start slowly, and work that still feels like play.</p>
          </div>
          <div dir="rtl" className="space-y-2">
            <h3 className="text-xl">חיי החלומות שלי</h3>
            <p className="text-fg-muted">בית מלא אור, בקרים שמתחילים לאט, ועבודה שעדיין מרגישה כמו משחק. גם Dreamward וגם Clarity נשארים באותיות לטיניות.</p>
          </div>
        </Card>
      </Section>

      <Section title="Surfaces" lede="Elevation is lightness plus a 1px top highlight. Shadows start at level 2. Radius grows with the surface.">
        <div className="grid gap-4 rounded-2xl bg-background p-6 sm:grid-cols-4">
          {[
            ['Page', 'bg-background', ''],
            ['Sunken', 'bg-bg-sunken', ''],
            ['Card · 1', 'bg-card shadow-rz-1', 'rounded-lg'],
            ['Popover · 3', 'bg-surface shadow-rz-3', 'rounded-xl'],
          ].map(([l, cls, r]) => (
            <div key={l} className={`flex h-28 items-end border border-border p-3 text-sm text-fg-muted ${cls} ${r || 'rounded-lg'}`}>
              {l}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Motion" lede="Motion answers the person. Durations 80 · 120 · 200 · 280 · 450 · 900 ms. Springs move things; opacity and colour never overshoot. Press play to compare.">
        <Button onClick={() => setRun((r) => r + 1)}>Play the curves</Button>
        <div className="space-y-3">
          {CURVES.map(([name, ease, dur, use]) => (
            <CurveRow key={name} name={name} ease={ease} dur={dur} use={use} run={run} />
          ))}
        </div>
      </Section>

      <Section title="Signature moments" lede="Where Dreamward spends its boldness. Each one is a response to something you did, scaled to how much it matters.">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-4">
            <CardTitle className="text-md">A step counts</CardTitle>
            <ul className="space-y-3">
              {TASKS.map((t, i) => (
                <li key={t} className="flex items-center gap-3">
                  <Check
                    checked={done[i] ?? false}
                    label={t}
                    onChange={(v) => setDone((d) => d.map((x, j) => (j === i ? v : x)))}
                  />
                  <span className={done[i] ? 'text-fg-subtle line-through decoration-[color:var(--rz-fg-faint)]' : ''}>{t}</span>
                </li>
              ))}
            </ul>
            <div className="dw-steps" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <i key={i} data-done={i < done.filter(Boolean).length + 1 || undefined} />
              ))}
            </div>
          </Card>

          <Card className="flex flex-col items-center gap-4 text-center">
            <CardTitle className="text-md self-start">Rate an area</CardTitle>
            <ProgressRing value={score / 10} size={104} stroke={6} label={<CountUp value={score} />} ariaLabel={`${score} of 10`} />
            <ScoreSlider value={score} onChange={setScore} label="Score" lowHint="Far from my vision" highHint="Living it" className="w-full" />
          </Card>

          <Card className="relative flex flex-col items-center gap-3 overflow-visible py-8">
            <div className="relative">
              <Button onClick={() => goalBurst.current?.fire()}>Mark goal achieved</Button>
              <StarBurst ref={goalBurst} scale="goal" />
            </div>
            <div className="relative">
              <Button variant="secondary" onClick={() => chapterBurst.current?.fire()}>
                Close the chapter
              </Button>
              <StarBurst ref={chapterBurst} scale="chapter" />
            </div>
            <p className="text-sm text-fg-subtle">Action → spark · goal → burst · chapter → sky</p>
          </Card>

          <Card className="dw-sky relative flex flex-col items-center justify-center gap-10 overflow-hidden pb-14 pt-8">
            <Twinkles density={0.4} />
            <BreathingOrb size={140}>Breathe in… and out</BreathingOrb>
          </Card>

          <div className="space-y-3 md:col-span-2">
            <p className="text-sm text-fg-muted">Shared-element view transition (goal card → goal page):</p>
            <GoalDemo />
          </div>

          <Card className="flex items-center gap-4 md:col-span-2">
            <ClarityAvatar size={44} state="thinking" />
            <div>
              <CardTitle className="text-md">Clarity is thinking</CardTitle>
              <CardDescription>Replies fade in as they stream — no typewriter jitter.</CardDescription>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Components">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Save chapter</Button>
          <Button variant="secondary">Add a step</Button>
          <Button variant="outline">Preview</Button>
          <Button variant="ghost">Skip for now</Button>
          <Button variant="danger">Delete entry</Button>
          <Button loading>Saving</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Draft</Badge>
          <Badge variant="accent" dot>
            Focus area
          </Badge>
          <Badge variant="success">Done</Badge>
          <Badge variant="warning">Overdue</Badge>
          <Badge variant="danger">Failed to sync</Badge>
          <Badge variant="info">Suggested</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input placeholder="Name this chapter" />
          <Input aria-invalid placeholder="A title is required" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardTitle className="text-md">Card</CardTitle>
            <CardDescription>Level 1: the default surface for content.</CardDescription>
          </Card>
          <Card interactive>
            <CardTitle className="text-md">Interactive</CardTitle>
            <CardDescription>Lifts toward you; the light follows the pointer.</CardDescription>
          </Card>
          <Card featured>
            <CardTitle className="text-md">Featured</CardTitle>
            <CardDescription>The one focal surface: horizon light, a gold hairline.</CardDescription>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </Card>
          <Card className="p-0">
            <EmptyState
              title="No journal entries yet"
              hint="Write a line about today. It doesn’t have to be good — it has to be yours."
              action={<Button size="sm">Write the first entry</Button>}
            />
          </Card>
        </div>
      </Section>
    </div>
  );
}
