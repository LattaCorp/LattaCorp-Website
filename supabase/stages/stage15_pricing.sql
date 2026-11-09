-- LattaCorp CRM, Stage 15: saved rates and options for the lawn price calculator (CRM and website).
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- Requires Stage 5 (the business table). Without this, the calculators still work with the built-in starting rates,
-- but changes made under "Edit rates and options" cannot be saved and the website keeps using the built-in rates.
alter table public.business add column if not exists pricing jsonb not null default '{}'::jsonb;

-- The website calculator asks for the rates through this one function. It returns only the calculator settings
-- (rates and options), nothing else from the business table.
create or replace function public.public_pricing() returns json
language sql stable security definer set search_path = public as $$
  select coalesce((select pricing from public.business where id = 1), '{}'::jsonb)::json
$$;
revoke all on function public.public_pricing() from public;
grant execute on function public.public_pricing() to anon, authenticated;
