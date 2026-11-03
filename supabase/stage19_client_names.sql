-- LattaCorp CRM, Stage 19: client last name (for sorting) and preferred name / nickname.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
alter table public.clients add column if not exists last_name text not null default '';
alter table public.clients add column if not exists nickname  text not null default '';
