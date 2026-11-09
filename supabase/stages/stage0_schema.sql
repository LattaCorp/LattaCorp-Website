-- LattaCorp CRM, Phase 1: leads inbox.
-- Run this once in Supabase: SQL Editor > New query > paste everything > Run.

-- 1) Who is allowed into the CRM (staff). Add more people later with: insert into staff values ('someone@example.com');
create table if not exists public.staff (email text primary key);
alter table public.staff enable row level security;   -- no policies: the browser can never read this table
insert into public.staff (email) values ('lattacorpofcentralfl@gmail.com') on conflict do nothing;

create or replace function public.is_staff() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.staff where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- 2) Leads: every website form submission lands here.
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind       text not null,                      -- Quote request / Service request / Contact message / Proposal request
  lang       text,
  name       text,
  email      text,
  phone      text,
  address    text,
  service    text,
  fields     jsonb not null default '[]'::jsonb,  -- everything the visitor filled in, in order
  photo_count int not null default 0,
  status     text not null default 'new' check (status in ('new','contacted','quoted','won','lost')),
  notes      text not null default ''
);
create index if not exists leads_created_idx on public.leads (created_at desc);

alter table public.leads enable row level security;
drop policy if exists "staff read leads"   on public.leads;
drop policy if exists "staff update leads" on public.leads;
drop policy if exists "staff delete leads" on public.leads;
create policy "staff read leads"   on public.leads for select to authenticated using (public.is_staff());
create policy "staff update leads" on public.leads for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff delete leads" on public.leads for delete to authenticated using (public.is_staff());
-- No insert policy on purpose: only the website's server code (using the secret key) can add leads.
