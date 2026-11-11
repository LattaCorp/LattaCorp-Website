-- LattaCorp, Stage 40: your own events on the Schedule (estimate walk-throughs, supply runs, reminders, time off...).
-- They show on the Day, Week and Month views next to the job visits and can be dragged to another day.
-- Safe to run more than once.
create table if not exists public.cal_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  event_date  date not null,
  start_time  time,
  title       text not null,
  kind        text not null default 'other',   -- walkthrough, supplies, reminder, timeoff, other
  notes       text not null default '',
  client_id   uuid references public.clients(id) on delete set null,
  done        boolean not null default false,
  created_by  text not null default ''
);
create index if not exists cal_events_date_idx on public.cal_events (event_date);
alter table public.cal_events enable row level security;
drop policy if exists "staff all cal_events" on public.cal_events;
create policy "staff all cal_events" on public.cal_events for all to authenticated using (public.is_staff()) with check (public.is_staff());
notify pgrst, 'reload schema';
