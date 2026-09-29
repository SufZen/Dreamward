/* ============================================================================
 * Settings → Agent access: personal API keys (create / list / revoke) and
 * the recent agent-activity audit feed. The raw token is shown exactly once,
 * in the reveal box right after creation.
 * ========================================================================= */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CalendarDays, Check, Copy, Plug, ShieldAlert, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Input, cn } from '@dreamward/design-system';
import { api } from '@/lib/api';
import { useLang } from '@/lib/lang';

interface ApiKeyPublic {
  id: number;
  name: string;
  scope: 'read' | 'write';
  tokenPrefix: string;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

interface ActivityRow {
  id: string;
  ts: number;
  keyName: string;
  method: string;
  path: string;
  action: string | null;
  summary: string | null;
  status: number;
}

const useApiKeys = () => useQuery({ queryKey: ['api-keys'], queryFn: () => api.get<ApiKeyPublic[]>('/api-keys') });
const useAgentActivity = () =>
  useQuery({ queryKey: ['agent-activity'], queryFn: () => api.get<ActivityRow[]>('/agent-activity?limit=50') });

export function ApiKeysSettings() {
  const { lang } = useLang();
  const he = lang === 'he';
  const qc = useQueryClient();
  const { data: keys } = useApiKeys();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read' | 'write'>('read');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  const create = useMutation({
    mutationFn: (vars: { name: string; scope: 'read' | 'write' }) =>
      api.post<{ token: string; key: ApiKeyPublic }>('/api-keys', vars),
    onSuccess: (res) => {
      setNewToken(res.token);
      setCopied(false);
      setName('');
      qc.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: number) => api.del(`/api-keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const copyToken = async () => {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
  };

  const activeKeys = (keys ?? []).filter((k) => !k.revokedAt);

  return (
    <Card className="p-6">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <Plug size={18} className="text-primary" /> {he ? 'גישת סוכני AI (מפתחות API)' : 'AI agent access (API keys)'}
      </h2>
      <p className="mb-4 text-sm text-fg-muted">
        {he
          ? 'מפתחות אישיים לחיבור סוכנים חיצוניים (Claude Code, Codex ועוד) דרך MCP, CLI או REST. כל פעולה של סוכן נרשמת ביומן הפעילות.'
          : 'Personal keys for connecting external agents (Claude Code, Codex, etc.) via MCP, CLI or REST. Every agent action is recorded in the activity log.'}
      </p>

      {/* one-time token reveal */}
      {newToken && (
        <div className="mb-4 rounded-md border border-warning bg-warning-soft p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <ShieldAlert size={14} />
            {he ? 'העתק עכשיו — המפתח לא יוצג שוב:' : 'Copy now — this key will not be shown again:'}
          </p>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="flex-1 select-all break-all rounded bg-surface px-2 py-1 font-mono text-xs">
              {newToken}
            </code>
            <Button size="sm" variant="secondary" onClick={copyToken}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? (he ? 'הועתק' : 'Copied') : he ? 'העתק' : 'Copy'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewToken(null)}>
              {he ? 'סגור' : 'Dismiss'}
            </Button>
          </div>
        </div>
      )}

      {/* create form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate({ name: name.trim(), scope });
        }}
        className="mb-5 flex flex-col gap-2 sm:flex-row"
      >
        <Input
          dir="auto"
          placeholder={he ? 'שם המפתח (למשל "Claude Code במחשב")' : 'Key name (e.g. "Claude Code on desktop")'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as 'read' | 'write')}
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none"
          aria-label="key scope"
        >
          <option value="read">{he ? 'קריאה בלבד' : 'Read-only'}</option>
          <option value="write">{he ? 'קריאה וכתיבה' : 'Read & write'}</option>
        </select>
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          {he ? 'צור מפתח' : 'Create key'}
        </Button>
      </form>

      {/* key list */}
      {activeKeys.length === 0 ? (
        <p className="text-sm text-fg-faint">{he ? 'אין מפתחות פעילים' : 'No active keys'}</p>
      ) : (
        <div className="flex flex-col">
          {activeKeys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p dir="auto" className="truncate text-sm font-medium">
                  {k.name}
                </p>
                <p className="text-xs text-fg-subtle">
                  <code dir="ltr" className="font-mono">{k.tokenPrefix}…</code>
                  {' · '}
                  {k.lastUsedAt
                    ? (he ? 'שימוש אחרון ' : 'Last used ') + new Date(k.lastUsedAt).toLocaleString()
                    : he
                      ? 'טרם נעשה שימוש'
                      : 'Never used'}
                </p>
              </div>
              <Badge variant={k.scope === 'write' ? 'warning' : 'neutral'}>
                {k.scope === 'write' ? (he ? 'קריאה וכתיבה' : 'Read & write') : he ? 'קריאה בלבד' : 'Read-only'}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => revoke.mutate(k.id)}
                aria-label="revoke key"
                title={he ? 'בטל מפתח' : 'Revoke'}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* calendar feed */}
      <CalendarFeedBlock />

      {/* agent activity */}
      <button
        onClick={() => setShowActivity((v) => !v)}
        className="mt-5 flex items-center gap-2 text-sm font-medium text-fg-muted hover:text-foreground"
      >
        <Bot size={15} />
        {he ? 'פעילות סוכנים אחרונה' : 'Recent agent activity'}
        <span className={cn('transition-transform', showActivity && 'rotate-90')}>‹</span>
      </button>
      {showActivity && <ActivityList />}
    </Card>
  );
}

function CalendarFeedBlock() {
  const { lang } = useLang();
  const he = lang === 'he';
  const qc = useQueryClient();
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createFeed = useMutation({
    mutationFn: () =>
      api.post<{ token: string }>('/api-keys', { name: he ? 'פיד יומן' : 'Calendar feed', scope: 'read' }),
    onSuccess: (res) => {
      setFeedUrl(`${window.location.origin}/api/feeds/calendar.ics?key=${res.token}`);
      setCopied(false);
      qc.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <CalendarDays size={15} /> {he ? 'פיד יומן (ICS)' : 'Calendar feed (ICS)'}
      </p>
      <p className="mb-2 text-xs text-fg-muted">
        {he
          ? 'הירשם לפיד ביומן Google/Apple/Outlook — פעולות עם תאריך יעד ומטרות עם תאריך מופיעות ביומן שלך.'
          : 'Subscribe in Google/Apple/Outlook Calendar — actions with due dates and dated goals show up in your calendar.'}
      </p>
      {feedUrl ? (
        <div className="flex items-center gap-2">
          <code dir="ltr" className="flex-1 select-all break-all rounded bg-surface px-2 py-1 font-mono text-xs">
            {feedUrl}
          </code>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(feedUrl);
              setCopied(true);
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => createFeed.mutate()} disabled={createFeed.isPending}>
          {he ? 'צור כתובת פיד' : 'Create feed URL'}
        </Button>
      )}
    </div>
  );
}

function ActivityList() {
  const { lang } = useLang();
  const he = lang === 'he';
  const { data: activity, isLoading } = useAgentActivity();

  if (isLoading) return <p className="mt-2 text-sm text-fg-faint">…</p>;
  if (!activity?.length)
    return <p className="mt-2 text-sm text-fg-faint">{he ? 'אין פעילות עדיין' : 'No activity yet'}</p>;

  return (
    <div className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto">
      {activity.map((a) => (
        <div key={a.id} className="flex items-center gap-2 rounded bg-surface px-2 py-1.5 text-xs">
          <span className="whitespace-nowrap text-fg-subtle">{new Date(a.ts).toLocaleString()}</span>
          <Badge variant={a.status < 400 ? 'success' : 'danger'}>{a.action ?? `${a.method} ${a.path}`}</Badge>
          <span className="truncate text-fg-muted" title={a.summary ?? undefined}>
            {a.summary}
          </span>
          <span className="ms-auto whitespace-nowrap text-fg-faint">{a.keyName}</span>
        </div>
      ))}
    </div>
  );
}
