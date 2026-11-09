-- LattaCorp: COMPLETE DATABASE SETUP (website + Foreman CRM), as of Stage 22 (Nov 2026).
-- Builds the whole database from nothing, in the right order. Checked against the live Supabase project.
-- You do NOT need to run this on the existing database: it is already set up. It is for rebuilding
-- from scratch (a new Supabase project) and as one place to read how everything fits together.
-- Each part is safe to run more than once. The individual steps are kept in supabase/stages/.


-- ==========================================================================================
-- stage0_schema.sql
-- ==========================================================================================
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

-- ==========================================================================================
-- stage1_clients.sql
-- ==========================================================================================
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

-- ==========================================================================================
-- stage2_jobs.sql
-- ==========================================================================================
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

-- ==========================================================================================
-- stage3_calendar.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 3: crew members, who a job/visit is assigned to, and route order for each day.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.

create table if not exists public.crew (
  id     uuid primary key default gen_random_uuid(),
  name   text not null,
  phone  text not null default '',
  active boolean not null default true
);

alter table public.jobs   add column if not exists crew_id uuid references public.crew(id) on delete set null;
alter table public.visits add column if not exists crew_id uuid references public.crew(id) on delete set null;
alter table public.visits add column if not exists sort_order int not null default 0;

alter table public.crew enable row level security;
drop policy if exists "staff all crew" on public.crew;
create policy "staff all crew" on public.crew for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ==========================================================================================
-- stage4_crew_logins.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 4: crew logins with a very limited view.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- Run the Stage 3 SQL first (it creates the crew table).

alter table public.crew add column if not exists kind    text not null default 'temp' check (kind in ('temp','login'));
alter table public.crew add column if not exists user_id uuid;
alter table public.crew add column if not exists email   text not null default '';
create unique index if not exists crew_user_idx on public.crew (user_id) where user_id is not null;

