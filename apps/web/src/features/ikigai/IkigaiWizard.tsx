import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Trash2 } from 'lucide-react';
import {
  IKIGAI_CIRCLES,
  ikigaiCompletionIssues,
  type IkigaiCircle,
  type IkigaiItem,
  type IkigaiProfile,
  type ListItem,
} from '@dreamward/shared';
import { Button, Card, cn } from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';
import { useAutosave } from '@/lib/useAutosave';
import { SaveIndicator } from '@/components/SaveIndicator';
import { Stepper } from '@/components/Stepper';
import { CircleStep, EverydayStep, MapStep, SynthesisStep, VennStep } from './steps';
import { useCompleteIkigai, useDiscardIkigaiDraft, useUpdateIkigai } from './hooks';

type StepDef = { key: string; en: string; he: string; circle?: IkigaiCircle };

const STEPS: StepDef[] = [
  { key: 'intro', en: 'Start', he: 'פתיחה' },
  ...IKIGAI_CIRCLES.map((c) => ({ key: c.id, en: c.labelEn, he: c.labelHe, circle: c.id })),
  { key: 'map', en: 'Map', he: 'מיפוי' },
  { key: 'venn', en: 'Picture', he: 'התמונה' },
  { key: 'everyday', en: 'Everyday', he: 'יומיומי' },
  { key: 'synthesis', en: 'My IKIGAI', he: 'האיקיגאי שלי' },
];

/** Guided IKIGAI flow over a draft profile; every change autosaves (resumable). */
export function IkigaiWizard({ draft, isRevisit }: { draft: IkigaiProfile; isRevisit: boolean }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const update = useUpdateIkigai(draft.id);
  const complete = useCompleteIkigai();
  const discard = useDiscardIkigaiDraft();

  const [step, setStep] = useState(Math.min(draft.step, STEPS.length - 1));
  const [items, setItems] = useState<IkigaiItem[]>(draft.items);
  const [everyday, setEveryday] = useState<ListItem[]>(draft.everyday);
  const [statement, setStatement] = useState(draft.statement ?? '');
  const [confidence, setConfidence] = useState<number | null>(draft.confidence);
  const [why, setWhy] = useState(draft.reflections.why ?? '');
  const [showIssues, setShowIssues] = useState(false);

  const payload = { items, everyday, statement, confidence, why, step };
  const status = useAutosave(JSON.stringify(payload), () =>
    update.mutateAsync({
      items,
      everyday,
      statement: statement.trim() || null,
      confidence,
      reflections: { ...draft.reflections, why },
      step,
    }),
  );

  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;
  const issues = ikigaiCompletionIssues({ items, statement });
  const go = (n: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const finish = async () => {
    if (issues.length) {
      setShowIssues(true);
      return;
    }
    // flush the latest edits before promoting the draft
    await update.mutateAsync({
      items,
      everyday,
      statement: statement.trim(),
      confidence,
      reflections: { ...draft.reflections, why },
      step,
    });
    complete.mutate(draft.id);
  };

  return (
    <div className="flex flex-col gap-6">
      <Stepper
        steps={STEPS.map((s) => ({ ...s, color: s.circle ? IKIGAI_CIRCLES.find((c) => c.id === s.circle)!.color : undefined }))}
        step={step}
        onGo={go}
        aside={<SaveIndicator status={status} />}
      />

      <Card className="p-6">
        {current.key === 'intro' && <Intro isRevisit={isRevisit} />}
        {current.circle && (
          <CircleStep circle={current.circle} items={items} onItems={setItems} profileId={draft.id} />
        )}
        {current.key === 'map' && <MapStep items={items} onItems={setItems} />}
        {current.key === 'venn' && <VennStep items={items} />}
        {current.key === 'everyday' && <EverydayStep everyday={everyday} onEveryday={setEveryday} profileId={draft.id} />}
        {current.key === 'synthesis' && (
          <SynthesisStep
            profileId={draft.id}
            items={items}
            statement={statement}
            onStatement={setStatement}
            confidence={confidence}
            onConfidence={setConfidence}
            why={why}
            onWhy={setWhy}
          />
        )}

        {last && showIssues && issues.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1 rounded-lg bg-warning-soft p-3 text-sm text-warning">
            {issues.map((iss) =>
              iss.kind === 'no_statement' ? (
                <li key="statement">{he ? 'כתוב משפט איקיגאי.' : 'Write your IKIGAI statement.'}</li>
              ) : (
                <li key={iss.circle}>
                  {he ? 'המעגל ' : 'The circle '}“
                  {pickLabel(
                    lang,
                    IKIGAI_CIRCLES.find((c) => c.id === iss.circle)!.labelEn,
                    IKIGAI_CIRCLES.find((c) => c.id === iss.circle)!.labelHe,
                  )}
                  ” {he ? 'עדיין ריק.' : 'is still empty.'}
                </li>
              ),
            )}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => go(step - 1)} disabled={step === 0}>
            <ArrowRight size={15} className="ltr:hidden" />
            <ArrowLeft size={15} className="rtl:hidden" />
            {he ? 'הקודם' : 'Back'}
          </Button>
          {isRevisit && (
            <Button
              variant="ghost"
              onClick={() => discard.mutate(draft.id)}
              loading={discard.isPending}
              title={he ? 'בטל את הביקור החוזר ושמור את האיקיגאי הנוכחי' : 'Discard this revisit and keep your current IKIGAI'}
            >
              <Trash2 size={14} /> {he ? 'בטל עדכון' : 'Discard'}
            </Button>
          )}
        </div>
        {last ? (
          <Button onClick={finish} loading={complete.isPending || update.isPending}>
            <Check size={15} /> {he ? 'זה האיקיגאי שלי' : 'This is my IKIGAI'}
          </Button>
        ) : (
          <Button onClick={() => go(step + 1)}>
            {step === 0 ? (he ? 'בוא נתחיל' : 'Let’s begin') : he ? 'הבא' : 'Next'}
            <ArrowLeft size={15} className="ltr:hidden" />
            <ArrowRight size={15} className="rtl:hidden" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Intro({ isRevisit }: { isRevisit: boolean }) {
  const { lang } = useLang();
  const he = lang === 'he';
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-3xl font-bold">
        {isRevisit ? (he ? 'חוזרים לאיקיגאי' : 'Revisiting your IKIGAI') : he ? 'איך זה עובד' : 'How this works'}
      </h2>
      <p className="text-fg-muted">
        {he
          ? 'איקיגאי (生き甲斐) — "הסיבה לקום בבוקר". נעבור על ארבעה מעגלים, נמצא איפה הם נפגשים, ונסכם במשפט אחד שמתאר את האיקיגאי שלך כרגע. זה לוקח כ-15 דקות, והכול נשמר — אפשר לעצור ולחזור מתי שתרצה.'
          : 'Ikigai (生き甲斐) — “a reason to get up in the morning”. We’ll go through four circles, find where they meet, and sum it up in one sentence that describes your IKIGAI right now. It takes about 15 minutes and everything autosaves — pause and come back any time.'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {IKIGAI_CIRCLES.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: c.color }} />
            <span className="text-sm">{pickLabel(lang, c.questionEn, c.questionHe)}</span>
          </div>
        ))}
      </div>
      <p className="text-sm text-fg-faint">
        {he
          ? 'בסוף נוסיף גם את "האיקיגאי היומיומי" — השמחות הקטנות — ברוח המשמעות היפנית המקורית.'
          : 'At the end we’ll also add your “everyday ikigai” — the small joys — in the spirit of the original Japanese meaning.'}
      </p>
    </div>
  );
}
