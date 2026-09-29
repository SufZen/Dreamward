/* ============================================================================
 * @dreamward/shared — agent.ts
 * The api↔web contract for the AI fulfillment engine:
 * provider config, proposal types + payload schemas, SSE event types.
 * ========================================================================= */
import { z } from 'zod';
import { ACTION_LINK_TYPES, ACTION_PRIORITIES, GOAL_STATUSES } from './constants';

/* ── LLM providers ───────────────────────────────────────────────────────── */

export const TOOLS_MODES = ['auto', 'on', 'off'] as const;
export type ToolsMode = (typeof TOOLS_MODES)[number];

export const PROVIDER_KINDS = ['openai-compat', 'openai-codex'] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export interface ProviderPreset {
  id: string;
  label: string;
  group: 'cloud' | 'local' | 'router' | 'custom';
  baseUrl: string;
  needsKey: boolean;
  exampleModel: string;
  /** where to create an API key */
  keyUrl?: string;
  /** short hints shown under the form */
  hintEn?: string;
  hintHe?: string;
}

/**
 * Quick-fill presets for the "add provider" form. All speak the
 * OpenAI-compatible Chat Completions API — every user brings their own key
 * (or local model server); the server operator never pays for AI.
 */
export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    group: 'cloud',
    baseUrl: 'https://api.openai.com/v1',
    needsKey: true,
    exampleModel: 'gpt-5.4-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    group: 'cloud',
    baseUrl: 'https://api.anthropic.com/v1',
    needsKey: true,
    exampleModel: 'claude-sonnet-5-5',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    hintEn: "Uses Anthropic's OpenAI-compatible endpoint.",
    hintHe: 'משתמש בנקודת הקצה התואמת-OpenAI של Anthropic.',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    group: 'cloud',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    needsKey: true,
    exampleModel: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
    hintEn: 'Free tier available in Google AI Studio.',
    hintHe: 'יש שכבה חינמית ב-Google AI Studio.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    group: 'router',
    baseUrl: 'https://openrouter.ai/api/v1',
    needsKey: true,
    exampleModel: 'meta-llama/llama-3.3-70b-instruct:free',
    keyUrl: 'https://openrouter.ai/keys',
    hintEn: 'One key, hundreds of models — including free ones.',
    hintHe: 'מפתח אחד, מאות מודלים — כולל חינמיים.',
  },
  { id: 'groq', label: 'Groq', group: 'cloud', baseUrl: 'https://api.groq.com/openai/v1', needsKey: true, exampleModel: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys' },
  { id: 'mistral', label: 'Mistral', group: 'cloud', baseUrl: 'https://api.mistral.ai/v1', needsKey: true, exampleModel: 'mistral-large-latest', keyUrl: 'https://console.mistral.ai/api-keys' },
  { id: 'deepseek', label: 'DeepSeek', group: 'cloud', baseUrl: 'https://api.deepseek.com/v1', needsKey: true, exampleModel: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'together', label: 'Together AI', group: 'cloud', baseUrl: 'https://api.together.xyz/v1', needsKey: true, exampleModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', keyUrl: 'https://api.together.ai/settings/api-keys' },
  {
    id: 'ollama',
    label: 'Ollama',
    group: 'local',
    baseUrl: 'http://localhost:11434/v1',
    needsKey: false,
    exampleModel: 'llama3.2',
    hintEn: 'Server in Docker? Use http://host.docker.internal:11434/v1',
    hintHe: 'השרת רץ ב-Docker? השתמשו ב-http://host.docker.internal:11434/v1',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    group: 'local',
    baseUrl: 'http://localhost:1234/v1',
    needsKey: false,
    exampleModel: '',
    hintEn: 'Start the local server in LM Studio (Developer tab).',
    hintHe: 'הפעילו את השרת המקומי ב-LM Studio (לשונית Developer).',
  },
  { id: 'lemonade', label: 'Lemonade Server', group: 'local', baseUrl: 'http://localhost:8000/api/v1', needsKey: false, exampleModel: 'Llama-3.2-3B-Instruct-Hybrid' },
  {
    id: 'litellm',
    label: 'LiteLLM proxy',
    group: 'router',
    baseUrl: 'http://localhost:4001/v1',
    needsKey: true,
    exampleModel: '',
    hintEn: 'Your own LiteLLM gateway — route to any provider.',
    hintHe: 'שער LiteLLM משלכם — ניתוב לכל ספק.',
  },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', group: 'custom', baseUrl: '', needsKey: false, exampleModel: '' },
];

export const createProviderSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().nullable().optional(),
  model: z.string().min(1),
  toolsMode: z.enum(TOOLS_MODES).default('auto'),
  contextLength: z.number().int().positive().nullable().optional(),
});
export const updateProviderSchema = createProviderSchema.partial();

