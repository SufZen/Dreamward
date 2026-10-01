import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { X, Send, Square, Plus, Search, Sparkles, Settings as SettingsIcon } from 'lucide-react';
import { Button, ClarityAvatar, cn } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { useProviders } from '@/features/settings/useLlmProviders';
import { useAssistantStore } from './store';
import { usePageContext } from './usePageContext';
import { useAgentChat, type UiMessage } from './useAgentChat';
import { OnboardingMotion } from '@/components/OnboardingMotion';
import { ProposalCard } from './ProposalCard';

function ToolChip({ name }: { name: string }) {
  const { lang } = useLang();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-2xs text-fg-muted">
      <Search size={10} /> {name}
    </span>
  );
}

/** Hide fenced ```json {"proposals":…} blocks — they render as proposal cards. */
function stripProposalBlocks(text: string): string {
  return text
    .replace(/```(?:json)?\s*[\s\S]*?"proposals"[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function Message({ msg, onProposalResolved }: { msg: UiMessage; onProposalResolved: (id: string, s: never) => void }) {
  const isUser = msg.role === 'user';
  const rendered = isUser ? msg.content : stripProposalBlocks(msg.content);
  return (
    <div className={cn('flex flex-col', isUser ? 'items-start' : 'items-stretch')}>
      <div
        dir="auto"
        className={cn(
          'max-w-full rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser ? 'self-start bg-surface' : 'self-stretch bg-bg-elevated',
        )}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        ) : (
          <div className="dw-prose prose-sm">
            <ReactMarkdown>{rendered || (msg.streaming ? '…' : '')}</ReactMarkdown>
          </div>
        )}
        {msg.tools.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {msg.tools.map((t, i) => (
              <ToolChip key={i} name={t} />
            ))}
          </div>
        )}
      </div>
      {msg.proposals.map((p) => (
        <ProposalCard key={p.id} proposal={p} onResolved={(s) => onProposalResolved(p.id, s as never)} />
      ))}
    </div>
  );
}

function suggestionsFor(route: string, categoryId: string | undefined, lang: 'he' | 'en'): string[] {
  if (categoryId)
    return lang === 'he'
      ? ['מה אתה רואה בתחום הזה שאני אולי מפספס?', 'עזור לי לבחור צעד אחד קטן כאן']
      : ['What do you see here that I might be missing?', 'Help me pick one small step here'];
  if (route.startsWith('/ikigai'))
    return lang === 'he'
      ? ['מה אתה רואה בספר החיים שלי שאני אוהב באמת?', 'במה אני טוב לדעתך, לפי מה שכתבתי?', 'עזור לי לנסח את האיקיגאי שלי']
      : ['What do you see in my book that I truly love?', 'What am I good at, based on what I wrote?', 'Help me phrase my IKIGAI'];
  if (route.startsWith('/chapter'))
    return lang === 'he'
      ? ['על אילו תחומים כדאי לי להתמקד בפרק הזה?', 'מה כדאי לשים ברשימת "לא עכשיו"?']
      : ['Which areas should I focus on this chapter?', 'What belongs on my “not now” list?'];
  if (route.startsWith('/goals'))
    return lang === 'he'
      ? ['בוא נעבור על המטרות שלי יחד', 'איזו מטרה הכי תזיז אותי קדימה עכשיו?']
      : ["Let's go over my goals together", 'Which goal would move me most right now?'];
  return lang === 'he'
    ? ['במה כדאי לי להתמקד היום?', 'הזכר לי לאן אני בעצם הולך']
    : ['What should I focus on today?', 'Remind me where I’m really headed'];
}

function ChatSession({
  conversationId,
  onNewChat,
  onStreamingChange,
}: {
  conversationId: string | null;
  onNewChat: () => void;
  /** Lets the header avatar show Clarity thinking while a reply streams. */
  onStreamingChange: (streaming: boolean) => void;
}) {
  const { lang, t } = useLang();
  const pageContext = usePageContext();
  const { messages, streaming, send, stop, markProposal } = useAgentChat(conversationId);
  useEffect(() => onStreamingChange(streaming), [streaming, onStreamingChange]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const consumeAutoSend = useAssistantStore((s) => s.consumeAutoSend);
  const autoSentRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // fire a one-shot opener (e.g. the weekly-review kickoff) once per mount
  useEffect(() => {
    if (autoSentRef.current) return;
    const opener = consumeAutoSend();
    if (opener) {
      autoSentRef.current = true;
      void send(opener, pageContext);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (text: string) => {
    if (!text.trim() || streaming) return;
    setInput('');
    void send(text, pageContext);
  };

  const empty = messages.length === 0;

  return (
    <>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-fg-muted">
            <Sparkles size={32} className="text-primary" />
            <p className="text-sm">
              {lang === 'he'
                ? 'היי, כאן Clarity 👋 בוא נעשה סדר: מה באמת חשוב לך, לאן אתה הולך, ומה הצעד הבא בדרך.'
                : "Hi, I'm Clarity 👋 Let's make things clear: what you truly want, where you're heading, and the next step to get there."}
            </p>
            <div className="flex flex-col gap-2">
              {suggestionsFor(pageContext.route, pageContext.categoryId, lang).map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <Message key={m.id} msg={m} onProposalResolved={markProposal} />)
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <button
            onClick={onNewChat}
            title={lang === 'he' ? 'שיחה חדשה' : 'New chat'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface"
          >
            <Plus size={18} />
          </button>
          <textarea
            dir="auto"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            rows={1}
            placeholder={lang === 'he' ? 'כתיבה ל-Clarity…' : 'Message Clarity…'}
            className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          {streaming ? (
            <Button size="icon" variant="secondary" onClick={stop} title="עצור">
              <Square size={15} />
            </Button>
          ) : (
            <Button size="icon" onClick={() => submit(input)} disabled={!input.trim()}>
              <Send size={15} />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

export function AssistantPanel() {
  const { lang } = useLang();
  const { open, conversationId, focusMode, close, setConversationId } = useAssistantStore();
  const { data: providers } = useProviders();
  const [newCounter, setNewCounter] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const hasActiveProvider = providers?.some((p) => p.isActive);

  const sessionKey = conversationId ?? `new-${newCounter}`;

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[color:var(--rz-overlay)] sm:hidden" onClick={close} />
      <aside
        className={cn(
          'fixed inset-y-0 z-50 flex flex-col border-s border-border bg-bg-sunken shadow-rz-3',
          'inset-x-0 sm:inset-x-auto sm:end-0',
          focusMode ? 'sm:w-[560px]' : 'sm:w-[420px]',
        )}
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ClarityAvatar size={28} state={streaming ? 'thinking' : 'idle'} aria-hidden title="" />
          <span className="font-semibold">Clarity</span>
          <button onClick={close} className="ms-auto text-fg-muted hover:text-foreground">
            <X size={18} />
          </button>
        </header>

        {hasActiveProvider === false ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-fg-muted">
            <OnboardingMotion name="clarity" className="max-w-[280px]" />
            <p className="text-sm">
              {lang === 'he'
                ? 'עוד צעד אחד כדי לפגוש את Clarity — חבר מודל AI בהגדרות כדי להתחיל.'
                : 'Clarity is almost ready to meet you — connect an AI model in Settings to begin.'}
            </p>
            <Link to="/settings" onClick={close}>
              <Button size="sm">
                <SettingsIcon size={14} /> {lang === 'he' ? 'הגדרות AI' : 'AI settings'}
              </Button>
            </Link>
          </div>
        ) : (
          <ChatSession
            key={sessionKey}
            conversationId={conversationId}
            onStreamingChange={setStreaming}
            onNewChat={() => {
              setConversationId(null);
              setNewCounter((c) => c + 1);
            }}
          />
        )}
      </aside>
    </>
  );
}
