/* ============================================================================
 * dreamward — `dreamward` command
 * Thin formatting layer over @dreamward/client (the /api/v1 agent surface).
 * Human-readable tables by default; --json everywhere for scripting.
 * ========================================================================= */
import pkg from '../package.json' with { type: 'json' };
import { Command } from 'commander';
import { DreamwardClient, DreamwardApiError } from '@dreamward/client';
import { loadConfig, requireConfig, saveConfig } from './config';
import { runSetup } from './setup';

interface GoalRow {
  id: string;
  title: string;
  status: string;
  categoryId: string | null;
  targetDate: number | null;
}
interface ActionRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: number | null;
  goalId: string | null;
}
interface JournalRow {
  id: string;
  title: string | null;
  entryDate: number;
}

const program = new Command('dreamward');
program.description('Dreamward from the terminal — goals, actions, journal, chapter, wheel, IKIGAI, search, and AI-agent setup').version(pkg.version);
program.option('--json', 'raw JSON output');

const client = () => new DreamwardClient({ baseUrl: requireConfig().url, apiKey: requireConfig().apiKey });
const asJson = () => program.opts<{ json?: boolean }>().json === true;

const date = (ms: number | null) => (ms ? new Date(ms).toISOString().slice(0, 10) : '');
const isoToMs = (iso?: string) => (iso ? Date.parse(iso) || null : null);
const short = (id: string) => id.slice(0, 8);

function out(rows: unknown, human: () => void): void {
  if (asJson()) console.log(JSON.stringify(rows, null, 2));
  else human();
}

function fail(err: unknown): never {
  if (err instanceof DreamwardApiError) {
    if (err.status === 401) console.error('Unauthorized — key invalid or revoked. Run `dreamward login` again.');
    else if (err.status === 403) console.error('Forbidden — this key is read-only; writes need a read & write key.');
    else console.error(err.message);
  } else {
    console.error(err instanceof Error ? err.message : String(err));
  }
  process.exit(1);
}

/* ── login / whoami ──────────────────────────────────────────────────────── */

program
  .command('login')
  .description('save server URL + API key to ~/.dreamward/config.json')
  .requiredOption('--url <url>', 'Dreamward server, e.g. https://dreamward.example.com — or "desktop" for the desktop app')
  .requiredOption('--key <key>', 'personal API key (lbk_…) from Settings → AI agent access')
  .action(async (opts: { url: string; key: string }) => {
    const c = new DreamwardClient({ baseUrl: opts.url, apiKey: opts.key });
    try {
      await c.get('/goals/summary'); // validates URL + key + scope=read at minimum
    } catch (err) {
      fail(err);
    }
    const file = saveConfig({ url: opts.url, apiKey: opts.key });
    console.log(`Connected ✓  config saved to ${file}`);
  });

program
  .command('whoami')
  .description('check connection and show the configured server')
  .action(async () => {
    const cfg = loadConfig();
    if (!cfg) {
      console.error('Not configured. Run: dreamward login --url <server> --key <lbk_…>');
      process.exit(1);
    }
    try {
      const summary = await client().get<{ total: number }>('/goals/summary');
      console.log(`Server: ${cfg.url}`);
      console.log(`Key:    ${cfg.apiKey.slice(0, 12)}…  (working ✓)`);
      console.log(`Goals:  ${summary.total}`);
    } catch (err) {
      fail(err);
    }
  });

/* ── goals ───────────────────────────────────────────────────────────────── */

const goals = program.command('goals').description('list and add goals');

goals
  .command('list')
  .option('--status <status>', 'achieved | partial | not_achieved | not_relevant')
  .action(async (opts: { status?: string }) => {
    try {
      const qs = opts.status ? `?status=${opts.status}` : '';
      const rows = await client().get<GoalRow[]>(`/goals${qs}`);
      out(rows, () => {
        if (!rows.length) return console.log('(no goals)');
        for (const g of rows) {
          const due = g.targetDate ? `  due ${date(g.targetDate)}` : '';
          console.log(`${short(g.id)}  [${g.status}]${due}  ${g.title}`);
        }
      });
    } catch (err) {
      fail(err);
    }
  });

goals
  .command('add <title>')
  .option('--category <id>', 'category id, e.g. health_fitness')
  .option('--due <date>', 'target date YYYY-MM-DD')
  .option('--description <text>')
  .action(async (title: string, opts: { category?: string; due?: string; description?: string }) => {
    try {
      const row = await client().post<GoalRow>('/goals', {
        title,
        categoryId: opts.category ?? null,
        description: opts.description ?? null,
        targetDate: isoToMs(opts.due),
      });
      out(row, () => console.log(`created goal ${short(row.id)}  ${row.title}`));
    } catch (err) {
      fail(err);
    }
  });

