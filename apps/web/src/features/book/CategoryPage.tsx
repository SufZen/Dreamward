import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Pencil, Plus, Target } from 'lucide-react';
import { Badge, Button, Card, PageHeader, PageLoader, ProgressRing, cn, toast } from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';
import { Icon } from '@/components/Icon';
import { SECTION_TYPES } from '@dreamward/shared';
import { useCategory, type Section } from './hooks';
import { BookCrumb } from './BookCrumb';
import { SectionRenderer } from './SectionRenderer';
import { SectionEditor } from './SectionEditor';
import { RatingCard } from '@/features/chapter/RatingCard';
import { useCategoryRole } from '@/features/chapter/hooks';
import { useCreateGoal, useGoals, useGoalsProgress } from '@/features/goals/hooks';
import { useActions } from '@/features/actions/hooks';
import { StepItem } from '@/features/actions/StepItem';

/** Section title — the server's framework-pack wording, else the default pack. */
const sectionLabel = (lang: 'he' | 'en', section: { sectionType: string; labelEn?: string; labelHe?: string }) => {
  const t = SECTION_TYPES.find((s) => s.id === section.sectionType);
  const en = section.labelEn ?? t?.labelEn ?? section.sectionType;
  const he = section.labelHe ?? t?.labelHe ?? section.sectionType;
  return lang === 'he' ? he : en;
};

/** A question that gets you writing, per section type. */
const PROMPTS: Record<string, { he: string; en: string }> = {
  premises: {
    he: 'מה אני מאמין לגבי התחום הזה? האמונות שמחזיקות אותי — וגם אלה שעוצרות אותי.',
    en: 'What do I believe about this area? The beliefs that hold me up — and the ones that hold me back.',
  },
  vision: {
    he: 'איך נראה התחום הזה במיטבו? כתוב כאילו זה כבר קורה.',
    en: 'What does this area look like at its best? Write it as if it’s already true.',
  },
  identity: {
    he: 'מי אני כשאני חי את החזון הזה? איך אני מרגיש, למה אני אומר כן ולמה לא?',
    en: 'Who am I when I live this vision? How do I feel, what do I say yes and no to?',
  },
  purpose: {
    he: 'למה זה באמת חשוב לי?',
    en: 'Why does this really matter to me?',
  },
  strategy: {
    he: 'אילו הרגלים ומנופים יביאו אותי לשם?',
    en: 'Which habits and levers will get me there?',
  },
  qol_experiences: {
    he: 'אילו חוויות אני רוצה לחיות?',
    en: 'Which experiences do I want to live?',
  },
  qol_environment: {
    he: 'באיזו סביבה אני רוצה לחיות?',
    en: 'What surroundings do I want to live in?',
  },
  qol_materialistic: {
    he: 'מה אני רוצה שיהיה לי?',
    en: 'What do I want to have?',
  },
};

/** True when a section has anything written in it (any shape). */
function isWritten(s: Section): boolean {
  if ((s.bodyRichtext ?? '').replace(/<[^>]*>/g, '').trim()) return true;
  const hasText = (v: unknown): boolean =>
    typeof v === 'string'
      ? v.trim().length > 0
      : Array.isArray(v)
        ? v.some(hasText)
        : v && typeof v === 'object'
          ? Object.entries(v).some(([k, x]) => k !== 'id' && k !== 'order' && hasText(x))
          : false;
  return hasText(s.content);
}

export function CategoryPage() {
  const { categoryId = '' } = useParams();
  const { lang, t } = useLang();
  const he = lang === 'he';
  const { data, isLoading, isError } = useCategory(categoryId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const role = useCategoryRole(categoryId);

  if (isLoading) return <PageLoader label={t('loading')} />;
  if (isError || !data)
    return (
      <Card className="p-6 text-center">
        <p className="font-medium">{he ? 'לא הצלחנו לטעון את התחום הזה' : 'Couldn’t load this area'}</p>
        <p className="mt-1 text-sm text-fg-muted">
          {he ? 'בדוק את החיבור ונסה לרענן.' : 'Check your connection and try refreshing.'}
        </p>
      </Card>
    );

  const sections = data.sections.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const written = sections.filter(isWritten).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={<BookCrumb />}
        icon={<Icon name={data.icon} size={24} />}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span dir="auto">{pickLabel(lang, data.labelEn, data.labelHe)}</span>
            {role && (
              <Badge variant={role === 'focus' ? 'accent' : 'neutral'}>
                {role === 'focus' ? (he ? 'מיקוד בפרק' : 'Chapter focus') : he ? 'תחזוקה' : 'Maintenance'}
              </Badge>
            )}
          </span>
        }
        description={
          he ? `${written} מתוך ${sections.length} חלקים נכתבו` : `${written} of ${sections.length} sections written`
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <RatingCard categoryId={categoryId} />
        <InMotion categoryId={categoryId} />
      </div>

      {sections.map((section) => {
        const editing = editingId === section.id;
        const empty = !isWritten(section);
        const prompt = PROMPTS[section.sectionType];
        return (
          <Card key={section.id} className={cn('p-6', empty && !editing && 'border-dashed bg-transparent shadow-none')}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{sectionLabel(lang, section)}</h2>
              {(!empty || editing) && (
                <Button
                  variant={editing ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setEditingId(editing ? null : section.id)}
                >
                  {editing ? <Check size={14} /> : <Pencil size={14} />}
                  {editing ? (he ? 'סיום' : 'Done') : he ? 'עריכה' : 'Edit'}
                </Button>
              )}
            </div>
            {editing ? (
              <SectionEditor section={section} categoryId={categoryId} />
            ) : empty ? (
              <button
                type="button"
                onClick={() => setEditingId(section.id)}
                className="group flex w-full items-start gap-3 rounded-md text-start"
              >
                <span className="flex-1 text-fg-muted group-hover:text-foreground">
                  {prompt ? (he ? prompt.he : prompt.en) : t('empty')}
                </span>
                <span className="inline-flex flex-none items-center gap-1.5 text-sm font-medium text-primary">
                  <Pencil size={14} /> {he ? 'לכתוב' : 'Write'}
                </span>
              </button>
            ) : (
              <SectionRenderer section={section} />
            )}
          </Card>
        );
      })}
    </div>
  );
}

