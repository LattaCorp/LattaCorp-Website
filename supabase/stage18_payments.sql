-- LattaCorp CRM, Stage 18: customer payments (partial or full payments applied to invoices, with history).
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- Requires Stage 5 (invoices).
create table if not exists public.invoice_payments (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  client_id  uuid references public.clients(id) on delete set null,
  paid_on    date not null default current_date,
  amount     numeric(10,2) not null check (amount > 0),
  method     text not null default 'Zelle',
  reference  text not null default '',
  note       text not null default ''
);
create index if not exists invoice_payments_invoice_idx on public.invoice_payments (invoice_id);
create index if not exists invoice_payments_client_idx  on public.invoice_payments (client_id, paid_on desc);

alter table public.invoice_payments enable row level security;
drop policy if exists "staff all invoice_payments" on public.invoice_payments;
create policy "staff all invoice_payments" on public.invoice_payments for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Stage 18b: a payment does not have to be applied to an invoice (payment on account).
alter table public.invoice_payments alter column invoice_id drop not null;
