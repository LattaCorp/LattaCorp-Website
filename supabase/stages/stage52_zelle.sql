-- Stage 52: Zelle payments read from Bank of America "you received money" emails.
-- The website receives each forwarded alert, reads the amount, sender and memo, and either records the payment
-- on the matching invoice (a sure match) or keeps it here for one-tap matching in Billing.
create table if not exists public.zelle_payments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  message_id  text unique,                 -- the email's Message-ID, so a re-sent alert is never counted twice
  received_on date not null default ((now() at time zone 'America/New_York')::date),
  amount      numeric(12,2),
  sender      text,
  memo        text,
  subject     text,
  body        text,                        -- plain text of the email (trimmed), shown when matching by hand
  verified    boolean not null default false, -- the email provably came from Bank of America
  status      text not null default 'unmatched'
              check (status in ('recorded','suggested','unmatched','ignored','other')),
  invoice_id  uuid references public.invoices(id) on delete set null,
  client_id   uuid references public.clients(id) on delete set null,
  payment_id  uuid references public.invoice_payments(id) on delete set null,
  reason      text                         -- why it was matched (or not), in plain words
);
create index if not exists zelle_payments_status_idx on public.zelle_payments (status, created_at desc);

-- the owner can switch automatic recording off (then every alert waits for a tap)
alter table public.business add column if not exists zelle_auto boolean not null default true;

alter table public.zelle_payments enable row level security;
drop policy if exists "staff all zelle_payments" on public.zelle_payments;
create policy "staff all zelle_payments" on public.zelle_payments for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Stage 52b: one Zelle payment can pay several invoices (oldest first); Undo takes them all back.
alter table public.zelle_payments add column if not exists invoice_ids uuid[] not null default '{}';
alter table public.zelle_payments add column if not exists payment_ids uuid[] not null default '{}';
