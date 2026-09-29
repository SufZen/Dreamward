import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Plus, Trash2, Zap, CheckCircle2, XCircle, Loader2, Pencil, MessageSquareLock, ListFilter, ExternalLink, BarChart3 } from 'lucide-react';
import { PROVIDER_PRESETS, TOOLS_MODES, type LlmProviderPublic, type ProviderKind, type ProviderPreset, type ToolsMode } from '@dreamward/shared';
import { Badge, Button, Card, Input, cn } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { api, ApiError } from '@/lib/api';
import {
  useProviders,
  useCreateProvider,
  useUpdateProvider,
  useDeleteProvider,
  useActivateProvider,
  useTestProvider,
  type TestResult,
} from './useLlmProviders';

interface FormState {
  id?: string;
  kind?: ProviderKind;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  toolsMode: ToolsMode;
  contextLength: string;
}

const EMPTY: FormState = { name: '', baseUrl: '', apiKey: '', model: '', toolsMode: 'auto', contextLength: '' };

function ProviderForm({ initial, onClose }: { initial: FormState; onClose: () => void }) {
  const { lang } = useLang();
  const [form, setForm] = useState<FormState>(initial);
  const create = useCreateProvider();
  const update = useUpdateProvider();
  const busy = create.isPending || update.isPending;
  const isEdit = !!initial.id;
  const managed = initial.kind === 'openai-codex'; // endpoint + tokens come from the sign-in flow
  const [preset, setPreset] = useState<ProviderPreset | null>(null);
  const [models, setModels] = useState<{ id: string; contextLength: number | null }[] | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const applyPreset = (presetId: string) => {
    const p = PROVIDER_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    setPreset(p);
    setModels(null);
    setForm((f) => ({
      ...f,
      name: p.label,
      baseUrl: p.baseUrl || f.baseUrl,
      model: p.exampleModel,
    }));
  };

  const loadModels = async () => {
    setLoadingModels(true);
    setModelsError(null);
    try {
      const res =
        isEdit && !form.apiKey && form.baseUrl === initial.baseUrl
          ? await api.get<{ models: { id: string; contextLength: number | null }[] }>(`/llm/providers/${initial.id}/models`)
          : await api.post<{ models: { id: string; contextLength: number | null }[] }>('/llm/models', {
              baseUrl: form.baseUrl.trim(),
              apiKey: form.apiKey || null,
            });
      setModels(res.models);
      if (!res.models.length) setModelsError(lang === 'he' ? 'לא נמצאו מודלים' : 'No models returned');
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { message?: string } | undefined) : undefined;
      setModelsError(body?.message ?? (lang === 'he' ? 'לא ניתן לטעון מודלים' : 'Could not load models'));
    } finally {
      setLoadingModels(false);
    }
  };

  const pickModel = (id: string) => {
    const m = models?.find((x) => x.id === id);
    setForm((f) => ({ ...f, model: id, contextLength: m?.contextLength ? String(m.contextLength) : f.contextLength }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    const payload = {
      name: form.name.trim(),
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey, // '' = keep existing on edit; server treats '' as no-change
      model: form.model.trim(),
      toolsMode: form.toolsMode,
      contextLength: form.contextLength ? Number(form.contextLength) : null,
    };
    try {
      if (isEdit) {
        const { baseUrl, apiKey, ...rest } = payload;
        await update.mutateAsync({ id: initial.id!, ...(managed ? rest : { ...rest, baseUrl, apiKey }) } as never);
      } else await create.mutateAsync({ ...payload, apiKey: form.apiKey || null });
      onClose();
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { message?: string } | undefined) : undefined;
      setSaveError(body?.message ?? (lang === 'he' ? 'השמירה נכשלה' : 'Save failed'));
    }
  };

  return (
    <Card featured className="p-5">
      <form onSubmit={submit} className="flex flex-col gap-3">
        {!isEdit && (
          <div className="flex flex-col gap-2">
            {(['cloud', 'router', 'local', 'custom'] as const).map((group) => (
              <div key={group} className="flex flex-wrap items-center gap-2">
                <span className="w-20 text-2xs font-mono uppercase tracking-wider text-fg-faint">
                  {lang === 'he'
                    ? { cloud: 'ענן', router: 'נתב', local: 'מקומי', custom: 'אחר' }[group]
                    : { cloud: 'cloud', router: 'router', local: 'local', custom: 'other' }[group]}
                </span>
                {PROVIDER_PRESETS.filter((p) => p.group === group).map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant={preset?.id === p.id ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => applyPreset(p.id)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            ))}
            {preset && (preset.hintEn || preset.keyUrl) && (
              <p className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                {lang === 'he' ? preset.hintHe ?? preset.hintEn : preset.hintEn}
                {preset.keyUrl && (
                  <a href={preset.keyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                    {lang === 'he' ? 'קבלת מפתח API' : 'Get an API key'} <ExternalLink size={11} />
                  </a>
                )}
              </p>
            )}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder={lang === 'he' ? 'שם (למשל: OpenRouter חינמי)' : 'Name'}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          {!managed && (
            <Input
              dir="ltr"
              placeholder="Base URL — https://openrouter.ai/api/v1"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              required
            />
          )}
          <div className="flex gap-1.5">
            <Input
              dir="ltr"
              list="dw-model-options"
              placeholder={lang === 'he' ? 'מזהה מודל' : 'Model id'}
              value={form.model}
              onChange={(e) => pickModel(e.target.value)}
              required
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={loadModels}
              disabled={loadingModels || (!managed && !form.baseUrl)}
              title={lang === 'he' ? 'טעינת רשימת מודלים' : 'Load available models'}
            >
              {loadingModels ? <Loader2 size={14} className="animate-spin" /> : <ListFilter size={14} />}
            </Button>
            <datalist id="dw-model-options">
              {(models ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.contextLength ? `${Math.round(m.contextLength / 1000)}k ctx` : ''}
                </option>
              ))}
            </datalist>
          </div>
          {!managed && (
            <Input
              dir="ltr"
              type="password"
              placeholder={isEdit ? (lang === 'he' ? 'מפתח API (ריק = ללא שינוי)' : 'API key (blank = keep)') : lang === 'he' ? 'מפתח API (אופציונלי)' : 'API key (optional)'}
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
          )}
          <select
            value={form.toolsMode}
            onChange={(e) => setForm({ ...form, toolsMode: e.target.value as ToolsMode })}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            {TOOLS_MODES.map((m) => (
              <option key={m} value={m}>
                {lang === 'he'
                  ? m === 'auto'
                    ? 'כלים: זיהוי אוטומטי'
                    : m === 'on'
                      ? 'כלים: מופעל'
                      : 'כלים: כבוי'
                  : `tools: ${m}`}
              </option>
            ))}
          </select>
          <Input
            dir="ltr"
            type="number"
            placeholder={lang === 'he' ? 'אורך קונטקסט (אופציונלי, למשל 32000)' : 'Context length (optional)'}
            value={form.contextLength}
            onChange={(e) => setForm({ ...form, contextLength: e.target.value })}
          />
        </div>
        {models && models.length > 0 && (
          <p className="text-xs text-fg-muted">
            {lang === 'he' ? `${models.length} מודלים זמינים — התחילו להקליד בשדה המודל.` : `${models.length} models available — start typing in the model field.`}
          </p>
        )}
        {modelsError && <p className="text-xs text-danger">{modelsError}</p>}
        {saveError && <p className="text-sm text-danger">{saveError}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? '…' : isEdit ? (lang === 'he' ? 'שמור' : 'Save') : lang === 'he' ? 'הוסף ספק' : 'Add provider'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {lang === 'he' ? 'ביטול' : 'Cancel'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ProviderRow({ p, onEdit }: { p: LlmProviderPublic; onEdit: () => void }) {
  const { lang } = useLang();
  const activate = useActivateProvider();
  const del = useDeleteProvider();
  const test = useTestProvider();
  const [result, setResult] = useState<TestResult | null>(null);

  const runTest = async () => {
    setResult(null);
    const r = await test.mutateAsync(p.id);
    setResult(r);
  };

  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => activate.mutate(p.id)}
          className={cn(
            'h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
            p.isActive ? 'border-primary bg-primary' : 'border-fg-faint hover:border-primary',
          )}
          title={lang === 'he' ? 'הפעל ספק זה' : 'Activate'}
        />
        <span className="font-medium">{p.name}</span>
        <Badge variant="neutral" className="font-mono lowercase">
          {p.model}
        </Badge>
        {p.isActive && <Badge variant="accent">{lang === 'he' ? 'פעיל' : 'active'}</Badge>}
        {p.toolsDetected !== null && (
          <Badge variant={p.toolsDetected ? 'success' : 'warning'}>
            {p.toolsDetected ? 'tools ✓' : 'no tools'}
          </Badge>
        )}
        <span className="ms-auto flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={runTest} disabled={test.isPending}>
            {test.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            {lang === 'he' ? 'בדיקה' : 'Test'}
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (window.confirm(lang === 'he' ? `למחוק את "${p.name}"?` : `Delete "${p.name}"?`)) del.mutate(p.id);
            }}
          >
            <Trash2 size={14} />
          </Button>
        </span>
      </div>
      <p dir="ltr" className="truncate text-xs text-fg-subtle">
        {p.baseUrl} {p.hasKey && `· key: ${p.apiKeyMasked}`}
        {p.contextLength ? ` · ctx: ${p.contextLength.toLocaleString()}` : ''}
      </p>
      {result && (
        <p className={cn('flex items-center gap-1.5 text-xs', result.ok ? 'text-success' : 'text-danger')}>
          {result.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {result.ok
            ? `${lang === 'he' ? 'מחובר' : 'connected'} · ${result.latencyMs}ms${result.toolsDetected !== null ? ` · tools: ${result.toolsDetected ? '✓' : '✗'}` : ''}`
            : result.error}
        </p>
      )}
    </div>
  );
}

/**
 * Experimental "Sign in with ChatGPT" connector (Codex). Hidden unless the
 * server runs with CODEX_ENABLED=true. Paste-back flow: open the auth URL,
 * approve, then paste the localhost:1455 URL the browser lands on.
 */
function CodexConnect() {
  const { lang } = useLang();
  const he = lang === 'he';
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ['codex-status'],
    queryFn: () => api.get<{ enabled: boolean }>('/llm/codex/status'),
    staleTime: Infinity,
    retry: false,
  });
  const [flow, setFlow] = useState<{ flowId: string; authUrl: string } | null>(null);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: () => api.post<{ flowId: string; authUrl: string }>('/llm/codex/start'),
    onSuccess: (data) => {
      setFlow(data);
      setMessage(null);
      window.open(data.authUrl, '_blank', 'noopener');
    },
  });
  const complete = useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/llm/codex/complete', { flowId: flow!.flowId, callbackUrl }),
    onSuccess: () => {
      setFlow(null);
      setCallbackUrl('');
      setMessage(
        he
          ? 'חשבון ChatGPT חובר! הספק "ChatGPT (Codex)" נוסף עם המודל gpt-5.5 (אפשר לשנות ל-gpt-5.4 / gpt-5.4-mini / gpt-5.3-codex).'
          : 'ChatGPT connected! Provider "ChatGPT (Codex)" added with model gpt-5.5 (also valid: gpt-5.4, gpt-5.4-mini, gpt-5.3-codex).',
      );
      qc.invalidateQueries({ queryKey: ['llm-providers'] });
    },
    onError: () => setMessage(he ? 'החיבור נכשל — נסו שוב.' : 'Connection failed — start again and re-paste the URL.'),
  });

  if (!status.data?.enabled) return null;

  return (
    <div className="mt-5 rounded-md border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquareLock size={16} className="text-primary" />
        {he ? 'התחברות עם ChatGPT (ניסיוני)' : 'Sign in with ChatGPT (experimental)'}
      </div>
      <p className="mt-1 text-xs text-fg-muted">
        {he
          ? 'משתמש במנוי ChatGPT/Codex שלך. שימו לב: תכונה ניסיונית באזור אפור מבחינת תנאי השימוש של OpenAI ועלולה להישבר ללא התראה.'
          : 'Uses your ChatGPT/Codex subscription. Note: experimental, a gray area under OpenAI’s terms, and may break without notice.'}
      </p>
      {message && <p className="mt-2 text-xs text-success">{message}</p>}
      {!flow ? (
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => start.mutate()} disabled={start.isPending}>
          {start.isPending ? '…' : he ? 'התחבר עם ChatGPT' : 'Connect ChatGPT'}
        </Button>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-fg-muted" dir="ltr">
            1. Approve access in the tab that opened (
            <a className="text-primary underline" href={flow.authUrl} target="_blank" rel="noopener noreferrer">
              re-open
            </a>
            ). 2. Your browser will land on a <code>localhost:1455</code> page that fails to load — copy that full URL from
            the address bar. 3. Paste it here:
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="http://localhost:1455/auth/callback?code=…"
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              dir="ltr"
            />
            <Button size="sm" onClick={() => complete.mutate()} disabled={complete.isPending || !callbackUrl}>
              {complete.isPending ? '…' : he ? 'סיום' : 'Finish'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AiSettings() {
  const { lang } = useLang();
  const { data: providers, isLoading } = useProviders();
  const [editing, setEditing] = useState<FormState | null>(null);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Bot size={18} className="text-primary" /> {lang === 'he' ? 'מודלים של AI' : 'AI models'}
        </h2>
        {!editing && (
          <Button size="sm" onClick={() => setEditing(EMPTY)}>
            <Plus size={14} /> {lang === 'he' ? 'הוסף ספק' : 'Add provider'}
          </Button>
        )}
      </div>

      <p className="mb-4 text-sm text-fg-muted">
        {lang === 'he'
          ? 'חברו את ה-AI שלכם: מפתח API של OpenAI, Anthropic, Google, OpenRouter ועוד — או מודל מקומי (Ollama, LM Studio). השרת לא משלם על AI; השימוש נרשם אצל הספק שלכם. יש לכם מנוי Claude/ChatGPT/Gemini? חברו את הסוכן שלכם דרך MCP (הגדרות ← גישת סוכני AI).'
          : 'Bring your own AI: an API key from OpenAI, Anthropic, Google, OpenRouter and more — or a local model (Ollama, LM Studio). The server never pays for AI; usage is billed by your provider. Have a Claude/ChatGPT/Gemini subscription? Connect your own agent over MCP (Settings → AI agent access).'}
      </p>

      {editing && <ProviderForm initial={editing} onClose={() => setEditing(null)} />}

      <div className="mt-2">
        {isLoading ? (
          <p className="py-3 text-sm text-fg-muted">…</p>
        ) : providers?.length ? (
          providers.map((p) => (
            <ProviderRow
              key={p.id}
              p={p}
              onEdit={() =>
                setEditing({
                  id: p.id,
                  kind: p.kind,
                  name: p.name,
                  baseUrl: p.baseUrl,
                  apiKey: '',
                  model: p.model,
                  toolsMode: p.toolsMode,
                  contextLength: p.contextLength?.toString() ?? '',
                })
              }
            />
          ))
        ) : (
          !editing && (
            <p className="py-3 text-sm text-fg-faint">
              {lang === 'he' ? 'אין ספקים עדיין — הוסף אחד כדי להפעיל את העוזר.' : 'No providers yet.'}
            </p>
          )
        )}
      </div>

      <CodexConnect />
      <AiUsage />
    </Card>
  );
}

/** The signed-in user's own AI usage — their provider, their bill. */
export function AiUsage() {
  const { lang } = useLang();
  const he = lang === 'he';
  const q = useQuery({
    queryKey: ['llm-usage'],
    queryFn: () =>
      api.get<{
        days: number;
        daily: { day: string; promptTokens: number; completionTokens: number }[];
        byModel: { model: string; provider: string; promptTokens: number; completionTokens: number; calls: number }[];
      }>('/llm/usage?days=30'),
  });
  if (!q.data || q.data.byModel.length === 0) return null;
  const total = q.data.byModel.reduce((n, m) => n + m.promptTokens + m.completionTokens, 0);
  const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  return (
    <div className="mt-5 rounded-md border border-border p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <BarChart3 size={15} className="text-primary" /> {he ? 'השימוש שלי ב-AI (30 יום)' : 'My AI usage (30 days)'}
        <span className="ms-auto font-mono text-xs text-fg-muted">{fmt(total)} tokens</span>
      </div>
      <ul className="flex flex-col gap-1 text-xs">
        {q.data.byModel.map((m) => (
          <li key={m.provider + m.model} className="flex justify-between gap-3">
            <span dir="ltr" className="truncate font-mono">
              {m.model} <span className="text-fg-faint">· {m.provider}</span>
            </span>
            <span className="whitespace-nowrap text-fg-muted">
              {m.calls} {he ? 'קריאות' : 'calls'} · {fmt(m.promptTokens)} in / {fmt(m.completionTokens)} out
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-2xs text-fg-faint">
        {he ? 'העלות בפועל נקבעת אצל ספק ה-AI שלכם.' : 'Actual cost is set by your AI provider.'}
      </p>
    </div>
  );
}
