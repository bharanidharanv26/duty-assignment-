# Daily Duty Manager

A small, focused web app for preparing daily staff duty schedules and the matching
WhatsApp message. It replaces manual duty assignment and message typing with one
screen: pick a date, assign everyone, generate the message, edit if needed, copy, and
save.

Built with React + TypeScript + Vite, Tailwind CSS, shadcn/ui, Lucide icons and
Supabase (PostgreSQL, Auth and Row Level Security). There is no separate backend —
the browser talks to Supabase directly.

---

## What it does

- **Daily Schedule** — one screen for all active staff. Choose the date, set each
  sister's status (Working / Leave / Comp Off / Weekly Off), a special duty, and any
  number of blocks. Special duties can be combined with blocks.
- **Partial schedules** — you do not have to assign every sister or fill every
  special duty. Only conflicts, such as one block assigned to two people, prevent
  Generate and Save.
- **Only available blocks** — when one sister selects a block, that block disappears
  from every other sister's card. The chips still shown are the blocks not yet
  assigned that day.
- **Message generation** — builds a WhatsApp-ready message from the actual
  assignments, with all staff lines, multiple blocks per person, readable names and
  optional block abbreviations. No filler sentences.
- **Message editing** — the generated message is an editable text area with
  **Copy Message**. Regenerating asks for confirmation if the text was edited by hand.
  Editing the message never changes the duty assignments, and the final text is saved.
- **Save and history** — exactly one schedule per date. History has a month calendar
  and a saved-day list. Open any day to see the assignments, final message and the
  original generated message. Copy an old message, edit a date, duplicate a
  schedule to another date as an independent draft, or delete a saved schedule.
- **Historical snapshots** — each saved assignment stores staff and block names as
  they were on that day, so renaming staff or blocks later never rewrites history.
- **Staff & Blocks** — add, rename, reorder and deactivate staff and blocks.
  Deactivating only affects future schedules.
- **Settings** — configurable heading (`{date}` placeholder), labels for 7 AM, 11 AM,
  Gerugambakkam, Night Duty, Leave, Comp Off and Weekly Off, how multiple blocks are
  joined, and short block abbreviations.
- **Administrator-only access** — Supabase Auth login/logout, protected routes, and
  RLS policies that allow only the allowlisted administrator. No public sign-up.
- **Responsive** — single-column assignment cards and a sticky Generate/Save bar on
  phones, two-column cards on larger screens. Light theme only.

---

## Tech stack