-- A crew login has NO access to any table (the staff rules only match the owner's email).
-- The only things it can do are these three functions, which return/change only that person's own assigned stops.
-- They never include prices, client names, phone numbers or emails.

create or replace function public.crew_me() returns table(crew_id uuid, name text)
language sql security definer set search_path = public stable as $$
  select id, name from public.crew where user_id = auth.uid() and active;
$$;

create or replace function public.crew_route(p_from date, p_to date)
returns table(visit_id uuid, scheduled_date date, status text, sort_order int, job_title text, instructions text, address text, property_notes text)
language sql security definer set search_path = public stable as $$
  select v.id, v.scheduled_date, v.status, v.sort_order, j.title, j.instructions, p.address, p.notes
  from public.visits v
  join public.crew c       on c.id = v.crew_id
  join public.jobs j       on j.id = v.job_id
  join public.properties p on p.id = v.property_id
  where c.user_id = auth.uid() and c.active
    and v.scheduled_date between p_from and p_to
  order by v.scheduled_date, v.sort_order, v.created_at;
$$;

create or replace function public.crew_set_done(p_visit uuid, p_done boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_job uuid;
begin
  update public.visits v
     set status = case when p_done then 'done' else 'scheduled' end,
         completed_at = case when p_done then now() else null end
   where v.id = p_visit
     and v.status in ('scheduled','done')
     and v.crew_id in (select id from public.crew where user_id = auth.uid() and active)
  returning v.job_id into v_job;
  if v_job is not null then
    update public.jobs j set status = case when p_done then 'ended' else 'active' end
     where j.id = v_job and j.frequency = 'once';
  end if;
end;
$$;

revoke all on function public.crew_me()                      from public, anon;
revoke all on function public.crew_route(date, date)         from public, anon;
revoke all on function public.crew_set_done(uuid, boolean)   from public, anon;
grant execute on function public.crew_me()                    to authenticated;
grant execute on function public.crew_route(date, date)       to authenticated;
grant execute on function public.crew_set_done(uuid, boolean) to authenticated;

-- ==========================================================================================
-- stage5_billing.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 5: monthly billing (invoices, payments, payment-at-visit, your invoice details).
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.

-- Your invoice details (one row). Edit them in the CRM: Billing > Billing settings.
create table if not exists public.business (
  id           int primary key default 1 check (id = 1),
  name         text not null default 'LattaCorp of Central Florida',
  phone        text not null default '407-470-5309',
  email        text not null default 'lattacorpofcentralfl@gmail.com',
  address      text not null default '',
  zelle        text not null default '',
  payment_note text not null default 'Cash and check also accepted.',
  terms_days   int  not null default 10,
  footer       text not null default 'Thank you! Treating lawns with a Latta love!'
);
insert into public.business (id) values (1) on conflict (id) do nothing;

create table if not exists public.invoices (
  id           uuid primary key default gen_random_uuid(),
  number       int generated by default as identity unique,
  created_at   timestamptz not null default now(),
  client_id    uuid not null references public.clients(id) on delete restrict,   -- keeps financial records safe: archive clients instead of deleting
  issue_date   date not null default current_date,
  due_date     date not null,
  period_start date,
  period_end   date,
  status       text not null default 'open' check (status in ('open','paid','void')),
  reference    text not null default '',                                         -- PO / reference number (handy for HOAs)
  total        numeric(10,2) not null default 0,
  sent_at      timestamptz,
  paid_at      timestamptz,
  paid_method  text not null default '',
  notes        text not null default ''
);
create index if not exists invoices_client_idx on public.invoices (client_id);

create table if not exists public.invoice_items (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices(id) on delete cascade,
  visit_id     uuid references public.visits(id) on delete set null,
  service_date date,
  address      text not null default '',
  description  text not null,
  amount       numeric(10,2) not null default 0
);
create index if not exists invoice_items_inv_idx on public.invoice_items (invoice_id);

alter table public.visits add column if not exists invoice_id  uuid references public.invoices(id) on delete set null;
alter table public.visits add column if not exists paid_at     timestamptz;
alter table public.visits add column if not exists paid_method text not null default '';

alter table public.business      enable row level security;
alter table public.invoices      enable row level security;
alter table public.invoice_items enable row level security;
drop policy if exists "staff all business"      on public.business;
drop policy if exists "staff all invoices"      on public.invoices;
drop policy if exists "staff all invoice_items" on public.invoice_items;
create policy "staff all business"      on public.business      for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all invoices"      on public.invoices      for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all invoice_items" on public.invoice_items for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ==========================================================================================
-- stage5b_weather.sql
-- ==========================================================================================
-- LattaCorp CRM: weather delay with undo, plus smart catch-up.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- Remembers where each visit was pushed from so one tap can put it back.
alter table public.visits add column if not exists weather_from  date;
alter table public.visits add column if not exists weather_batch text;

-- ==========================================================================================
-- stage6_reminders.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 6: text reminders (remembers who you already texted).
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
alter table public.visits   add column if not exists reminded_at timestamptz;
alter table public.invoices add column if not exists reminded_at timestamptz;

-- ==========================================================================================
-- stage7_team.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 7: team logins (owner / co-owner and office staff).
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
alter table public.staff add column if not exists name    text not null default '';
alter table public.staff add column if not exists role    text not null default 'office';
alter table public.staff add column if not exists user_id uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'staff_role_check') then
    alter table public.staff add constraint staff_role_check check (role in ('owner','office'));
  end if;
end $$;

-- You are the owner. (Anyone added later through the Team screen picks their own role.)
update public.staff set role = 'owner' where lower(email) = 'lattacorpofcentralfl@gmail.com';
update public.staff set name = 'Matteo Latalladi' where lower(email) = 'lattacorpofcentralfl@gmail.com' and name = '';

-- Lets the CRM ask "what is my role?" after sign-in.
create or replace function public.staff_role() returns text
language sql security definer set search_path = public stable as $$
  select role from public.staff where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1;
$$;
revoke all on function public.staff_role() from public, anon;
grant execute on function public.staff_role() to authenticated;

-- ==========================================================================================
-- stage8_todos.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 8: shared to-do list for the team.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  title       text not null,
  notes       text not null default '',
  due_date    date,
  client_id   uuid references public.clients(id) on delete set null,
  assigned_to text not null default '',      -- a team member's email, or empty for "anyone"
  created_by  text not null default '',
  done        boolean not null default false,
  done_at     timestamptz,
  done_by     text not null default ''
);
create index if not exists todos_done_due_idx on public.todos (done, due_date);

