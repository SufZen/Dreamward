import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Badge } from '@dreamward/design-system';
import { api } from '@/lib/api';
import { useLang } from '@/lib/lang';
import { UsageChart } from './UsageChart';

interface UsageResponse {
  days: number;
  daily: { day: string; userId: number; promptTokens: number; completionTokens: number }[];
  byModel: { model: string; promptTokens: number; completionTokens: number; estimated: boolean }[];
}
interface SystemInfo {
  version: string;
  nodeVersion: string;
  uptimeSeconds: number;
  controlDbBytes: number;
  userDataBytes: number;
  lastBackupAt: number | null;
}

interface AdminUser {
  id: number;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  createdAt: number;
  lastLoginAt: number | null;
  storageBytes: number;
  promptTokens: number;
  completionTokens: number;
}

interface Invite {
  id: number;
  token: string;
  note: string | null;
  createdAt: number;
  expiresAt: number;
  usedAt: number | null;
  usedBy: number | null;
}

interface AuditEvent {
  id: number;
  ts: number;
  userId: number | null;
  event: string;
  detail: string | null;
  ip: string | null;
}

const AUDIT_EVENTS = [
  'login.success',
  'login.failed',
  'password.changed',
  'invite.created',
  'invite.accepted',
  'invite.revoked',
  'user.disabled',
  'user.enabled',
  'user.deleted',
  'user.password_reset',
];

