-- Daily Duty Manager — function hardening
-- Run after 20261109010000_admin_lockdown.sql.
--
-- Supabase grants EXECUTE on new public functions to anon and authenticated by
-- default. Revoking from PUBLIC alone does not remove those explicit grants, so
-- anonymous users could still call public.is_admin(). It only ever returns a
-- boolean for the caller, but the anonymous role has no reason to call it.
--
-- The timestamp trigger also gets a fixed, empty search_path so its body cannot
-- resolve objects from a caller-controlled schema.

revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_admin() from authenticated;
grant execute on function public.is_admin() to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public;
revoke execute on function public.set_updated_at() from anon;
revoke execute on function public.set_updated_at() from authenticated;
