# Admin Guide

The admin dashboard lives at **`/admin`** (visible in the sidebar only for the
admin account). It manages accounts, invite links, usage and the audit trail.
Admin actions never open another user's content — the control plane only knows
*who* exists and *how much* they use, never *what* they wrote.

## Inviting users

1. **Admin → Invite links → Create invite** (add a note so you remember who
   it's for).
2. Copy the link (`https://<domain>/invite/<token>`) and send it over any
   channel — no email server is involved.
3. The invitee opens the link, chooses their own email + password (min 8
   chars), and lands in a freshly provisioned, fully isolated Dreamward.

Invite mechanics:

- **One-time** — a used link is dead (`410 already_used`).
- **Expiring** — default 7 days (configurable per invite, max 90).
- **Seat-capped** — creation and acceptance both enforce `MAX_USERS`
  (default 10). Free a seat by deleting a user.
- **Revocable** — unused invites can be revoked from the dashboard.

## User lifecycle

| Action | Effect |
| --- | --- |
| **Disable** | Account locked AND all live sessions die on their next request. Data stays. |
| **Enable** | Restores access; existing cookies work again. |
| **Reset PW** | Set a new password for a user who lost theirs (tell them out-of-band). |
| **Delete** | Removes the account AND `users/<uid>/` — DB, images, everything. Irreversible (backups aside). Admin accounts and your own account can't be deleted. |

CLI fallback (e.g. you locked yourself out):

```bash
docker compose -f docker-compose.prod.yml exec api \
  node dist/scripts/reset-password.js admin@example.com "new-password"
```

## Monitoring usage

The **Users** table shows per account:

- **Storage** — bytes of their entire `users/<uid>/` tree (DB + images).
- **AI tokens (in/out)** — cumulative prompt/completion tokens across all
  their providers, as reported by providers (or estimated chars/4 when a
  provider sends no usage — those rows are flagged internally).
- **Last login** — control-plane timestamp.

Because each tester brings their own AI key, token numbers are about
*visibility*, not billing. If someone's usage looks runaway, disable the
account and talk to them.

## Audit log

**Recent activity** shows the append-only audit trail: logins (success and
failed, with IP), invites created/accepted/revoked, password changes/resets,
user disable/enable/delete. Secrets are never written to the log. The full
table lives in `control.db` (`audit_log`) if you need history beyond the
dashboard's tail.

## Seeding your own AI provider

Your OpenRouter key is configured server-side (never visible in the UI):

```bash
# reads ADMIN_OPENROUTER_KEY from /opt/dreamward/.env
docker compose -f docker-compose.prod.yml exec api node dist/scripts/seed-admin-provider.js
```

This upserts the "OpenRouter (admin)" provider into *your* account with the
current most-capable free model (override with `ADMIN_OPENROUTER_MODEL`).