alter table public.todos enable row level security;
drop policy if exists "staff all todos" on public.todos;
create policy "staff all todos" on public.todos for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Lets every team member see the names to pick from when assigning a task.
create or replace function public.team_names() returns table(email text, name text)
language sql security definer set search_path = public stable as $$
  select s.email, s.name from public.staff s where public.is_staff() order by s.name, s.email;
$$;
revoke all on function public.team_names() from public, anon;
grant execute on function public.team_names() to authenticated;

-- ==========================================================================================
-- stage9_expenses.sql
-- ==========================================================================================
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

-- ==========================================================================================
-- stage10_photos.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 10: photos (client profiles, visits, expense receipts, and the Photos library).
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.

-- 1) A private storage bucket for the picture files (5 MB max each, pictures only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "staff read photos"   on storage.objects;
drop policy if exists "staff add photos"    on storage.objects;
drop policy if exists "staff delete photos" on storage.objects;
create policy "staff read photos"   on storage.objects for select to authenticated using (bucket_id = 'photos' and public.is_staff());
create policy "staff add photos"    on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_staff());
create policy "staff delete photos" on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_staff());

-- 2) One row per photo: who/what it belongs to, a caption, and its size (so the Photos tab can show space used).
create table if not exists public.photos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  client_id   uuid references public.clients(id)  on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  visit_id    uuid references public.visits(id)   on delete set null,
  expense_id  uuid references public.expenses(id) on delete set null,
  kind        text not null default 'other',       -- before / after / property / issue / receipt / other
  caption     text not null default '',
  path        text not null,                        -- the full picture in the bucket
  thumb_path  text,                                 -- a small preview in the bucket
  size_bytes  integer not null default 0,
  width       integer,
  height      integer,
  created_by  text not null default ''
);
create index if not exists photos_client_idx  on public.photos (client_id);
create index if not exists photos_created_idx on public.photos (created_at desc);

alter table public.photos enable row level security;
drop policy if exists "staff all photos" on public.photos;
create policy "staff all photos" on public.photos for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ==========================================================================================
-- stage11_links.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 11: private invoice/estimate links + estimates.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- (Choose the option WITHOUT RLS if asked; this script turns RLS on itself.)
-- Requires Stage 5 (invoices) to have been run first.

-- 1) Every invoice gets a private, unguessable link code (64 random hex characters).
alter table public.invoices add column if not exists share_token text;
alter table public.invoices add column if not exists viewed_at   timestamptz;
update public.invoices set share_token = replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','') where share_token is null;
alter table public.invoices alter column share_token set default (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''));
create unique index if not exists invoices_share_token_idx on public.invoices (share_token);

-- 2) Estimates
create table if not exists public.estimates (
  id            uuid primary key default gen_random_uuid(),
  number        int generated by default as identity unique,
  created_at    timestamptz not null default now(),
  client_id     uuid not null references public.clients(id) on delete restrict,
  title         text not null default '',
  scope         text not null default '',
  issue_date    date not null default current_date,
  valid_until   date,
  status        text not null default 'draft' check (status in ('draft','sent','accepted','declined')),
  total         numeric(10,2) not null default 0,
  sent_at       timestamptz,
  viewed_at     timestamptz,
  responded_at  timestamptz,
  response_name text not null default '',
  response_note text not null default '',
  share_token   text unique not null default (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''))
);
create index if not exists estimates_client_idx on public.estimates (client_id);

create table if not exists public.estimate_items (
  id          uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  description text not null,
  amount      numeric(10,2) not null default 0
);
create index if not exists estimate_items_est_idx on public.estimate_items (estimate_id);

