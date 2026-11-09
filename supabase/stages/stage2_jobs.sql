-- LattaCorp CRM, Stage 2: services catalog, jobs (one-time / weekly / every 2 weeks) and visits.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.

create table if not exists public.services (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  default_price numeric(10,2),
  active        boolean not null default true
);

create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  service_id   uuid references public.services(id) on delete set null,
  title        text not null,
  instructions text not null default '',
  price        numeric(10,2) not null default 0,
  frequency    text not null default 'weekly' check (frequency in ('once','weekly','biweekly')),
  start_date   date not null,
  end_date     date,
  status       text not null default 'active' check (status in ('active','paused','ended'))
);
create index if not exists jobs_client_idx on public.jobs (client_id);

create table if not exists public.visits (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  job_id         uuid not null references public.jobs(id) on delete cascade,
  client_id      uuid not null references public.clients(id) on delete cascade,
  property_id    uuid not null references public.properties(id) on delete cascade,
  orig_date      date not null,                 -- the date the schedule generated (never changes)
  scheduled_date date not null,                 -- where it sits now (changes if you move it)
  status         text not null default 'scheduled' check (status in ('scheduled','done','skipped')),
  price          numeric(10,2) not null default 0,
  completed_at   timestamptz,
  notes          text not null default '',
  unique (job_id, orig_date)
);
create index if not exists visits_date_idx on public.visits (scheduled_date);

alter table public.services enable row level security;
alter table public.jobs     enable row level security;
alter table public.visits   enable row level security;
drop policy if exists "staff all services" on public.services;
drop policy if exists "staff all jobs"     on public.jobs;
drop policy if exists "staff all visits"   on public.visits;
create policy "staff all services" on public.services for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all jobs"     on public.jobs     for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all visits"   on public.visits   for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Starter services (rename, re-price or remove them in the CRM any time)
insert into public.services (name) values
  ('Lawn maintenance - Basic'), ('Lawn maintenance - Plus'), ('Lawn maintenance - Premier'),
  ('Tree and hedge trimming'), ('Mulching'), ('Yard cleanup')
on conflict (name) do nothing;