/* ── actions ─────────────────────────────────────────────────────────────── */

const actions = program.command('actions').description('list, add and complete actions');

actions
  .command('list')
  .option('--status <status>', 'todo | done', 'todo')
  .option('--priority <p>', 'low | medium | high')
  .option('--goal <goalId>')
  .option('--all', 'include done actions')
  .action(async (opts: { status: string; priority?: string; goal?: string; all?: boolean }) => {
    try {
      const qs = new URLSearchParams();
      if (!opts.all) qs.set('status', opts.status);
      if (opts.priority) qs.set('priority', opts.priority);
      if (opts.goal) qs.set('goal_id', opts.goal);
      const rows = await client().get<ActionRow[]>(`/actions${qs.size ? `?${qs}` : ''}`);
      out(rows, () => {
        if (!rows.length) return console.log('(no actions)');
        for (const a of rows) {
          const mark = a.status === 'done' ? 'x' : ' ';
          const due = a.dueDate ? `  due ${date(a.dueDate)}` : '';
          console.log(`[${mark}] ${short(a.id)}  (${a.priority})${due}  ${a.title}`);
        }
      });
    } catch (err) {
      fail(err);
    }
  });

actions
  .command('add <title>')
  .option('--goal <goalId>', 'link to a goal')
  .option('--due <date>', 'due date YYYY-MM-DD')
  .option('--priority <p>', 'low | medium | high', 'medium')
  .option('--description <text>')
  .action(async (title: string, opts: { goal?: string; due?: string; priority: string; description?: string }) => {
    try {
      const row = await client().post<ActionRow>('/actions', {
        title,
        goalId: opts.goal ?? null,
        dueDate: isoToMs(opts.due),
        priority: opts.priority,
        description: opts.description ?? null,
      });
      out(row, () => console.log(`created action ${short(row.id)}  (${row.priority})  ${row.title}`));
    } catch (err) {
      fail(err);
    }
  });

actions
  .command('done <actionId>')
  .description('mark an action as done (accepts full or 8-char id)')
  .action(async (actionId: string) => {
    try {
      let id = actionId;
      if (id.length === 8) {
        const rows = await client().get<ActionRow[]>('/actions');
        const match = rows.find((a) => a.id.startsWith(id));
        if (!match) return fail(new Error(`no action starting with ${id}`));
        id = match.id;
      }
      const row = await client().patch<ActionRow>(`/actions/${id}`, { status: 'done' });
      out(row, () => console.log(`done ✓  ${row.title}`));
    } catch (err) {
      fail(err);
    }
  });

/* ── journal ─────────────────────────────────────────────────────────────── */

const journal = program.command('journal').description('list and write journal entries');

journal.command('list').action(async () => {
  try {
    const rows = await client().get<JournalRow[]>('/journal');
    out(rows, () => {
      if (!rows.length) return console.log('(no entries)');
      for (const e of rows.slice(0, 20)) console.log(`${date(e.entryDate)}  ${short(e.id)}  ${e.title ?? '(untitled)'}`);
    });
  } catch (err) {
    fail(err);
  }
});

journal
  .command('add [markdown]')
  .description('write an entry from markdown (argument or stdin)')
  .option('--title <title>')
  .action(async (markdown: string | undefined, opts: { title?: string }) => {
    try {
      let body = markdown;
      if (!body) {
        // read stdin (echo "..." | dreamward journal add)
        body = await new Promise<string>((resolve) => {
          let data = '';
          process.stdin.on('data', (c) => (data += c));
          process.stdin.on('end', () => resolve(data));
        });
      }
      if (!body?.trim()) return fail(new Error('empty entry — pass markdown as an argument or via stdin'));
      const res = await client().post<{ id: string }>('/journal/markdown', {
        title: opts.title ?? null,
        bodyMarkdown: body.trim(),
      });
      out(res, () => console.log(`created entry ${short(res.id)}`));
    } catch (err) {
      fail(err);
    }
  });

/* ── meaning & focus: chapter, wheel, ikigai ─────────────────────────────── */