alter table public.estimates      enable row level security;
alter table public.estimate_items enable row level security;
drop policy if exists "staff all estimates"      on public.estimates;
drop policy if exists "staff all estimate_items" on public.estimate_items;
create policy "staff all estimates"      on public.estimates      for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all estimate_items" on public.estimate_items for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 3) (peek = the team previewing a link, so it is not counted as the client opening it.)
--    The public page asks for ONE document by its secret code. Nothing else is readable without logging in.
--    Returns only what a client should see (no email, phone, notes or other clients).
drop function if exists public.public_doc(text);
create or replace function public.public_doc(tok text, peek boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare
  inv public.invoices; est public.estimates; cl public.clients; b public.business; items json;
  bz json;
begin
  if tok is null or length(tok) < 32 then return null; end if;
  select * into b from public.business where id = 1;
  bz := json_build_object('name', b.name, 'phone', b.phone, 'email', b.email, 'address', b.address,
                          'zelle', b.zelle, 'payment_note', b.payment_note, 'footer', b.footer);

  select * into inv from public.invoices where share_token = tok;
  if found then
    select * into cl from public.clients where id = inv.client_id;
    select coalesce(json_agg(json_build_object('date', i.service_date, 'description', i.description, 'address', i.address, 'amount', i.amount)
                             order by i.service_date nulls last, i.description), '[]'::json)
      into items from public.invoice_items i where i.invoice_id = inv.id;
    if not peek and inv.viewed_at is null then update public.invoices set viewed_at = now() where id = inv.id; end if;
    return json_build_object('kind', 'invoice',
      'doc', json_build_object('number', inv.number, 'issue_date', inv.issue_date, 'due_date', inv.due_date, 'status', inv.status,
                               'total', inv.total, 'reference', inv.reference, 'paid_at', inv.paid_at, 'paid_method', inv.paid_method),
      'items', items, 'client', json_build_object('name', cl.name, 'company', cl.company), 'business', bz);
  end if;

  select * into est from public.estimates where share_token = tok;
  if found then
    select * into cl from public.clients where id = est.client_id;
    select coalesce(json_agg(json_build_object('description', i.description, 'amount', i.amount) order by i.id), '[]'::json)
      into items from public.estimate_items i where i.estimate_id = est.id;
    if not peek and est.viewed_at is null then update public.estimates set viewed_at = now() where id = est.id; end if;
    return json_build_object('kind', 'estimate',
      'doc', json_build_object('number', est.number, 'title', est.title, 'scope', est.scope, 'issue_date', est.issue_date, 'valid_until', est.valid_until,
                               'status', est.status, 'total', est.total, 'responded_at', est.responded_at, 'response_name', est.response_name),
      'items', items, 'client', json_build_object('name', cl.name, 'company', cl.company), 'business', bz);
  end if;
  return null;
end $$;

-- 4) The client taps Accept or Decline on an estimate page.
create or replace function public.respond_estimate(tok text, decision text, who text, note text) returns json
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if tok is null or length(tok) < 32 or decision not in ('accepted','declined') then return json_build_object('ok', false); end if;
  if decision = 'accepted' and length(trim(coalesce(who,''))) = 0 then return json_build_object('ok', false, 'reason', 'name'); end if;
  update public.estimates
     set status = decision, responded_at = now(), response_name = left(trim(coalesce(who,'')), 120), response_note = left(trim(coalesce(note,'')), 500)
   where share_token = tok and status in ('draft','sent')
     and (valid_until is null or valid_until >= (now() at time zone 'America/New_York')::date);
  get diagnostics n = row_count;
  return json_build_object('ok', n > 0, 'status', decision);
end $$;

revoke all on function public.public_doc(text,boolean)            from public;
revoke all on function public.respond_estimate(text,text,text,text) from public;
grant execute on function public.public_doc(text,boolean)            to anon, authenticated;
grant execute on function public.respond_estimate(text,text,text,text) to anon, authenticated;

-- ==========================================================================================
-- stage12_inventory.sql
-- ==========================================================================================
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

