-- LattaCorp, Stage 44: phone notifications (Web Push) for owners and office staff, and a switch for the website form emails.
-- These tables are read and written only by the website server (secret key); nobody can reach them from the browser.

create table if not exists public.app_secrets (
  name  text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;   -- no policies: server only

create table if not exists public.push_devices (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email      text not null,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  label      text not null default '',
  last_ok_at timestamptz
);
create index if not exists push_devices_email_idx on public.push_devices (lower(email));
alter table public.push_devices enable row level security;  -- no policies: server only

create table if not exists public.push_prefs (
  email      text primary key,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.push_prefs enable row level security;    -- no policies: server only

-- Website form emails: 'all' (every form), 'photos' (only forms with photos attached, since photos aren't saved in Foreman), 'off'
alter table public.business add column if not exists form_emails text not null default 'all';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'business_form_emails_chk') then
    alter table public.business add constraint business_form_emails_chk check (form_emails in ('all','photos','off'));
  end if;
end $$;
