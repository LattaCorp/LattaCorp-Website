-- LattaCorp, Stage 42: clients manage the people on their own account from the client portal, and every change to
-- a client's contacts (by the client or by staff) is kept in an archive that staff can read in the CRM.
-- Safe to run more than once. Requires Stage 21 (client_contacts) and Stage 23/24 (client portal).

-- 1. The archive: one row per change, with what the contact looked like at that moment.
create table if not exists public.client_contact_log (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  contact_id    uuid,
  action        text not null,               -- added | changed | removed
  by_email      text not null default '',
  by_who        text not null default '',    -- client | staff | system
  name          text not null default '',
  role          text not null default '',
  phone         text not null default '',
  email         text not null default '',
  portal_access boolean not null default false,
  was           jsonb
);
create index if not exists client_contact_log_client_idx on public.client_contact_log (client_id, created_at desc);
comment on table public.client_contact_log is 'CRM › Clients: archive of every change to a client''s contacts (who, when, old and new values).';
alter table public.client_contact_log enable row level security;
drop policy if exists "staff read client_contact_log" on public.client_contact_log;
create policy "staff read client_contact_log" on public.client_contact_log for select to authenticated using (public.is_staff());

create or replace function public.client_contact_log_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me  text := lower(coalesce(auth.jwt() ->> 'email', ''));
  who text := case when public.is_staff() then 'staff' when me <> '' then 'client' else 'system' end;
begin
  if tg_table_name = 'clients' then
    if new.phone is distinct from old.phone or new.phone2 is distinct from old.phone2 or new.email is distinct from old.email then
      insert into public.client_contact_log (client_id, contact_id, action, by_email, by_who, name, role, phone, email, portal_access, was)
      values (new.id, null, 'changed', me, who, new.name, 'Account holder',
              concat_ws(' / ', nullif(new.phone, ''), nullif(new.phone2, '')), coalesce(new.email, ''), coalesce(new.portal_access, false),
              jsonb_build_object('phone', concat_ws(' / ', nullif(old.phone, ''), nullif(old.phone2, '')), 'email', coalesce(old.email, '')));
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    insert into public.client_contact_log (client_id, contact_id, action, by_email, by_who, name, role, phone, email, portal_access)
    values (new.client_id, new.id, 'added', me, who, new.name, new.role, new.phone, new.email, new.portal_access);
    return new;
  elsif tg_op = 'UPDATE' then
    if (new.name, new.role, new.phone, new.email, new.portal_access) is distinct from (old.name, old.role, old.phone, old.email, old.portal_access) then
      insert into public.client_contact_log (client_id, contact_id, action, by_email, by_who, name, role, phone, email, portal_access, was)
      values (new.client_id, new.id, 'changed', me, who, new.name, new.role, new.phone, new.email, new.portal_access,
              jsonb_build_object('name', old.name, 'role', old.role, 'phone', old.phone, 'email', old.email, 'portal_access', old.portal_access));
    end if;
    return new;
  else
    -- when the whole client is being deleted its contacts go with it, and so does the archive: nothing to write
    if exists (select 1 from public.clients where id = old.client_id) then
      insert into public.client_contact_log (client_id, contact_id, action, by_email, by_who, name, role, phone, email, portal_access)
      values (old.client_id, old.id, 'removed', me, who, old.name, old.role, old.phone, old.email, old.portal_access);
    end if;
    return old;
  end if;
end $$;
revoke all on function public.client_contact_log_trg() from public, anon, authenticated;

drop trigger if exists client_contacts_log on public.client_contacts;
create trigger client_contacts_log after insert or update or delete on public.client_contacts
  for each row execute function public.client_contact_log_trg();
drop trigger if exists clients_contact_log on public.clients;
create trigger clients_contact_log after update of phone, phone2, email on public.clients
  for each row execute function public.client_contact_log_trg();