| Part          | Choice                                        |
| ------------- | --------------------------------------------- |
| Frontend      | React 19, TypeScript, Vite                    |
| Styling       | Tailwind CSS v4                               |
| UI components | shadcn/ui (Radix primitives, Lucide icons)    |
| Backend       | Supabase (PostgreSQL, Auth, REST)             |
| Tests         | Vitest (assignment rules + message generator) |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Create a project at [supabase.com](https://supabase.com). You do not need the
Supabase CLI; the SQL editor is enough.

### 3. Create the database

In the Supabase dashboard open **SQL Editor → New query** and run these files in
order (copy the whole file into the editor):

1. `supabase/migrations/20261109000000_init.sql` — tables, constraints, indexes,
   `updated_at` triggers, RLS policies and the settings row.
2. `supabase/migrations/20261109010000_admin_lockdown.sql` — administrator
   allowlist and RLS policies restricted to it.
3. `supabase/migrations/20261109020000_harden_functions.sql` — removes the
   anonymous execute grant on `is_admin()` and pins the trigger function's
   `search_path`.
4. `supabase/migrations/20261109030000_weekly_off_remove_monthly_defaults.sql` —
   adds the Weekly Off label and removes the old monthly defaults table.
5. `supabase/migrations/20261109040000_add_night_duty_label.sql` — adds the Night
   Duty label.
6. `supabase/seed.sql` — the 10 sisters and 10 blocks. Safe to run twice.

All scripts are idempotent.

### 4. Create and authorize the administrator

1. In Supabase go to **Authentication → Users → Add user**.
2. Use the internal address `uma@duty.local` and a password of at least 6 characters,
   and turn on **Auto Confirm User**. This address is not shown on the login screen.
3. Open the SQL editor and allowlist that account for RLS:

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'uma@duty.local'
on conflict (user_id) do nothing;
```

The login screen shows a username, not an email. It maps `uma` to
`uma@duty.local` in `src/hooks/use-auth.tsx`. To use a different username, change
that map and the Auth user's address together.

4. Recommended: under **Authentication → Sign In / Providers → Email**, turn off
   **Allow new users to sign up**. The app has no registration screen, and RLS blocks
   unlisted accounts anyway.

Without the allowlist row the account can sign in but every list is empty and writes
are refused by RLS.

### 5. Environment variables

Copy `.env.example` to `.env.local` (the file is git-ignored) and fill in the values
from **Supabase → Project Settings → API**:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

`VITE_SUPABASE_PUBLISHABLE_KEY` is also accepted instead of
`VITE_SUPABASE_ANON_KEY`.

This is a Vite client app: the variables must use the `VITE_` prefix, not
`NEXT_PUBLIC_`, and it talks to Supabase through `@supabase/supabase-js` directly. The
`@supabase/ssr` package and Next.js middleware are not needed.

> **Never put the service role key in a `VITE_*` variable.** Vite embeds every
> `VITE_*` value into the browser bundle. The app only needs the anon/publishable key
> because RLS enforces access.

### 6. Run it

```bash
npm run dev
```

Open the printed URL and sign in with username `uma` and the password you set. If the
keys are missing, the app shows a setup checklist instead of failing silently.

---

## Daily workflow

1. Open **Daily Schedule** (Today is selected by default).
2. Pick the date if needed.
3. For each sister choose Working / Leave / Comp Off / Weekly Off, then a special duty
   and blocks if needed. Leaving someone unassigned is allowed.
4. When no conflict warning remains on a sister's card, click **Generate Schedule**.
5. Review or edit the message, then **Copy Message** and paste it into WhatsApp.
6. Click **Save Schedule** so the day appears in **Schedule History**.

Buttons also include **Clear Assignments**, **Copy Previous Schedule** (latest earlier
saved day, loaded as assignments only) and **Today**.

### Rules enforced before generating or saving

1. At most one person on each special duty (7 AM, 11:30 AM, Gerugambakkam, Night
   Duty).
2. A block can belong to only one person per day.
3. One person can have multiple blocks.
4. Leave cannot be combined with any duty or block.
5. Comp Off cannot be combined with any duty or block.
6. Weekly Off cannot be combined with any duty or block.
7. Special duties can be combined with blocks.
8. Partial schedules are allowed; unassigned sisters are left out of the message.

Error messages name the people or blocks involved, e.g. “Phone Block is assigned to
Sister Uma and Sis. Ester. A block can only have one person per day.”

---

## Message settings

**Settings → Message wording** controls:

- Heading — `{date}` becomes the full schedule date. Default:
  `Duty Schedule – {date}`. Leave blank for no heading.
- Labels — `7 AM Shift`, `11:30 AM Duty`, `Gerugambakkam Duty`, `Night Duty`, `Leave`,
  `Comp Off`, `Weekly Off` by default. Change them to whatever is natural on WhatsApp.
- Multiple blocks — join with `and`, `,` or `/`.
- Block abbreviations — e.g. `Mahadevan Block` → `MHA`. Blank uses the full name.

Example output:

```
Duty Schedule – Monday, 9 November 2026

Sister Jeeva – Comp Off
Sister Devabakiyam – Shanthi Block
Sister Muthalagi – Japan Block
Sis. Ranjitha – 7 AM Shift
Sis. Deepa – 11:30 AM Duty
Sis. Shantha – Helpage Block and Cyithiya Block
Sister Kamatchi – Gerugambakkam Duty
Sister Uma – Leave
Sis. Esaidevi – Phone Block
Sis. Ester – Veg Block
```

---

## Database

### Tables

| Table                 | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `staff`               | `id`, `name`, `display_name`, `is_active`, `sort_order`, `created_at`    |
| `blocks`              | `id`, `name`, `display_name`, `is_active`, `sort_order`, `created_at`    |
| `daily_schedules`     | `schedule_date` (unique), `assignments` JSONB, generated/final messages, status, timestamps |
| `app_settings`        | single row: heading, labels, block joiner, abbreviations                  |
| `admin_users`         | allowlist of Auth user ids permitted to access everything above          |

`sort_order` was added to `staff` and `blocks` so the message order is stable and can be
changed with the up/down arrows on the Staff & Blocks page.

### Assignments JSONB

`assignments` is an array of assignment objects. Each one stores IDs **and** name
snapshots:

```json
[
  {
    "staff_id": "uuid",
    "staff_name": "Sister Jeeva",
    "staff_display_name": "Sister Jeeva",
    "status": "working",
    "duty": "7am",
    "blocks": [
      {
        "block_id": "uuid",
        "block_name": "Phone Block",
        "block_display_name": "Phone Block"
      }
    ]
  }
]
```

`status` is `working`, `leave`, `comp_off` or `weekly_off`; `duty` is `7am`, `11am`,
`gerugambakkam`, `night` or `null`. Because names are snapshotted, history is unaffected
by later renames. `daily_schedules.schedule_date` is unique, and the app upserts, so a
date can never have two schedules.

### Security

- RLS is enabled on every table. Policies require a signed-in user **and** a row in
  `public.admin_users` for that user (checked through a security-definer
  `public.is_admin()` function). The `anon` role has no table access and cannot
  execute `is_admin()`; only `authenticated` can.
- The browser uses the anon/publishable key. The service role key is never referenced
  in frontend code.
- No public registration exists in the app. Even if sign-up is enabled in Supabase, a
  newly created account reads no rows and cannot write. Disabling sign-ups in
  **Authentication → Sign In / Providers → Email** is still recommended.
- The login screen maps username `uma` to the internal address `uma@duty.local` in
  `src/hooks/use-auth.tsx`. Change the map and the Auth user's address together if
  the username changes. Change the password in **Authentication → Users**.
- To change administrators, create the new Auth user, insert their id into
  `public.admin_users`, and optionally delete the old row.
- Use Supabase's built-in backups for protection.

---

## Deployment

### Vercel (recommended)

1. Push the project to GitHub.
2. In Vercel, **Add New → Project**, import the repo. Vercel detects Vite
   (build `npm run build`, output `dist`).
3. Add the two environment variables (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`) for Production (and Preview if wanted).
4. Deploy. `vercel.json` already contains the SPA rewrite so `/history`, `/staff` and
   `/settings` load correctly on refresh.
