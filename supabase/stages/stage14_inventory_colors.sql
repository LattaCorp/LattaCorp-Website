-- LattaCorp CRM, Stage 14: colour code for each Inventory category.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- Requires Stage 12 (inventory). Without this, colours still show but are not remembered if you add or delete categories.
alter table public.inventory_cats add column if not exists color text not null default '';
