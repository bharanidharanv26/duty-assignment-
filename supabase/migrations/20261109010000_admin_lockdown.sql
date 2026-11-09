-- Daily Duty Manager — administrator allowlist
-- Run after 20261109000000_init.sql.
--
-- RLS previously allowed any authenticated user. Because a Supabase project can
-- have public sign-up enabled, this migration restricts every table to users in
-- public.admin_users. Add the administrator after creating their Auth account:
--
--   insert into public.admin_users (user_id)
--   select id from auth.users where email = 'your-admin@example.com'
--   on conflict (user_id) do nothing;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Accounts allowed to use the app. Add an Auth user id here to authorize it.';

alter table public.admin_users enable row level security;

-- The table is read only through the security-definer function below.
revoke all on public.admin_users from anon;
revoke all on public.admin_users from authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists staff_authenticated_all on public.staff;
create policy staff_admin_all on public.staff
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists blocks_authenticated_all on public.blocks;
create policy blocks_admin_all on public.blocks
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists monthly_allocations_authenticated_all on public.monthly_allocations;
create policy monthly_allocations_admin_all on public.monthly_allocations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists daily_schedules_authenticated_all on public.daily_schedules;
create policy daily_schedules_admin_all on public.daily_schedules
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists app_settings_authenticated_all on public.app_settings;
create policy app_settings_admin_all on public.app_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
