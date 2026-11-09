-- Add the Night Duty special-duty label.

alter table public.app_settings
  add column if not exists night_duty_label text not null default 'Night Duty';
