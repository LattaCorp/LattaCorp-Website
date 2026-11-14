-- LattaCorp CRM, Stage 46: route check-off (free extras + completion notes) and Messages.
-- Safe to run more than once.

-- ---------- Route check-off ----------
-- What was also done at no charge (hedge, weeds) and the crew's note. Both print on the invoice line.
alter table public.visits add column if not exists done_extras text[] not null default '{}';
alter table public.visits add column if not exists done_note text;

drop function if exists public.crew_route(date, date);
create function public.crew_route(p_from date, p_to date)
returns table(visit_id uuid, scheduled_date date, status text, sort_order integer, job_title text, instructions text,
              address text, property_notes text, done_extras text[], done_note text)
language sql stable security definer set search_path = public as $$
  select v.id, v.scheduled_date, v.status, v.sort_order, j.title, j.instructions, p.address, p.notes, v.done_extras, v.done_note
  from public.visits v
  join public.crew c       on c.id = v.crew_id
  join public.jobs j       on j.id = v.job_id
  join public.properties p on p.id = v.property_id
  where c.user_id = auth.uid() and c.active
    and v.scheduled_date between p_from and p_to
  order by v.scheduled_date, v.sort_order, v.created_at;
$$;
revoke all on function public.crew_route(date, date) from public, anon;
grant execute on function public.crew_route(date, date) to authenticated;

drop function if exists public.crew_set_done(uuid, boolean);
drop function if exists public.crew_set_done(uuid, boolean, text[], text);
create function public.crew_set_done(p_visit uuid, p_done boolean, p_extras text[] default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_job uuid;
begin
  update public.visits v
     set status = case when p_done then 'done' else 'scheduled' end,
         completed_at = case when p_done then now() else null end,
         -- crew can only tick the free extras; nothing they pick here changes a price
         done_extras = case when p_done then coalesce(array(select distinct e from unnest(coalesce(p_extras, v.done_extras)) e
                                                            where e in ('hedge', 'weeds')), '{}') else v.done_extras end,
         done_note = case when p_done and p_note is not null then nullif(left(trim(p_note), 500), '') else v.done_note end
   where v.id = p_visit
     and v.status in ('scheduled','done')
     and v.invoice_id is null
     and v.crew_id in (select id from public.crew where user_id = auth.uid() and active)
  returning v.job_id into v_job;
  if v_job is not null then
    update public.jobs j set status = case when p_done then 'ended' else 'active' end
     where j.id = v_job and j.frequency = 'once';
  end if;
end;
$$;
revoke all on function public.crew_set_done(uuid, boolean, text[], text) from public, anon;
grant execute on function public.crew_set_done(uuid, boolean, text[], text) to authenticated;

-- ---------- Messages ----------
-- Rooms: 'all' (everyone, crew too), 'office' (owners + office), 'dm:<user id>:<user id>' (two people, ids sorted).
create or replace function public.chat_member(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff s where s.user_id = p_uid)
      or exists (select 1 from public.staff s join auth.users u on lower(u.email) = lower(s.email) where u.id = p_uid)
      or exists (select 1 from public.crew c where c.user_id = p_uid and c.active and c.kind = 'login');
$$;
create or replace function public.chat_can(p_room text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare a uuid; b uuid;
begin
  if auth.uid() is null then return false; end if;
  if p_room = 'all' then return public.chat_member(auth.uid()); end if;
  if p_room = 'office' then return public.is_staff(); end if;
  if p_room ~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$' then
    a := split_part(p_room, ':', 2)::uuid; b := split_part(p_room, ':', 3)::uuid;
    return a < b and auth.uid() in (a, b) and public.chat_member(a) and public.chat_member(b);
  end if;
  return false;
end;
$$;
revoke all on function public.chat_member(uuid) from public, anon;
revoke all on function public.chat_can(text) from public, anon;
grant execute on function public.chat_member(uuid) to authenticated;
grant execute on function public.chat_can(text) to authenticated;

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  room        text not null,
  sender_id   uuid not null default auth.uid(),
  sender_name text not null default '',
  body        text not null default '',
  photo_path  text,
  ref_kind    text check (ref_kind in ('client', 'job')),
  ref_id      uuid,
  constraint messages_has_content check (length(trim(body)) > 0 or photo_path is not null),
  constraint messages_body_len check (length(body) <= 4000)
);
create index if not exists messages_room_time on public.messages (room, created_at desc);
alter table public.messages enable row level security;
drop policy if exists "members read their rooms" on public.messages;
create policy "members read their rooms" on public.messages for select to authenticated using (public.chat_can(room));
drop policy if exists "members post as themselves" on public.messages;
create policy "members post as themselves" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.chat_can(room));
drop policy if exists "senders delete their own" on public.messages;
create policy "senders delete their own" on public.messages for delete to authenticated using (sender_id = auth.uid());

create table if not exists public.chat_reads (
  user_id uuid not null default auth.uid(),
  room    text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, room)
);
alter table public.chat_reads enable row level security;
drop policy if exists "own read marks" on public.chat_reads;
create policy "own read marks" on public.chat_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Everyone who can be messaged (no emails or phone numbers for crew to see).
create or replace function public.chat_people()
returns table(user_id uuid, name text, kind text)
language sql stable security definer set search_path = public as $$
  select x.user_id, x.name, x.kind from (
    select coalesce(s.user_id, u.id) as user_id, coalesce(nullif(s.name, ''), split_part(s.email, '@', 1)) as name,
           case when s.role = 'owner' then 'owner' else 'office' end as kind
      from public.staff s left join auth.users u on lower(u.email) = lower(s.email)
    union all
    select c.user_id, c.name, 'crew' from public.crew c where c.active and c.kind = 'login' and c.user_id is not null
  ) x
  where x.user_id is not null and public.chat_member(auth.uid())
  order by x.kind = 'crew', x.name;
$$;
revoke all on function public.chat_people() from public, anon;
grant execute on function public.chat_people() to authenticated;

-- My rooms with their latest message and how many I haven't read.
create or replace function public.chat_rooms()
returns table(room text, last_at timestamptz, last_body text, last_name text, unread integer)
language sql stable security definer set search_path = public as $$
  with mine as (
    select distinct m.room from public.messages m
     where m.room in ('all', 'office') or (m.room like 'dm:%' and m.room like '%' || auth.uid()::text || '%')
  ), ok as (select r.room from mine r where public.chat_can(r.room))
  select ok.room,
         l.created_at, case when l.body = '' then '📷 Photo' else left(l.body, 120) end, l.sender_name,
         (select count(*)::int from public.messages m2
           where m2.room = ok.room and m2.sender_id <> auth.uid()
             and m2.created_at > coalesce((select read_at from public.chat_reads cr where cr.user_id = auth.uid() and cr.room = ok.room), '-infinity'))
  from ok
  cross join lateral (select * from public.messages m where m.room = ok.room order by m.created_at desc limit 1) l
  order by l.created_at desc;
$$;
revoke all on function public.chat_rooms() from public, anon;
grant execute on function public.chat_rooms() to authenticated;

-- Photos in messages: private bucket, folder = room.
insert into storage.buckets (id, name, public) values ('chat', 'chat', false) on conflict (id) do nothing;
drop policy if exists "chat members add photos" on storage.objects;
create policy "chat members add photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and public.chat_can((storage.foldername(name))[1]));
drop policy if exists "chat members read photos" on storage.objects;
create policy "chat members read photos" on storage.objects for select to authenticated
  using (bucket_id = 'chat' and public.chat_can((storage.foldername(name))[1]));
