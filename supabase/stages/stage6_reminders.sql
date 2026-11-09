-- LattaCorp CRM, Stage 6: text reminders (remembers who you already texted).
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
alter table public.visits   add column if not exists reminded_at timestamptz;
alter table public.invoices add column if not exists reminded_at timestamptz;
