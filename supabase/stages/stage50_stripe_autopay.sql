-- LattaCorp CRM, Stage 50: bank (ACH) automatic payments through Stripe.
-- Writes come only from the website server (service key); clients and staff can only read their own rows.
alter table public.clients add column if not exists stripe_customer_id text;
alter table public.business add column if not exists autopay_on boolean not null default false;

create table if not exists public.autopay_methods (
  client_id      uuid primary key references public.clients(id) on delete restrict,
  agreement_id   uuid references public.signed_agreements(id) on delete restrict,
  stripe_customer text not null,
  stripe_pm      text not null,
  stripe_mandate text,
  kind           text not null check (kind in ('ach', 'card')),
  bank_name      text,
  last4          text,
  status         text not null default 'active' check (status in ('active', 'rejected', 'removed')),
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.autopay_charges (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references public.invoices(id) on delete restrict,
  client_id      uuid not null references public.clients(id) on delete restrict,
  payment_intent text unique,
  amount         numeric not null,
  status         text not null default 'processing' check (status in ('processing', 'succeeded', 'failed')),
  failure        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists autopay_charges_invoice on public.autopay_charges (invoice_id, created_at desc);

alter table public.autopay_methods enable row level security;
alter table public.autopay_charges enable row level security;
drop policy if exists "account and staff read methods" on public.autopay_methods;
create policy "account and staff read methods" on public.autopay_methods for select to authenticated using (client_id in (select public.portal_client_ids()));
drop policy if exists "account and staff read charges" on public.autopay_charges;
create policy "account and staff read charges" on public.autopay_charges for select to authenticated using (client_id in (select public.portal_client_ids()));
revoke insert, update, delete, truncate on public.autopay_methods, public.autopay_charges from anon, authenticated;
