# Agent Portal — Build Brief

**Repo:** dennissolver/f2k-projects
**Live:** https://f2k-projects.vercel.app/
**Local:** `C:\Users\denni\PycharmProjects\F2K-Projects`

This brief covers four related pieces of work. Do them in order — each `Inspect first` step exists so you adapt to the actual stack instead of assuming. Open files before changing them. Report findings back at each checkpoint rather than guessing.

**Cross-cutting rule that applies to everything below:** an agent must only ever see their own clients and their own messages. Never add a data fetch that leaks another agent's buyers or another agent's mail. Enforce this in the data-access / RLS layer, not just the UI.

---

## Task 1 — Collapsible left sidebar (replaces the top nav)

### 1.1 Inspect first
Find the current top navigation (the bar reading "Seafields · Agent / My Clients / Availability / Profile / Dennis Patrick McMahon / Sign out"). Report back:
- Which file it lives in.
- The routing setup (Next.js app router? pages router? React Router?).
- How auth / the current user is read.
- The styling system (Tailwind, CSS modules, etc.).
- **What the existing `Availability` route actually renders** — lot inventory, or the agent's own appointment availability? Don't guess; open the file. If it's agent appointment availability, flag it so we can decide whether a separate "Lot Availability" item is needed.

### 1.2 Build the sidebar
Replace the top nav with a left sidebar:

**Brand (top)**
- Seafields · Agent

**Main nav**
- Dashboard
- My Clients
- Registrations
- Availability *(keep current route/label for now; flag agent-vs-lot per 1.1)*
- Documents
- Export / Sync

**Account zone (bottom, separated by a divider)**
- Profile
- Settings
- Dennis Patrick McMahon (current user name / avatar)
- Sign out

> Profile and Settings stay **separate**: Profile = public-facing agent bio; Settings = account config (password, notifications, license/REA number, payment details).

### 1.3 Collapse requirements (build in from the start)
- Toggle collapses to icons-only (~64px) and expands to full (~240px).
- Every nav item has an icon so icons-only mode is usable; show a tooltip with the label on hover when collapsed.
- Persist collapsed/expanded state in localStorage so it survives reload.
- Auto-collapse below a tablet breakpoint; on mobile, render as an off-canvas drawer with a hamburger toggle rather than a permanent rail.
- Main content reflows to sidebar width — no fixed margins that break when collapsed.
- Accessible: `<nav>`, keyboard-focusable items, `aria-expanded` on the toggle, `aria-current` on the active route.

### 1.4 Constraints
- New routes (Dashboard, Registrations, Documents, Export/Sync, Settings) can be **stub pages** — just wire routing + active-state highlighting; we'll fill them later.
- Match the existing styling system and palette; don't introduce a new UI library.

### 1.5 Deliver
PR/branch + short summary of what was touched and what's stubbed.

---

## Task 2 — Bulk email to agents (admin-gated page)

**Context:** This goes on the admin-gated agents page. An email provider is already configured — the app sends a welcome email when an admin creates a new agent. **Find that send path and reuse it.** Do not add a new provider, key, or library.

### 2.1 Inspect first
Locate the existing agent-creation/welcome email code. Report back:
- The file/route and the provider (Resend, SendGrid, etc.).
- The function signature you'll call to send.
- Whether it sends server-side (it should).
- Whether the function is **template-locked** (fixed subject/body) or accepts a custom subject + body. Bulk send needs custom content — if it's template-locked, flag it and propose either a generic-message variant or calling the provider directly with the same config. Don't force a bad fit.

### 2.2 Build the panel
On the admin agents page:
- Agent list with a **checkbox** per agent, a **Select all / none** toggle, and a live count ("3 of 12 selected").
- **Subject** field and **message body** (multi-line plain text to start).
- **Send** button, disabled until ≥1 recipient + subject + body are present.
- A **confirmation step** before sending showing recipient count and names — guards against accidental send-to-all.

### 2.3 Sending
- Reuse the existing server-side send path from 2.1. Never call the provider from the client.
- Send each agent an **individual** message (loop the single-send function, or BCC) — never put all recipients in a visible To field.
- Handle partial failure: report which recipients failed rather than silently dropping them.
- Batch or rate-limit if the provider caps per-call volume.