export interface LlmProviderPublic {
  id: string;
  kind: ProviderKind;
  name: string;
  baseUrl: string;
  /** masked, e.g. "sk-…ab12" — the real key never leaves the server */
  apiKeyMasked: string | null;
  hasKey: boolean;
  model: string;
  toolsMode: ToolsMode;
  toolsDetected: boolean | null;
  contextLength: number | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

/* ── Proposals (the write gate) ──────────────────────────────────────────── */

export const PROPOSAL_TYPES = [
  'create_goal',
  'update_goal_status',
  'create_action',
  'update_action',
  'complete_action',
  'delete_action',
  'create_journal_entry',
  'update_section_content',
  'update_life_vision_answer',
  'update_content_block',
  'save_memory',
  'complete_weekly_review',
] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];

const listItemsSchema = z.array(z.object({ text: z.string().min(1) }));

/** Per-type payload schemas — validated server-side at propose-time AND execute-time. */
export const proposalPayloadSchemas = {
  create_goal: z.object({
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    targetDate: z.string().nullable().optional(), // ISO date 'YYYY-MM-DD'
  }),
  update_goal_status: z.object({
    goalId: z.string().min(1),
    status: z.enum(GOAL_STATUSES),
    note: z.string().optional(),
  }),
  create_action: z.object({
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    goalId: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(), // ISO date
    priority: z.enum(ACTION_PRIORITIES).optional(),
    linkedType: z.enum(ACTION_LINK_TYPES).nullable().optional(),
    linkedId: z.string().nullable().optional(),
  }),
  update_action: z.object({
    actionId: z.string().min(1),
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(), // ISO date
    priority: z.enum(ACTION_PRIORITIES).optional(),
    status: z.enum(['todo', 'done']).optional(),
  }),
  complete_action: z.object({
    actionId: z.string().min(1),
  }),
  delete_action: z.object({
    actionId: z.string().min(1),
  }),
  create_journal_entry: z.object({
    title: z.string().nullable().optional(),
    bodyMarkdown: z.string().min(1),
  }),
  update_section_content: z.object({
    sectionId: z.string().min(1),
    /** full replacement — weak models cannot produce reliable diffs */
    items: listItemsSchema.optional(),
    habits: listItemsSchema.optional(),
    leverages: listItemsSchema.optional(),
    bodyMarkdown: z.string().optional(),
    quote: z.string().optional(),
    quoteAuthor: z.string().optional(),
    /** identity sections */
    statement: z.string().optional(),
    states: listItemsSchema.optional(),
    standards: listItemsSchema.optional(),
    beliefShifts: z.array(z.object({ from: z.string().min(1), to: z.string().min(1) })).optional(),
  }),
  update_life_vision_answer: z.object({
    promptId: z.string().min(1),
    answerMarkdown: z.string().min(1),
  }),
  update_content_block: z.object({
    blockId: z.string().min(1),
    items: listItemsSchema.optional(),
    bodyMarkdown: z.string().optional(),
  }),
  save_memory: z.object({
    key: z.string().nullable().optional(),
    content: z.string().min(1),
  }),
  complete_weekly_review: z.object({
    summary: z.string().min(1),
    priorities: z.array(z.string()).default([]),
  }),
} satisfies Record<ProposalType, z.ZodTypeAny>;

export const proposalEnvelopeSchema = z.object({
  type: z.enum(PROPOSAL_TYPES),
  summary: z.string().min(1),
  payload: z.record(z.unknown()),
});
export type ProposalEnvelope = z.infer<typeof proposalEnvelopeSchema>;

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'failed';

export interface ProposalRow {
  id: string;
  conversationId: string | null;
  type: ProposalType;
  payload: unknown;
  summary: string;
  status: ProposalStatus;
  error: string | null;
  resultRef: string | null;
  createdAt: number;
  resolvedAt: number | null;
}

/* ── Actions ─────────────────────────────────────────────────────────────── */

export const ACTION_STATUSES = ['todo', 'done'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

/* ── Chat SSE events (server → web) ──────────────────────────────────────── */

export type AgentSseEvent =
  | { type: 'meta'; conversationId: string; mode: 'tools' | 'fallback'; model: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_start'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; summary: string }
  | { type: 'proposal'; proposal: ProposalRow }
  | { type: 'error'; message: string }
  | { type: 'done' };

/* ── Page context (web → server) ─────────────────────────────────────────── */

export const pageContextSchema = z.object({
  route: z.string(),
  categoryId: z.string().optional(),
});
export type PageContext = z.infer<typeof pageContextSchema>;
