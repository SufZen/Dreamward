import type { IdentityContent, ListItem } from '@dreamward/shared';
import { useLang } from '@/lib/lang';
import { sanitizeHtml } from '@/lib/sanitize';
import type { Section } from './hooks';

interface ListContent {
  items: ListItem[];
}
interface StrategyContent {
  habits: ListItem[];
  leverages: ListItem[];
}
interface PurposeContent {
  quote?: string;
  quoteAuthor?: string;
}

const asList = (c: unknown): ListItem[] => ((c as ListContent)?.items ?? []).slice().sort((a, b) => a.order - b.order);

function BulletList({ items }: { items: ListItem[] }) {
  const { t } = useLang();
  if (items.length === 0) return <p className="text-sm text-fg-faint">{t('empty')}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it) => (
        <li key={it.id} className="flex gap-2.5 text-foreground">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span dir="auto" className="leading-relaxed">
            {it.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RichBody({ html }: { html: string | null }) {
  const { t } = useLang();
  if (!html) return <p className="text-sm text-fg-faint">{t('empty')}</p>;
  return <div dir="auto" className="dw-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}

export function SectionRenderer({ section }: { section: Section }) {
  const { t } = useLang();

  switch (section.shape) {
    case 'list':
      return <BulletList items={asList(section.content)} />;

    case 'statement':
      return <RichBody html={section.bodyRichtext} />;

    case 'rich': {
      const c = section.content as PurposeContent | null;
      return (
        <div className="flex flex-col gap-4">
          <RichBody html={section.bodyRichtext} />
          {c?.quote && (
            <blockquote dir="auto" className="border-s-[3px] border-primary ps-4 text-fg-muted italic">
              “{c.quote}”
              {c.quoteAuthor && <footer className="mt-1 text-sm text-fg-subtle">— {c.quoteAuthor}</footer>}
            </blockquote>
          )}
        </div>
      );
    }

    case 'composite': {
      const c = section.content as StrategyContent | null;
      return (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-fg-muted">{t('habits')}</h4>
            <BulletList items={(c?.habits ?? []).slice().sort((a, b) => a.order - b.order)} />
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-fg-muted">{t('leverages')}</h4>
            <BulletList items={(c?.leverages ?? []).slice().sort((a, b) => a.order - b.order)} />
          </div>
        </div>
      );
    }

    case 'identity':
      return <IdentityView content={(section.content ?? {}) as IdentityContent} />;

    default:
      return null;
  }
}

function IdentityView({ content: c }: { content: IdentityContent }) {
  const { lang, t } = useLang();
  const he = lang === 'he';
  const states = c.states ?? [];
  const standards = (c.standards ?? []).slice().sort((a, b) => a.order - b.order);
  const shifts = c.beliefShifts ?? [];
  if (!c.statement && !states.length && !standards.length && !shifts.length) {
    return (
      <p className="text-sm text-fg-faint">
        {t('empty')}{' '}
        {he
          ? '— מי אני כשאני חי את החזון הזה? איך אני מרגיש, למה אני אומר כן ולא, ובאילו אמונות אני בוחר?'
          : '— who am I when I live this vision? How do I feel, what do I say yes and no to, which beliefs do I choose?'}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {c.statement && (
        <p dir="auto" className="border-s-[3px] border-primary ps-4 text-lg font-medium leading-relaxed">
          {c.statement}
        </p>
      )}
      {states.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-fg-muted">{he ? 'המצבים הפנימיים שלי' : 'My inner states'}</h4>
          <ul className="flex flex-wrap gap-2">
            {states.map((s) => (
              <li key={s.id} dir="auto" className="rounded-full bg-[color:var(--rz-accent-soft)] px-3 py-1 text-sm text-primary">
                {s.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {standards.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-fg-muted">{he ? 'סטנדרטים וגבולות' : 'Standards & boundaries'}</h4>
          <BulletList items={standards} />
        </div>
      )}
      {shifts.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-fg-muted">{he ? 'שינויי אמונה' : 'Belief shifts'}</h4>
          <ul className="flex flex-col gap-2">
            {shifts.map((b) => (
              <li key={b.id} className="flex flex-col gap-1 rounded-lg bg-surface p-3 text-sm sm:flex-row sm:items-center sm:gap-3">
                <span dir="auto" className="text-fg-muted line-through decoration-1">
                  {b.from}
                </span>
                <span className="text-fg-faint" aria-hidden>
                  {he ? '←' : '→'}
                </span>
                <span dir="auto" className="font-medium text-foreground">
                  {b.to}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