const fmtBytes = (n: number) => (n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const fmtDate = (ts: number | null) => (ts ? new Date(ts).toLocaleString() : '—');
const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function AdminPage() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin'] });
  };

  const usersQ = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<{ maxUsers: number; users: AdminUser[] }>('/admin/users'),
  });
  const invitesQ = useQuery({
    queryKey: ['admin', 'invites'],
    queryFn: () => api.get<{ invites: Invite[]; publicOrigin: string }>('/admin/invites'),
  });
  const { lang } = useLang();
  const he = lang === 'he';
  const [usageUser, setUsageUser] = useState<string>('');
  const [auditFilter, setAuditFilter] = useState<string>('');

  const auditQ = useQuery({
    queryKey: ['admin', 'audit', auditFilter],
    queryFn: () => api.get<{ events: AuditEvent[] }>(`/admin/audit?limit=50${auditFilter ? `&event=${encodeURIComponent(auditFilter)}` : ''}`),
  });
  const usageQ = useQuery({
    queryKey: ['admin', 'usage', usageUser],
    queryFn: () => api.get<UsageResponse>(`/admin/usage?days=30${usageUser ? `&userId=${usageUser}` : ''}`),
  });
  const systemQ = useQuery({
    queryKey: ['admin', 'system'],
    queryFn: () => api.get<SystemInfo>('/admin/system'),
  });

  const [note, setNote] = useState('');
  const [copied, setCopied] = useState<number | null>(null);

  const createInvite = useMutation({
    mutationFn: () => api.post<{ invite: Invite; url: string }>('/admin/invites', { note: note || undefined }),
    onSuccess: () => {
      setNote('');
      invalidate();
    },
  });
  const revokeInvite = useMutation({
    mutationFn: (id: number) => api.del(`/admin/invites/${id}`),
    onSuccess: invalidate,
  });
  const toggleUser = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'disable' | 'enable' }) => api.post(`/admin/users/${id}/${action}`),
    onSuccess: invalidate,
  });
  const deleteUser = useMutation({
    mutationFn: (id: number) => api.del(`/admin/users/${id}`),
    onSuccess: invalidate,
  });
  const resetPassword = useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
      api.post(`/admin/users/${id}/reset-password`, { newPassword }),
  });

  const inviteUrl = (token: string) => `${invitesQ.data?.publicOrigin ?? window.location.origin}/invite/${token}`;

  const copyLink = async (invite: Invite) => {
    await navigator.clipboard.writeText(inviteUrl(invite.token));
    setCopied(invite.id);
    setTimeout(() => setCopied(null), 1500);
  };

  const onResetPassword = (u: AdminUser) => {
    const pw = window.prompt(`New password for ${u.email} (min 8 chars):`);
    if (pw && pw.length >= 8) resetPassword.mutate({ id: u.id, newPassword: pw });
    else if (pw) window.alert('Password must be at least 8 characters.');
  };

  const onDeleteUser = (u: AdminUser) => {
    if (window.confirm(`Delete ${u.email} AND all of their data? This cannot be undone.`)) deleteUser.mutate(u.id);
  };

  const users = usersQ.data?.users ?? [];
  const openInvites = (invitesQ.data?.invites ?? []).filter((i) => !i.usedAt && i.expiresAt > Date.now());
  const seats = usersQ.data ? `${users.length} / ${usersQ.data.maxUsers}` : '…';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6" dir="ltr">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-fg-muted">Accounts, invites and usage. Seats used: {seats}</p>
      </div>

      {/* ── Users ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs uppercase tracking-wider text-fg-faint">
                  <th className="px-2 py-2 text-start">Email</th>
                  <th className="px-2 py-2 text-start">Role</th>
                  <th className="px-2 py-2 text-start">Status</th>
                  <th className="px-2 py-2 text-start">Last login</th>
                  <th className="px-2 py-2 text-end">Storage</th>
                  <th className="px-2 py-2 text-end">AI tokens (in/out)</th>
                  <th className="px-2 py-2 text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50">
                    <td className="px-2 py-2 font-medium">{u.email}</td>
                    <td className="px-2 py-2">
                      <Badge variant={u.role === 'admin' ? 'accent' : 'neutral'}>{u.role}</Badge>
                    </td>
                    <td className="px-2 py-2">
                      <Badge variant={u.status === 'active' ? 'success' : 'danger'}>{u.status}</Badge>
                    </td>
                    <td className="px-2 py-2 text-fg-muted">{fmtDate(u.lastLoginAt)}</td>
                    <td className="px-2 py-2 text-end text-fg-muted">{fmtBytes(u.storageBytes)}</td>
                    <td className="px-2 py-2 text-end text-fg-muted">
                      {fmtTokens(u.promptTokens)} / {fmtTokens(u.completionTokens)}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-1.5">
                        {u.role !== 'admin' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleUser.mutate({ id: u.id, action: u.status === 'active' ? 'disable' : 'enable' })}
                            >
                              {u.status === 'active' ? 'Disable' : 'Enable'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => onResetPassword(u)}>
                              Reset PW
                            </Button>
                            <Button size="sm" variant="outline" className="text-danger" onClick={() => onDeleteUser(u)}>
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Invites ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Invite links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              createInvite.mutate();
            }}
          >
            <Input
              placeholder="Note (who is this invite for?)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="max-w-sm"
            />
            <Button type="submit" disabled={createInvite.isPending}>
              Create invite
            </Button>
          </form>
          {createInvite.isError && (
            <p className="text-sm text-danger">
              {String((createInvite.error as Error).message) === 'max_users_reached'
                ? 'All seats are taken — delete a user first.'
                : 'Failed to create invite.'}
            </p>
          )}
          {openInvites.length === 0 ? (
            <p className="text-sm text-fg-muted">No open invites. Used and expired invites are hidden.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {openInvites.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="min-w-28 font-medium">{i.note ?? `Invite #${i.id}`}</span>
                  <code className="flex-1 truncate text-xs text-fg-muted" dir="ltr">
                    {inviteUrl(i.token)}
                  </code>
                  <span className="whitespace-nowrap text-xs text-fg-faint">expires {fmtDate(i.expiresAt)}</span>
                  <Button size="sm" variant="outline" onClick={() => copyLink(i)}>
                    {copied === i.id ? 'Copied!' : 'Copy link'}
                  </Button>
                  <Button size="sm" variant="outline" className="text-danger" onClick={() => revokeInvite.mutate(i.id)}>
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── AI usage ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{he ? 'שימוש ב-AI (30 ימים)' : 'AI usage (30 days)'}</CardTitle>
            <select
              value={usageUser}
              onChange={(e) => setUsageUser(e.target.value)}
              className="h-8 rounded-md border border-border bg-surface px-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">{he ? 'כל המשתמשים' : 'All users'}</option>
              {(usersQ.data?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <UsageChart daily={usageQ.data?.daily ?? []} he={he} />
          {!!usageQ.data?.byModel.length && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-fg-faint">
                    <th className="px-2 py-1.5 text-start">{he ? 'מודל' : 'Model'}</th>
                    <th className="px-2 py-1.5 text-end">{he ? 'קלט' : 'Prompt'}</th>
                    <th className="px-2 py-1.5 text-end">{he ? 'פלט' : 'Completion'}</th>
                  </tr>
                </thead>
                <tbody>
                  {usageQ.data.byModel.map((m) => (
                    <tr key={m.model} className="border-b border-border/50">
                      <td className="px-2 py-1.5 font-mono text-xs">
                        {m.model}
                        {m.estimated && <span className="ms-1 text-fg-faint">*</span>}
                      </td>
                      <td className="px-2 py-1.5 text-end text-fg-muted">{fmtTokens(m.promptTokens)}</td>
                      <td className="px-2 py-1.5 text-end text-fg-muted">{fmtTokens(m.completionTokens)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-2xs text-fg-faint">
                {he
                  ? '* כולל הערכות (תווים/4) כשהספק לא דיווח. הכפל בתעריף הספק שלך לאומדן עלות.'
                  : '* includes estimates (chars/4) where the provider reported none. Multiply by your provider’s price to estimate cost.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── System ────────────────────────────────────────────────────────── */}
      {systemQ.data && (
        <Card>
          <CardHeader>
            <CardTitle>{he ? 'מערכת' : 'System'}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <SysItem label={he ? 'גרסה' : 'Version'} value={`v${systemQ.data.version}`} />
              <SysItem label="Node" value={systemQ.data.nodeVersion} />
              <SysItem label={he ? 'זמן פעילות' : 'Uptime'} value={fmtUptime(systemQ.data.uptimeSeconds, he)} />
              <SysItem label={he ? 'DB בקרה' : 'Control DB'} value={fmtBytes(systemQ.data.controlDbBytes)} />
              <SysItem label={he ? 'נתוני משתמשים' : 'User data'} value={fmtBytes(systemQ.data.userDataBytes)} />
              <SysItem label={he ? 'גיבוי אחרון' : 'Last backup'} value={fmtDate(systemQ.data.lastBackupAt)} />
            </dl>
          </CardContent>
        </Card>
      )}

      <BackupsCard he={he} />

      {/* ── Audit log ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{he ? 'פעילות אחרונה' : 'Recent activity'}</CardTitle>
            <select
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              className="h-8 rounded-md border border-border bg-surface px-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">{he ? 'כל האירועים' : 'All events'}</option>
              {AUDIT_EVENTS.map((ev) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1 font-mono text-xs text-fg-muted">
            {(auditQ.data?.events ?? []).map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="whitespace-nowrap text-fg-faint">{fmtDate(e.ts)}</span>
                <span className="font-semibold text-foreground">{e.event}</span>
                <span>{e.userId != null ? `uid=${e.userId}` : ''}</span>
                <span className="truncate">{e.detail ?? ''}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function SysItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs uppercase tracking-wider text-fg-faint">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function fmtUptime(s: number, he: boolean): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return he ? `${d}ימ ${h}ש` : `${d}d ${h}h`;
  if (h > 0) return he ? `${h}ש ${m}ד` : `${h}h ${m}m`;
  return he ? `${m}ד` : `${m}m`;
}

interface BackupItem {
  id: string;
  kind: 'snapshot' | 'pre-upgrade';
  path: string;
  createdAt: number;
  ok: boolean | null;
  version: string | null;
}

/** Backups: last run status, "Back up now", recent snapshots + pre-upgrade copies. */
function BackupsCard({ he }: { he: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'backups'],
    queryFn: () => api.get<{ last: { ok: boolean; createdAt: number } | null; items: BackupItem[] }>('/admin/backups'),
  });
  const run = useMutation({
    mutationFn: () => api.post('/admin/backups'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'backups'] });
      qc.invalidateQueries({ queryKey: ['admin', 'system'] });
    },
  });
  const last = q.data?.last;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{he ? 'גיבויים' : 'Backups'}</CardTitle>
          <Button size="sm" variant="secondary" loading={run.isPending} onClick={() => run.mutate()}>
            {he ? 'גיבוי עכשיו' : 'Back up now'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm">
          {last ? (
            <span className={last.ok ? 'text-success' : 'text-danger'}>
              {last.ok ? '✓' : '✗'} {he ? 'גיבוי אחרון:' : 'Last backup:'} {fmtDate(last.createdAt)}
              {!last.ok && (he ? ' — הסתיים עם שגיאות' : ' — finished with errors')}
            </span>
          ) : (
            <span className="text-warning">{he ? 'עדיין לא בוצע גיבוי' : 'No backup yet'}</span>
          )}
        </p>
        <ul className="flex flex-col gap-1 font-mono text-xs text-fg-muted">
          {(q.data?.items ?? []).slice(0, 10).map((b) => (
            <li key={b.kind + b.id} className="flex flex-wrap gap-3">
              <span className="whitespace-nowrap text-fg-faint">{fmtDate(b.createdAt)}</span>
              <span className="font-semibold text-foreground">{b.kind}</span>
              <span>{b.version ? `v${b.version}` : ''}</span>
              <span>{b.ok === false ? '✗' : '✓'}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-fg-faint">
          {he
            ? 'שחזור מתבצע כשהשרת כבוי: admin restore <folder> --yes (ראו docs/backup-restore.md).'
            : 'Restores run with the server stopped: admin restore <folder> --yes (see docs/backup-restore.md).'}
        </p>
      </CardContent>
    </Card>
  );
}
