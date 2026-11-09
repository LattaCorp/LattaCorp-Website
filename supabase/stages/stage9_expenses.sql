-- LattaCorp CRM, Stage 9: expenses (for the Reports tab and accounting).
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
create table if not exists public.expenses (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  spent_on   date not null default current_date,
  amount     numeric(10,2) not null check (amount >= 0),
  category   text not null default 'Other',
  vendor     text not null default '',
  note       text not null default '',
  client_id  uuid references public.clients(id) on delete set null,   -- optional: money spent for one client's job
  created_by text not null default ''
);
create index if not exists expenses_spent_idx on public.expenses (spent_on desc);

alter table public.expenses enable row level security;
drop policy if exists "staff all expenses" on public.expenses;
create policy "staff all expenses" on public.expenses for all to authenticated using (public.is_staff()) with check (public.is_staff());
