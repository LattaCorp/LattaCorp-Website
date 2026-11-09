-- LattaCorp CRM, Stage 12: Inventory (Excel-style sheets with your own categories and columns).
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- (Choose the option WITHOUT RLS if asked; this script turns RLS on itself.)

-- One row per category (a "sheet"). "columns" is a list like [{"k":"c1","n":"Item","t":"text"},{"k":"c2","n":"Qty","t":"number"}].
create table if not exists public.inventory_cats (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,
  columns    jsonb not null default '[]'::jsonb,
  sort       int not null default 0
);

-- One row per line in a sheet. "data" holds the cell values keyed by the column keys.
create table if not exists public.inventory_items (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cat_id     uuid not null references public.inventory_cats(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  sort       int not null default 0
);
create index if not exists inventory_items_cat_idx on public.inventory_items (cat_id, sort);

alter table public.inventory_cats  enable row level security;
alter table public.inventory_items enable row level security;
drop policy if exists "staff all inventory_cats"  on public.inventory_cats;
drop policy if exists "staff all inventory_items" on public.inventory_items;
create policy "staff all inventory_cats"  on public.inventory_cats  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all inventory_items" on public.inventory_items for all to authenticated using (public.is_staff()) with check (public.is_staff());
