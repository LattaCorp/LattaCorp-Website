-- LattaCorp CRM, Stage 13: Expenses tab for taxes (Code, Date, Vendor, Description, Category, Payment, Receipt #, Amount, Tax, Total)
-- plus the Tax Report's equipment inventory sheets.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- Requires Stage 9 (expenses) and Stage 12 (inventory) to have been run first.

-- The existing "amount" column keeps the TOTAL paid (amount + tax), so Reports keep working. "note" is the Description.
alter table public.expenses add column if not exists code       text not null default '';
alter table public.expenses add column if not exists payment    text not null default '';
alter table public.expenses add column if not exists receipt_no text not null default '';
alter table public.expenses add column if not exists tax        numeric(10,2) not null default 0 check (tax >= 0);
create index if not exists expenses_vendor_idx on public.expenses (vendor);

-- Marks the two equipment sheets that live on the Reports > Tax Report page instead of the Inventory tab.
alter table public.inventory_cats add column if not exists kind text not null default '';
