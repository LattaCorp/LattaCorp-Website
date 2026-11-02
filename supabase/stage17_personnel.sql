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
