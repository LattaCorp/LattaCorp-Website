-- LattaCorp CRM, Stage 21: extra contacts on a client (spouse, board members, property manager...).
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- Requires Stage 1 (clients).
create table if not exists public.client_contacts (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  name       text not null default '',
  role       text not null default '',
  phone      text not null default '',
  email      text not null default '',
  notes      text not null default ''
);
create index if not exists client_contacts_client_idx on public.client_contacts (client_id, created_at);

alter table public.client_contacts enable row level security;
drop policy if exists "staff all client_contacts" on public.client_contacts;
create policy "staff all client_contacts" on public.client_contacts for all to authenticated using (public.is_staff()) with check (public.is_staff());
