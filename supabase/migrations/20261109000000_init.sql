-- Daily Duty Manager — initial schema
-- Run this first in the Supabase SQL editor, then run supabase/seed.sql.

create extension if not exists pgcrypto;

/* -------------------------------------------------------------------------- */
/* Staff                                                                      */
/* -------------------------------------------------------------------------- */

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint staff_name_not_blank check (btrim(name) <> ''),
  constraint staff_display_name_not_blank check (btrim(display_name) <> '')
);

create unique index if not exists staff_name_unique
  on public.staff (lower(name));

comment on table public.staff is
  'Staff members. Daily schedules keep their own name snapshots.';

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint blocks_name_not_blank check (btrim(name) <> ''),
  constraint blocks_display_name_not_blank check (btrim(display_name) <> '')
);

create unique index if not exists blocks_name_unique
  on public.blocks (lower(name));

comment on table public.blocks is
  'Workplace blocks. Daily schedules keep their own block name snapshots.';

/* -------------------------------------------------------------------------- */
/* Monthly default allocations                                                */
/* -------------------------------------------------------------------------- */

create table if not exists public.monthly_allocations (
  id uuid primary key default gen_random_uuid(),
  year smallint not null check (year between 2000 and 2200),
  month smallint not null check (month between 1 and 12),
  staff_id uuid not null references public.staff (id) on delete cascade,
  block_id uuid not null references public.blocks (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint monthly_allocations_unique unique (year, month, staff_id, block_id)
);

create index if not exists monthly_allocations_period_idx
  on public.monthly_allocations (year, month);
create index if not exists monthly_allocations_staff_idx
  on public.monthly_allocations (staff_id);
create index if not exists monthly_allocations_block_idx
  on public.monthly_allocations (block_id);

/* -------------------------------------------------------------------------- */
/* Daily schedules                                                            */
/* -------------------------------------------------------------------------- */

create table if not exists public.daily_schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_date date not null,
  assignments jsonb not null default '[]'::jsonb,
  generated_message text,
  final_message text,
  status text not null default 'finalized'
    check (status in ('draft', 'finalized')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_schedules_date_unique unique (schedule_date),
  constraint daily_schedules_assignments_is_array
    check (jsonb_typeof(assignments) = 'array')
);

comment on table public.daily_schedules is
  'One schedule per date. assignments stores staff/block ids plus name snapshots.';

create index if not exists daily_schedules_date_idx
  on public.daily_schedules (schedule_date desc);

/* -------------------------------------------------------------------------- */
/* App settings (single row)                                                  */
/* -------------------------------------------------------------------------- */

create table if not exists public.app_settings (
  id boolean primary key default true,
  message_heading text not null default 'Duty Schedule – {date}',
  duty_7am_label text not null default '7 AM Shift',
  duty_11am_label text not null default '11:30 AM Duty',
  gerugambakkam_label text not null default 'Gerugambakkam Duty',
  leave_label text not null default 'Leave',
  comp_off_label text not null default 'Comp Off',
  block_joiner text not null default 'and'
    check (block_joiner in ('and', 'comma', 'slash')),
  block_abbreviations jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

comment on table public.app_settings is
  'Single settings row used for message wording and block abbreviations.';

insert into public.app_settings (id)
values (true)
on conflict (id) do nothing;

/* -------------------------------------------------------------------------- */
/* updated_at trigger                                                         */
/* -------------------------------------------------------------------------- */

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_schedules_set_updated_at on public.daily_schedules;
create trigger daily_schedules_set_updated_at
  before update on public.daily_schedules
  for each row
  execute function public.set_updated_at();

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row
  execute function public.set_updated_at();

/* -------------------------------------------------------------------------- */
/* Row Level Security                                                         */
/* -------------------------------------------------------------------------- */

alter table public.staff enable row level security;
alter table public.blocks enable row level security;
alter table public.monthly_allocations enable row level security;
alter table public.daily_schedules enable row level security;
alter table public.app_settings enable row level security;

-- Only signed-in users (the administrator) can read or change data.
-- There is one policy per table; the anon role has no access.

drop policy if exists staff_authenticated_all on public.staff;
create policy staff_authenticated_all on public.staff
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists blocks_authenticated_all on public.blocks;
create policy blocks_authenticated_all on public.blocks
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists monthly_allocations_authenticated_all on public.monthly_allocations;
create policy monthly_allocations_authenticated_all on public.monthly_allocations
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists daily_schedules_authenticated_all on public.daily_schedules;
create policy daily_schedules_authenticated_all on public.daily_schedules
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists app_settings_authenticated_all on public.app_settings;
create policy app_settings_authenticated_all on public.app_settings
  for all to authenticated
  using (true)
  with check (true);

/* -------------------------------------------------------------------------- */
/* Privileges                                                                 */
/* -------------------------------------------------------------------------- */

revoke all on public.staff from anon;
revoke all on public.blocks from anon;
revoke all on public.monthly_allocations from anon;
revoke all on public.daily_schedules from anon;
revoke all on public.app_settings from anon;

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.staff to authenticated;
grant select, insert, update, delete on public.blocks to authenticated;
grant select, insert, update, delete on public.monthly_allocations to authenticated;
grant select, insert, update, delete on public.daily_schedules to authenticated;
grant select, insert, update on public.app_settings to authenticated;