-- 2. Portal: the people on an account. The account holder (and LattaCorp staff) can add, change and remove people;
--    a contact with portal access can only change their own entry.
create or replace function public.portal_contacts(cid uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  me text := public.portal_email();
  c public.clients;
  mgr boolean;
  mine uuid;
begin
  if cid is null or cid not in (select public.portal_client_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into c from public.clients where id = cid;
  mgr := public.is_staff() or lower(trim(coalesce(c.email, ''))) = me;
  select id into mine from public.client_contacts
   where client_id = cid and portal_access and lower(trim(email)) = me order by created_at limit 1;
  return json_build_object(
    'can_manage', mgr, 'my_contact_id', mine,
    'holder', json_build_object('name', c.name, 'email', case when mgr then c.email else '' end,
                                'phone', case when mgr then c.phone else '' end, 'phone2', case when mgr then c.phone2 else '' end),
    'contacts', (select coalesce(json_agg(json_build_object(
                   'id', cc.id, 'name', cc.name, 'role', cc.role, 'portal_access', cc.portal_access,
                   'phone', case when mgr or cc.id = mine then cc.phone else '' end,
                   'email', case when mgr or cc.id = mine then cc.email else '' end) order by cc.created_at), '[]'::json)
                  from public.client_contacts cc where cc.client_id = cid));
end $$;

create or replace function public.portal_contact_save(cid uuid, contact uuid, p_name text, p_role text, p_phone text, p_email text, p_access boolean)
returns json language plpgsql security definer set search_path = public as $$
declare
  me text := public.portal_email();
  c public.clients;
  r public.client_contacts;
  mgr boolean;
  nm text := left(trim(coalesce(p_name, '')), 120);
  rl text := left(trim(coalesce(p_role, '')), 80);
  ph text := left(trim(coalesce(p_phone, '')), 40);
  em text := lower(left(trim(coalesce(p_email, '')), 200));
  ac boolean := coalesce(p_access, false);
begin
  if cid is null or cid not in (select public.portal_client_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into c from public.clients where id = cid;
  mgr := public.is_staff() or lower(trim(coalesce(c.email, ''))) = me;
  if nm = '' then raise exception 'name_required'; end if;
  if em <> '' and em !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then raise exception 'bad_email'; end if;
  if ac and em = '' then raise exception 'email_required'; end if;
  if contact is null then
    if not mgr then raise exception 'not allowed' using errcode = '42501'; end if;
    if (select count(*) from public.client_contacts where client_id = cid) >= 15 then raise exception 'too_many'; end if;
    insert into public.client_contacts (client_id, name, role, phone, email, portal_access)
    values (cid, nm, rl, ph, em, ac) returning * into r;
  else
    select * into r from public.client_contacts where id = contact and client_id = cid;
    if r.id is null then raise exception 'not found'; end if;
    if mgr then
      update public.client_contacts set name = nm, role = rl, phone = ph, email = em, portal_access = ac where id = r.id returning * into r;
    elsif r.portal_access and lower(trim(r.email)) = me then
      -- a contact changing their own entry: they keep their role and their access
      if em = '' then raise exception 'email_required'; end if;
      update public.client_contacts set name = nm, phone = ph, email = em where id = r.id returning * into r;
    else
      raise exception 'not allowed' using errcode = '42501';
    end if;
  end if;
  return json_build_object('id', r.id);
end $$;

create or replace function public.portal_contact_remove(cid uuid, contact uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  me text := public.portal_email();
  c public.clients;
begin
  if cid is null or cid not in (select public.portal_client_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into c from public.clients where id = cid;
  if not (public.is_staff() or lower(trim(coalesce(c.email, ''))) = me) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.client_contacts where id = contact and client_id = cid;
  return json_build_object('ok', true);
end $$;

-- the account holder's own phone numbers (their sign-in email is changed by LattaCorp, so nobody locks themselves out)
create or replace function public.portal_holder_phone(cid uuid, p_phone text, p_phone2 text) returns json
language plpgsql security definer set search_path = public as $$
declare
  me text := public.portal_email();
  c public.clients;
begin
  if cid is null or cid not in (select public.portal_client_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into c from public.clients where id = cid;
  if not (public.is_staff() or lower(trim(coalesce(c.email, ''))) = me) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.clients set phone = left(trim(coalesce(p_phone, '')), 40), phone2 = left(trim(coalesce(p_phone2, '')), 40) where id = cid;
  return json_build_object('ok', true);
end $$;

revoke all on function public.portal_contacts(uuid) from public, anon;
revoke all on function public.portal_contact_save(uuid, uuid, text, text, text, text, boolean) from public, anon;
revoke all on function public.portal_contact_remove(uuid, uuid) from public, anon;
revoke all on function public.portal_holder_phone(uuid, text, text) from public, anon;
grant execute on function public.portal_contacts(uuid) to authenticated;
grant execute on function public.portal_contact_save(uuid, uuid, text, text, text, text, boolean) to authenticated;
grant execute on function public.portal_contact_remove(uuid, uuid) to authenticated;
grant execute on function public.portal_holder_phone(uuid, text, text) to authenticated;
