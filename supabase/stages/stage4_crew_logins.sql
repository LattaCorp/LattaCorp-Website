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
