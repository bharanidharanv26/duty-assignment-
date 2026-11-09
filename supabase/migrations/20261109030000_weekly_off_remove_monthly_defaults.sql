-- Add the Weekly Off status label and remove monthly block defaults.

alter table public.app_settings
  add column if not exists weekly_off_label text not null default 'Weekly Off';

comment on table public.app_settings is
  'Single settings row used for message wording and block abbreviations.';

drop table if exists public.monthly_allocations cascade;
