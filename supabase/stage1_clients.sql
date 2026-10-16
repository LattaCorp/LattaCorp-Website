-- LattaCorp CRM, Stage 1: clients + properties.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run.
-- Safe to run more than once.

create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,
  company    text not null default '',
  email      text not null default '',
  phone      text not null default '',
  phone2     text not null default '',
  type       text not null default 'residential' check (type in ('residential','hoa','commercial')),
  archived   boolean not null default false,
  source     text not null default '',
  notes      text not null default ''
);
create index if not exists clients_name_idx on public.clients (lower(name));

create table if not exists public.properties (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  label      text not null default '',
  address    text not null default '',
  notes      text not null default ''          -- gate code, dogs, where to park, etc.
);
create index if not exists properties_client_idx on public.properties (client_id);

alter table public.leads add column if not exists client_id uuid references public.clients(id) on delete set null;

alter table public.clients    enable row level security;
alter table public.properties enable row level security;
drop policy if exists "staff all clients"    on public.clients;
drop policy if exists "staff all properties" on public.properties;
create policy "staff all clients"    on public.clients    for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all properties" on public.properties for all to authenticated using (public.is_staff()) with check (public.is_staff());
