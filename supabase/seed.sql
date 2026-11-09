-- Daily Duty Manager — seed data
-- Run after supabase/migrations/20261109000000_init.sql.
-- Safe to run more than once.

insert into public.staff (name, display_name, sort_order) values
  ('Sister Jeeva', 'Sister Jeeva', 1),
  ('Sister Devabakiyam', 'Sister Devabakiyam', 2),
  ('Sister Muthalagi', 'Sister Muthalagi', 3),
  ('Sis. Ranjitha', 'Sis. Ranjitha', 4),
  ('Sis. Deepa', 'Sis. Deepa', 5),
  ('Sis. Shantha', 'Sis. Shantha', 6),
  ('Sister Kamatchi', 'Sister Kamatchi', 7),
  ('Sister Uma', 'Sister Uma', 8),
  ('Sis. Esaidevi', 'Sis. Esaidevi', 9),
  ('Sis. Ester', 'Sis. Ester', 10)
on conflict do nothing;

insert into public.blocks (name, display_name, sort_order) values
  ('Phone Block', 'Phone Block', 1),
  ('Mahadevan Block', 'Mahadevan Block', 2),
  ('Shanthi Block', 'Shanthi Block', 3),
  ('Japan Block', 'Japan Block', 4),
  ('Helpage Block', 'Helpage Block', 5),
  ('Veg Block', 'Veg Block', 6),
  ('Antony Block', 'Antony Block', 7),
  ('Captain Block', 'Captain Block', 8),
  ('Cyithiya Block', 'Cyithiya Block', 9),
  ('Gerugambakkam', 'Gerugambakkam', 10)
on conflict do nothing;

insert into public.app_settings (id)
values (true)
on conflict (id) do nothing;
