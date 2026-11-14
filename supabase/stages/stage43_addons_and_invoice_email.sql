-- LattaCorp, Stage 43: extra visits and add-ons that bill with the month, and emailing invoices in batches.
-- Safe to run more than once.

-- 1. A visit can be a regular visit, an extra visit, or an add-on (a quick job done for the client).
--    Add-ons and extras are saved as visits so "Bill the month" picks them up automatically.
alter table public.visits add column if not exists kind  text not null default 'visit';
alter table public.visits add column if not exists title text not null default '';   -- the invoice line; empty = the job's name
alter table public.visits add column if not exists slot  bigint not null default 0;  -- 0 for the schedule's own visit; extras get their own number
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'visits_kind_chk') then
    alter table public.visits add constraint visits_kind_chk check (kind in ('visit','extra','addon'));
  end if;
end $$;
-- the schedule still makes only one regular visit per job per date; extras and add-ons can share that date
alter table public.visits drop constraint if exists visits_job_id_orig_date_key;
create unique index if not exists visits_job_date_slot on public.visits (job_id, orig_date, slot);

-- 2. Invoices emailed from Foreman (batch delivery): when and to whom.
alter table public.invoices add column if not exists emailed_at timestamptz;
alter table public.invoices add column if not exists emailed_to text not null default '';
create index if not exists invoices_emailed_at_idx on public.invoices (emailed_at);
