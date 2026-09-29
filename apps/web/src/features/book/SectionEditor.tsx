import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { BeliefShift, IdentityContent, ListItem } from '@dreamward/shared';
import { Button, Input, Textarea } from '@dreamward/design-system';
import { ChipInput } from '@/components/ChipInput';
import { useLang } from '@/lib/lang';
import { useAutosave } from '@/lib/useAutosave';
import { SaveIndicator } from '@/components/SaveIndicator';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { EditableList } from '@/components/editor/EditableList';
import { useUpdateSection, type Section } from './hooks';

interface ListContent {
  items?: ListItem[];
}
interface StrategyContent {
  habits?: ListItem[];
  leverages?: ListItem[];
}
interface PurposeContent {
  quote?: string;
  quoteAuthor?: string;
}

/** Editable view of a section; autosaves drafts as they change. */
export function SectionEditor({ section, categoryId }: { section: Section; categoryId: string }) {
  const { t, lang } = useLang();
  const update = useUpdateSection(categoryId);

  // Draft state initialised from the section once (the card remounts per edit toggle).
  const [items, setItems] = useState<ListItem[]>(() => (section.content as ListContent)?.items ?? []);
  const [habits, setHabits] = useState<ListItem[]>(() => (section.content as StrategyContent)?.habits ?? []);
  const [leverages, setLeverages] = useState<ListItem[]>(
    () => (section.content as StrategyContent)?.leverages ?? [],
  );
  const [html, setHtml] = useState<string>(section.bodyRichtext ?? '');
  const [quote, setQuote] = useState<string>(() => (section.content as PurposeContent)?.quote ?? '');
  const [quoteAuthor, setQuoteAuthor] = useState<string>(
    () => (section.content as PurposeContent)?.quoteAuthor ?? '',
  );

  const identity = (section.content ?? {}) as IdentityContent;
  const [statement, setStatement] = useState(identity.statement ?? '');
  const [states, setStates] = useState<ListItem[]>(identity.states ?? []);
  const [standards, setStandards] = useState<ListItem[]>(identity.standards ?? []);
  const [shifts, setShifts] = useState<BeliefShift[]>(identity.beliefShifts ?? []);

  const draft = { items, habits, leverages, html, quote, quoteAuthor, statement, states, standards, shifts };
  const status = useAutosave(JSON.stringify(draft), async () => {
    switch (section.shape) {
      case 'list':
        return update.mutateAsync({ id: section.id, content: { items } });
      case 'composite':
        return update.mutateAsync({ id: section.id, content: { habits, leverages } });
      case 'statement':
        return update.mutateAsync({ id: section.id, bodyRichtext: html });
      case 'rich':
        return update.mutateAsync({
          id: section.id,
          bodyRichtext: html,
          content: { quote: quote || undefined, quoteAuthor: quoteAuthor || undefined },
        });
      case 'identity': {
        const content: IdentityContent = {
          statement,
          states,
          standards: standards.filter((it) => it.text.trim()),
          beliefShifts: shifts.filter((b) => b.from.trim() || b.to.trim()),
        };
        return update.mutateAsync({ id: section.id, content });
      }
    }
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-4 justify-end">
        <SaveIndicator status={status} />
      </div>

      {section.shape === 'list' && <EditableList items={items} onChange={setItems} />}

      {section.shape === 'composite' && (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-fg-muted">{t('habits')}</h4>
            <EditableList items={habits} onChange={setHabits} />
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-fg-muted">{t('leverages')}</h4>
            <EditableList items={leverages} onChange={setLeverages} />
          </div>
        </div>
      )}

      {(section.shape === 'statement' || section.shape === 'rich') && (
        <RichTextEditor value={html} onChange={setHtml} />
      )}

      {section.shape === 'identity' && (
        <IdentityEditor
          statement={statement}
          onStatement={setStatement}
          states={states}
          onStates={setStates}
          standards={standards}
          onStandards={setStandards}
          shifts={shifts}
          onShifts={setShifts}
        />
      )}

      {section.shape === 'rich' && (
        <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
          <Input
            dir="auto"
            placeholder={lang === 'he' ? 'ציטוט (אופציונלי)' : 'Quote (optional)'}
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
          />
          <Input
            dir="auto"
            placeholder={lang === 'he' ? 'מקור הציטוט' : 'Quote author'}
            value={quoteAuthor}
            onChange={(e) => setQuoteAuthor(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

const newId = () => `new_${crypto.randomUUID().slice(0, 8)}`;

function IdentityEditor(p: {
  statement: string;
  onStatement: (v: string) => void;
  states: ListItem[];
  onStates: (v: ListItem[]) => void;
  standards: ListItem[];
  onStandards: (v: ListItem[]) => void;
  shifts: BeliefShift[];
  onShifts: (v: BeliefShift[]) => void;
}) {
  const { lang } = useLang();
  const he = lang === 'he';
  const setShift = (id: string, patch: Partial<BeliefShift>) =>
    p.onShifts(p.shifts.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-fg-muted">
          {he ? 'מי אני כשאני חי את החזון הזה?' : 'Who am I when I live this vision?'}
        </span>
        <Textarea
          dir="auto"
          rows={2}
          value={p.statement}
          placeholder={he ? 'אני אדם ש…' : 'I am someone who…'}
          onChange={(e) => p.onStatement(e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-fg-muted">
          {he ? 'מצבים פנימיים רצויים (3-5)' : 'Desired inner states (3–5)'}
        </span>
        <ChipInput
          chips={p.states}
          onAdd={(text) => p.onStates([...p.states, { id: newId(), text, order: p.states.length }])}
          onRemove={(id) => p.onStates(p.states.filter((it) => it.id !== id).map((it, i) => ({ ...it, order: i })))}
          placeholder={he ? 'למשל: חופש, סקרנות, שקט' : 'e.g. freedom, curiosity, calm'}
          addLabel={he ? 'הוסף' : 'Add'}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-fg-muted">
          {he ? 'סטנדרטים וגבולות — למה אני אומר כן, ולמה לא' : 'Standards & boundaries — what I say yes and no to'}
        </span>
        <EditableList items={p.standards} onChange={p.onStandards} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-fg-muted">
          {he ? 'שינויי אמונה — מאמונה מגבילה לאמונה אמינה ומעצימה' : 'Belief shifts — from a limiting belief to a believable, empowering one'}
        </span>
        {p.shifts.map((b) => (
          <div key={b.id} className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
            <Input
              dir="auto"
              value={b.from}
              placeholder={he ? 'האמונה הישנה' : 'Old belief'}
              onChange={(e) => setShift(b.id, { from: e.target.value })}
            />
            <span className="hidden text-fg-faint sm:block" aria-hidden>
              {he ? '←' : '→'}
            </span>
            <Input
              dir="auto"
              value={b.to}
              placeholder={he ? 'האמונה החדשה' : 'New belief'}
              onChange={(e) => setShift(b.id, { to: e.target.value })}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="delete belief shift"
              onClick={() => p.onShifts(p.shifts.filter((x) => x.id !== b.id))}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => p.onShifts([...p.shifts, { id: newId(), from: '', to: '' }])}
        >
          <Plus size={14} /> {he ? 'הוסף שינוי אמונה' : 'Add belief shift'}
        </Button>
      </div>
    </div>
  );
}