### 2.4 Safety
- Keep the admin gate on **both** the UI and the server route — hiding the UI is not enough; the route must reject non-admins.
- All sends get logged (see Task 3).

### 2.5 Deliver
PR/branch + summary, including which existing email function was reused.

---

## Task 3 — Message logging in Supabase

**Goal:** Every message sent through the app (the new bulk email *and* the existing new-agent welcome email) is logged to Supabase. Schema is designed so inbound/replies can be added later without a rewrite.

**Scope note:** Build **outbound logging only** now. Leave the schema ready for inbound. Do **not** build inbound/reply capture (webhooks, reply-to routing) in this task.

### 3.1 Inspect first
Check the Supabase migrations folder and current DB for any existing `messages` / `email_log` / `communications` table. Report what exists. Open the migration files — don't assume.

### 3.2 If no suitable table exists, write a migration
Use the project's existing migration tooling/location — don't introduce a new one. Suggested shape (adapt names to repo conventions):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `direction` | text/enum | `outbound` \| `inbound` — set up now though only outbound is used |
| `channel` | text | `email` (room for `sms` etc. later) |
| `sender_id` | uuid, nullable | the admin (or system) who sent |
| `sender_email` | text | |
| `recipient_id` | uuid, FK to agent where possible | |
| `recipient_email` | text | |
| `subject` | text | |
| `body` | text | |
| `status` | text | `sent` \| `failed` \| `queued` |
| `error` | text, nullable | for failed sends |
| `provider_message_id` | text, nullable | needed later to match inbound replies to a thread |
| `thread_id` | uuid, nullable | for grouping conversations later |
| `created_at` | timestamptz | |
| `metadata` | jsonb, nullable | catch-all so we don't migrate again for small additions |

Index `recipient_id`, `direction`, and `created_at`.

### 3.3 Wire logging into the send paths
- **Bulk email:** write **one row per recipient** (so partial failures are individually recorded — a failed send logs `status: failed` + `error`, not a missing row).
- **Welcome email:** also log the existing new-agent welcome email through the same path, so the log is complete going forward. *(Past welcome emails are not backfilled — known and accepted.)*
- Log server-side, in the same route/action as the send — never from the client.

### 3.4 Deliver
Report whether a migration was needed or an existing table was reused, the final schema, and confirm RLS (Task 4) is applied.

---

## Task 4 — RLS on the message log

Two policies on the message-log table. The one-row-per-recipient design (Task 3.3) makes the agent policy safe and simple — each row names exactly one agent, so there's no recipient list to leak.

- **Admin:** read all rows (full org-wide log).
- **Agent:** read rows where `recipient_id = auth.uid()` only.
- **No insert/update/delete for agents** — the table is written server-side by the send path, never by clients.

Write the agent read policy as `recipient_id = auth.uid()` (covers admin→agent now). Add a code comment noting that if inbound replies sent *by* the agent are added later, this extends to `recipient_id = auth.uid() OR sender_id = auth.uid()` — but don't add the sender-side clause now, since inbound isn't built.

### 4.1 Agent-facing inbox — hide internal columns
`error`, `provider_message_id`, and `metadata` are operational/internal. Agents shouldn't see raw send errors or internal metadata in their inbox.

**Preferred approach:** expose agent reads through a **view** that omits the internal columns (`subject`, `body`, `sender_email`, `created_at`, `status` only). RLS on the base table still protects everything; the view keeps internal fields out of reach cleanly.

Flag back which approach you implemented (view vs. column-restricted query).

### 4.2 Deliver
Confirm both policies, the agent inbox view, and that agents cannot write to the table.

---

## Open items to report back on (collected)

1. `Availability` route — agent appointment availability or lot inventory? (Task 1.1)
2. Is the existing email function template-locked or does it accept custom subject/body? (Task 2.1)
3. Was a message-log migration needed, or did a table already exist? (Task 3.1)
4. Agent inbox: view or column-restricted query? (Task 4.1)
