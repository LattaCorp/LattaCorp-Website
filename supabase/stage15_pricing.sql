-- LattaCorp CRM, Stage 15: saved rates for the lawn price calculator.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- Requires Stage 5 (the business table). Without this, the calculator still works with the built-in starting rates,
-- but changes made under "Edit rates" cannot be saved.
alter table public.business add column if not exists pricing jsonb not null default '{}'::jsonb;
