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