program
  .command('chapter')
  .description('show the Current Life Chapter')
  .action(async () => {
    try {
      const res = await client().get<{
        chapter: {
          title: string;
          intention: string | null;
          focusCategoryIds: string[];
          maintenanceCategoryIds: string[];
          notNow: { text: string }[];
          reviewDate: number | null;
        } | null;
      }>('/chapters/current');
      out(res, () => {
        const ch = res.chapter;
        if (!ch) return console.log('(no active chapter)');
        console.log(ch.title);
        if (ch.intention) console.log(`  intention:   ${ch.intention}`);
        console.log(`  focus:       ${ch.focusCategoryIds.join(', ') || '-'}`);
        console.log(`  maintenance: ${ch.maintenanceCategoryIds.join(', ') || '-'}`);
        if (ch.notNow.length) console.log(`  not now:     ${ch.notNow.map((n) => n.text).join('; ')}`);
        if (ch.reviewDate) console.log(`  review on:   ${date(ch.reviewDate)}`);
      });
    } catch (err) {
      fail(err);
    }
  });

program
  .command('wheel')
  .description('show the life wheel (latest 1-10 rating per category)')
  .action(async () => {
    try {
      const rows = await client().get<
        { categoryId: string; latest: { score: number; gap: string | null } | null; delta: number | null }[]
      >('/ratings/latest');
      out(rows, () => {
        for (const r of rows) {
          const score = r.latest ? `${String(r.latest.score).padStart(2)}/10 ${'█'.repeat(r.latest.score)}` : '  -';
          const delta = r.delta ? ` (${r.delta > 0 ? '+' : ''}${r.delta})` : '';
          console.log(`${r.categoryId.padEnd(16)} ${score}${delta}${r.latest?.gap ? `  gap: ${r.latest.gap}` : ''}`);
        }
      });
    } catch (err) {
      fail(err);
    }
  });

program
  .command('ikigai')
  .description('show your current IKIGAI')
  .action(async () => {
    try {
      const res = await client().get<{
        current: { statement: string | null; items: { text: string; circles: string[] }[]; everyday: { text: string }[] } | null;
        draft: unknown;
      }>('/ikigai');
      out(res, () => {
        const cur = res.current;
        if (!cur) return console.log(res.draft ? '(IKIGAI in progress — not completed yet)' : '(no IKIGAI yet)');
        console.log(cur.statement ?? '');
        for (const circle of ['love', 'good', 'needs', 'paid']) {
          const items = cur.items.filter((i) => i.circles.includes(circle)).map((i) => i.text);
          if (items.length) console.log(`  ${circle.padEnd(6)} ${items.join('; ')}`);
        }
        if (cur.everyday.length) console.log(`  joys   ${cur.everyday.map((e) => e.text).join('; ')}`);
      });
    } catch (err) {
      fail(err);
    }
  });

/* ── agents: MCP server + one-command setup ─────────────────────────────── */

program
  .command('mcp')
  .description('run the Dreamward MCP server on stdio (for AI agents; uses your login or DREAMWARD_URL/DREAMWARD_API_KEY)')
  .action(async () => {
    const cfg = requireConfig();
    const { startStdio } = await import('@dreamward/mcp');
    await startStdio({ baseUrl: cfg.url, apiKey: cfg.apiKey });
  });

program
  .command('setup [agent]')
  .description('connect an AI agent: claude-code | claude-desktop | cursor | windsurf | vscode | gemini | codex | opencode | other')
  .option('--write', 'apply the change (default: dry run that only shows it)')
  .option('--yes', 'do not ask for confirmation')
  .option('--npx', 'launch via "npx -y dreamward mcp" instead of this installed CLI')
  .action(async (agent: string | undefined, opts: { write?: boolean; yes?: boolean; npx?: boolean }) => {
    const cfg = agent ? requireConfig() : { url: '', apiKey: '' };
    try {
      await runSetup(agent, { url: cfg.url, apiKey: cfg.apiKey, write: !!opts.write, yes: !!opts.yes, npx: !!opts.npx });
    } catch (err) {
      fail(err);
    }
  });

/* ── search ──────────────────────────────────────────────────────────────── */

program
  .command('search <query>')
  .description('full-text search across the whole dreamward')
  .action(async (query: string) => {
    try {
      const res = await client().get<{ hits: { docType: string; docId: string; title: string; snippet: string }[] }>(
        `/search?q=${encodeURIComponent(query)}`,
      );
      out(res.hits, () => {
        if (!res.hits.length) return console.log('(no results)');
        for (const h of res.hits) console.log(`[${h.docType}:${short(h.docId)}]  ${h.title}\n    ${h.snippet}`);
      });
    } catch (err) {
      fail(err);
    }
  });

program.parseAsync().catch(fail);