-- ==========================================================================================
-- stage13_expenses_tax.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 13: Expenses tab for taxes (Code, Date, Vendor, Description, Category, Payment, Receipt #, Amount, Tax, Total)
-- plus the Tax Report's equipment inventory sheets.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- Requires Stage 9 (expenses) and Stage 12 (inventory) to have been run first.

-- The existing "amount" column keeps the TOTAL paid (amount + tax), so Reports keep working. "note" is the Description.
alter table public.expenses add column if not exists code       text not null default '';
alter table public.expenses add column if not exists payment    text not null default '';
alter table public.expenses add column if not exists receipt_no text not null default '';
alter table public.expenses add column if not exists tax        numeric(10,2) not null default 0 check (tax >= 0);
create index if not exists expenses_vendor_idx on public.expenses (vendor);

-- Marks the two equipment sheets that live on the Reports > Tax Report page instead of the Inventory tab.
alter table public.inventory_cats add column if not exists kind text not null default '';

-- ==========================================================================================
-- stage14_inventory_colors.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 14: colour code for each Inventory category.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- Requires Stage 12 (inventory). Without this, colours still show but are not remembered if you add or delete categories.
alter table public.inventory_cats add column if not exists color text not null default '';

-- ==========================================================================================
-- stage15_pricing.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 15: saved rates and options for the lawn price calculator (CRM and website).
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- Requires Stage 5 (the business table). Without this, the calculators still work with the built-in starting rates,
-- but changes made under "Edit rates and options" cannot be saved and the website keeps using the built-in rates.
alter table public.business add column if not exists pricing jsonb not null default '{}'::jsonb;

-- The website calculator asks for the rates through this one function. It returns only the calculator settings
-- (rates and options), nothing else from the business table.
create or replace function public.public_pricing() returns json
language sql stable security definer set search_path = public as $$
  select coalesce((select pricing from public.business where id = 1), '{}'::jsonb)::json
$$;
revoke all on function public.public_pricing() from public;
grant execute on function public.public_pricing() to anon, authenticated;

-- ==========================================================================================
-- stage16_expense_tax_note.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 16: a tax description box on each expense (notes for your accountant).
alter table public.expenses add column if not exists tax_note text not null default '';

-- ==========================================================================================
-- stage17_personnel.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 17: Personnel (employee / contractor records, payroll, benefits, documents).
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
-- OWNERS ONLY: office staff and crew logins can never read any of this (Social Security numbers, pay, documents).

create or replace function public.is_owner() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.staff where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and role = 'owner');
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- 1) One row per person. The Employee ID (emp_no) is handed out automatically: 1, 2, 3...
create sequence if not exists public.personnel_no_seq;
create table if not exists public.personnel (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  emp_no       integer not null default nextval('public.personnel_no_seq'),
  full_name    text not null,
  gender       text not null default '',
  birthdate    date,
  address      text not null default '',
  city         text not null default '',
  state        text not null default 'FL',
  zip          text not null default '',
  phone        text not null default '',
  email        text not null default '',
  ssn          text not null default '',
  emergency_name  text not null default '',
  emergency_phone text not null default '',
  job_title    text not null default '',
  status       text not null default 'active' check (status in ('active','inactive','team')),
  start_date   date,
  end_date     date,
  notes        text not null default '',
  hourly_rate  numeric(10,2),
  photo_path   text,
  login_email  text not null default ''      -- set when a Team login was created for this person
);
create unique index if not exists personnel_emp_no_idx on public.personnel (emp_no);

-- 2) Payroll: every payment you made to the person (counts toward the Tax Report "Employee pay" box).
create table if not exists public.personnel_pay (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  person_id  uuid not null references public.personnel(id) on delete cascade,
  paid_on    date not null default current_date,
  amount     numeric(10,2) not null check (amount >= 0),
  hours      numeric(8,2),
  rate       numeric(10,2),
  method     text not null default 'cash' check (method in ('zelle','venmo','cashapp','cash','check')),
  note       text not null default ''
);
create index if not exists personnel_pay_person_idx on public.personnel_pay (person_id, paid_on desc);

-- 3) Benefits: anything you provide (bonus, PTO, phone stipend, uniform allowance...).
create table if not exists public.personnel_benefits (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  person_id  uuid not null references public.personnel(id) on delete cascade,
  title      text not null,
  details    text not null default '',
  value      numeric(10,2),
  starts_on  date
);
create index if not exists personnel_ben_person_idx on public.personnel_benefits (person_id);

-- 4) Documents (W-9, ID copy, signed agreement, insurance...): the files live in a private bucket.
create table if not exists public.personnel_docs (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  person_id  uuid not null references public.personnel(id) on delete cascade,
  title      text not null default '',
  kind       text not null default 'other',
  path       text not null,
  size_bytes integer not null default 0
);
create index if not exists personnel_docs_person_idx on public.personnel_docs (person_id);

do $$ declare t text; begin
  foreach t in array array['personnel','personnel_pay','personnel_benefits','personnel_docs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner all %s" on public.%I', t, t);
    execute format('create policy "owner all %s" on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())', t, t);
  end loop;
end $$;