5. In Supabase go to **Authentication → URL Configuration** and set **Site URL** to
   your deployed URL. Add it under **Redirect URLs** too.

### Netlify or another static host

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables: the same two values.
- Add an SPA fallback: create `public/_redirects` containing
  `/*    /index.html   200`, or configure an equivalent rewrite on your host.
- For any host, set the Supabase Site URL to the deployment domain.

### Supabase CLI (optional)

If you prefer migrations instead of the SQL editor:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

`supabase/seed.sql` is not applied by `db push`; run it in the SQL editor.

---

## Scripts

| Command           | What it does                              |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | Start the development server              |
| `npm run build`   | Typecheck and build to `dist`             |
| `npm run preview` | Preview the production build              |
| `npm run test`    | Run the Vitest suite (14 tests)           |
| `npm run typecheck` | TypeScript check only                   |

---

## Project structure

```
src/
  components/          shared UI (assignment card, block chips, message panel, …)
  components/ui/       shadcn/ui primitives
  hooks/use-auth.tsx   Supabase session context
  lib/
    api.ts             all Supabase reads/writes
    assignments.ts     assignment building, validation rules, message generator
    date.ts            local-date helpers and calendar grid
    supabase.ts        browser client built from VITE_* variables
    types.ts           domain types and defaults
  pages/               DailySchedule, ScheduleHistory, StaffAndBlocks, Settings, Login
supabase/
  migrations/          20261109000000_init.sql (schema, RLS)
                       20261109010000_admin_lockdown.sql (admin allowlist)
                       20261109020000_harden_functions.sql (function grants)
                       20261109030000_weekly_off_remove_monthly_defaults.sql
                       20261109040000_add_night_duty_label.sql
  seed.sql             10 staff, 10 blocks, settings row
```

---

## Verification

Checked in this workspace against the live Supabase project and a real browser:

- Database setup — all five migrations and the seed applied: 10 staff, 10 blocks,
  one settings row, admin allowlist and RLS policies.
- Supabase data path — administrator login; read staff/blocks/settings; save a full
  10-person schedule; reload it; edit its message; confirm one row per date; duplicate
  it to another date. Test rows were removed.
- Security — a second authenticated account with no allowlist row reads `[]` and gets
  HTTP 403 when writing.
- Browser flow — logged in through the UI, assigned sisters, generated the exact
  message, copied it, saved it, saw it in Schedule History and opened its detail
  dialog. The test schedule was removed afterwards.
- Unit tests — `npm run test`: 14 tests pass (partial schedules, block availability,
  duplicate duty, duplicate block, Leave/Comp Off/Weekly Off conflicts, status
  clearing, saved name snapshots, Weekly Off and Night Duty message text, exact
  message formatting).
- `npm run typecheck` and `npm run build` pass.

---

## Troubleshooting

| Symptom                                        | Fix                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Setup checklist instead of the login screen    | `.env.local` is missing or the dev server was not restarted after adding it.           |
| “Username or password is incorrect”            | Check the username map in `use-auth.tsx` and the Auth user; confirm it with **Auto Confirm User** on. |
| “Could not reach Supabase”                      | Check `VITE_SUPABASE_URL`; it must be the project URL, not the dashboard URL.          |
| Login works but every screen shows a data error | The SQL migration/seed has not been run, or RLS was altered. Re-run the migration.     |
| Signed in but every list is empty / writes fail | The account is missing from `public.admin_users`. Add its id with the SQL above.       |
| A date opens with old staff or block names      | That is intentional: saved schedules keep their historical snapshots.                  |
| A staff member is missing from new schedules    | They are deactivated. Reactivate them in Staff & Blocks.                              |
| The message does not reflect a change           | Click **Generate** again; the panel shows a notice when assignments changed.           |
