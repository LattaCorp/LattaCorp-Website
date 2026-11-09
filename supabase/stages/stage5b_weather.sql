-- LattaCorp CRM: weather delay with undo, plus smart catch-up.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- Remembers where each visit was pushed from so one tap can put it back.
alter table public.visits add column if not exists weather_from  date;
alter table public.visits add column if not exists weather_batch text;