-- 5) Private bucket for ID photos and documents (10 MB each: pictures and PDFs only). Owners only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('personnel', 'personnel', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists "owner read personnel files"   on storage.objects;
drop policy if exists "owner add personnel files"    on storage.objects;
drop policy if exists "owner delete personnel files" on storage.objects;
create policy "owner read personnel files"   on storage.objects for select to authenticated using (bucket_id = 'personnel' and public.is_owner());
create policy "owner add personnel files"    on storage.objects for insert to authenticated with check (bucket_id = 'personnel' and public.is_owner());
create policy "owner delete personnel files" on storage.objects for delete to authenticated using (bucket_id = 'personnel' and public.is_owner());

-- ==========================================================================================
-- stage18_payments.sql
-- ==========================================================================================
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

-- ==========================================================================================
-- stage19_client_names.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 19: client last name (for sorting) and preferred name / nickname.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
alter table public.clients add column if not exists last_name text not null default '';
alter table public.clients add column if not exists nickname  text not null default '';

-- ==========================================================================================
-- stage20_bill_by_property.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 20: bill by property.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.

-- Per client: send a separate invoice for each property (default off = one combined invoice).
alter table public.clients  add column if not exists bill_by_property boolean not null default false;

-- Per invoice: which property it was billed to (empty = the whole account).
alter table public.invoices add column if not exists property_id uuid references public.properties(id) on delete set null;

-- ==========================================================================================
-- stage21_client_contacts.sql
-- ==========================================================================================
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

-- ==========================================================================================
-- stage22_table_labels.sql
-- ==========================================================================================
-- LattaCorp CRM, Stage 22: a plain-English label on every table, shown in Supabase's Table Editor.
-- Labels only: nothing about the data or the app changes. Safe to run more than once.
comment on table public.leads            is 'WEBSITE → CRM › Leads: quote requests, service requests and job applications sent from lattacorpfl.com. Shown in the CRM Leads tab.';
comment on table public.clients          is 'CRM › Clients: one row per client account (name, phone, email, type, notes).';
comment on table public.client_contacts  is 'CRM › Clients: extra contacts on a client (spouse, board member, property manager...).';
comment on table public.properties       is 'CRM › Clients: service addresses. A client can have several; one is labeled Main.';
comment on table public.photos           is 'CRM › Photos: job, property and receipt photos, linked to a client, property, visit or expense. Files live in the photos storage bucket.';
comment on table public.services         is 'CRM › Jobs: the list of services you offer (mowing, edging...), used when creating jobs.';
comment on table public.jobs             is 'CRM › Jobs: recurring or one-time work for a client property, with price and frequency.';
comment on table public.visits           is 'CRM › Schedule: each scheduled or completed visit for a job (date, crew, done, weather delay).';
comment on table public.crew             is 'CRM › Schedule: crew members who receive daily routes (text-only or with a login).';
comment on table public.invoices         is 'CRM › Billing: one row per invoice (number, client, dates, total, status).';
comment on table public.invoice_items    is 'CRM › Billing: the line items on each invoice.';
comment on table public.invoice_payments is 'CRM › Billing: customer payments, applied to an invoice or on account.';
comment on table public.estimates        is 'CRM › Billing: estimates / quotes sent to clients.';
comment on table public.estimate_items   is 'CRM › Billing: the line items on each estimate.';
comment on table public.business         is 'CRM › Billing: business settings (name, phone, Zelle info, invoice terms and footer, price calculator rates). Single row.';
comment on table public.expenses         is 'CRM › Expenses: business expenses and receipts, used for the Tax Report.';
comment on table public.inventory_cats   is 'CRM › Inventory: inventory categories and their colors.';
comment on table public.inventory_items  is 'CRM › Inventory: items in stock, by category.';
comment on table public.personnel        is 'CRM › Personnel: employee records (owner-only access).';
comment on table public.personnel_pay    is 'CRM › Personnel: payroll payments to employees (owner-only).';
comment on table public.personnel_benefits is 'CRM › Personnel: benefits and allowances per employee (owner-only).';
comment on table public.personnel_docs   is 'CRM › Personnel: documents on file per employee (owner-only).';
comment on table public.todos            is 'CRM › To-Do: tasks and reminders.';
comment on table public.staff            is 'CRM › Team: who can sign in to the CRM and their role (owner or office).';