/** This area's goals and next steps, so the vision connects to doing. */
function InMotion({ categoryId }: { categoryId: string }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data: goals } = useGoals();
  const { data: progress } = useGoalsProgress();
  const { data: actions } = useActions({ status: 'todo' });
  const create = useCreateGoal();
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const areaGoals = (goals ?? []).filter((g) => g.categoryId === categoryId && g.status !== 'achieved');
  const goalIds = new Set(areaGoals.map((g) => g.id));
  const steps = (actions ?? []).filter((a) => a.goalId && goalIds.has(a.goalId)).slice(0, 3);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const v = title.trim();
    if (!v) return;
    create.mutate(
      { title: v, categoryId },
      {
        onSuccess: () => toast(he ? 'המטרה נוספה' : 'Goal added', { tone: 'success' }),
      },
    );
    setTitle('');
    setAdding(false);
  };

  return (
    <Card className="flex flex-col gap-3 p-6">
      <div className="flex items-center gap-2">
        <Target size={18} className="text-primary" />
        <h2 className="flex-1 text-lg font-semibold">{he ? 'בתנועה' : 'In motion'}</h2>
        <Link to="/goals" className="text-xs text-fg-subtle hover:text-foreground">
          {he ? 'לכל המטרות' : 'All goals'}
        </Link>
      </div>
      {areaGoals.length === 0 ? (
        <p className="text-sm text-fg-muted">
          {he
            ? 'אין עדיין מטרה בתחום הזה. מה הדבר האחד שהיה מקרב אותך לחזון?'
            : 'No goal in this area yet. What one thing would move you toward the vision?'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {areaGoals.map((g) => {
            const p = progress?.[g.id];
            return (
              <li key={g.id}>
                <Link to={`/goals#goal-${g.id}`} className="group flex items-center gap-3">
                  <ProgressRing
                    value={(p?.pct ?? 0) / 100}
                    size={30}
                    stroke={3}
                    ariaLabel={p?.pct != null ? `${p.pct}%` : he ? 'אין צעדים' : 'No steps'}
                  />
                  <span dir="auto" className="min-w-0 flex-1 truncate text-sm group-hover:text-primary">
                    {g.title}
                  </span>
                  {p && p.totalActions > 0 && (
                    <span className="tabular text-xs text-fg-subtle">
                      {p.doneActions}/{p.totalActions}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {steps.length > 0 && (
        <div>
          <p className="pt-1 text-xs font-medium text-fg-subtle">{he ? 'הצעדים הבאים' : 'Next steps'}</p>
          <ul className="divide-y divide-border">
            {steps.map((a) => (
              <StepItem key={a.id} action={a} />
            ))}
          </ul>
        </div>
      )}
      {adding ? (
        <form onSubmit={add} className="flex items-center gap-2">
          <input
            autoFocus
            dir="auto"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => !title.trim() && setAdding(false)}
            placeholder={he ? 'מטרה חדשה בתחום הזה…' : 'A new goal in this area…'}
            className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-sm placeholder:text-fg-faint focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[color:var(--rz-accent-ring)]"
          />
          <Button type="submit" size="sm" loading={create.isPending}>
            {he ? 'הוספה' : 'Add'}
          </Button>
        </form>
      ) : (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setAdding(true)}>
          <Plus size={14} /> {he ? 'מטרה בתחום הזה' : 'Add a goal here'}
        </Button>
      )}
    </Card>
  );
}
