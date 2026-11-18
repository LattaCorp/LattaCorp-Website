-- Stage 55: in the client portal, the account holder chooses which of their other contacts also get the invoice emails.
-- portal_contacts now returns gets_invoices; portal_contact_save takes p_invoices (null = leave as it is), and only the
-- account holder (or staff) can change it. The old 7-argument version is replaced by this one.
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
                   'id', cc.id, 'name', cc.name, 'role', cc.role, 'portal_access', cc.portal_access, 'gets_invoices', cc.gets_invoices,
                   'phone', case when mgr or cc.id = mine then cc.phone else '' end,
                   'email', case when mgr or cc.id = mine then cc.email else '' end) order by cc.created_at), '[]'::json)
                  from public.client_contacts cc where cc.client_id = cid));
end $$;

drop function if exists public.portal_contact_save(uuid, uuid, text, text, text, text, boolean);
create or replace function public.portal_contact_save(cid uuid, contact uuid, p_name text, p_role text, p_phone text, p_email text, p_access boolean, p_invoices boolean default null)
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
  inv boolean;
begin
  if cid is null or cid not in (select public.portal_client_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into c from public.clients where id = cid;
  mgr := public.is_staff() or lower(trim(coalesce(c.email, ''))) = me;
  if nm = '' then raise exception 'name_required'; end if;
  if em <> '' and em !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then raise exception 'bad_email'; end if;
  if ac and em = '' then raise exception 'email_required'; end if;
  if p_invoices and em = '' then raise exception 'invoice_email_required'; end if;
  if contact is null then
    if not mgr then raise exception 'not allowed' using errcode = '42501'; end if;
    if (select count(*) from public.client_contacts where client_id = cid) >= 15 then raise exception 'too_many'; end if;
    insert into public.client_contacts (client_id, name, role, phone, email, portal_access, gets_invoices)
    values (cid, nm, rl, ph, em, ac, coalesce(p_invoices, false) and em <> '') returning * into r;
  else
    select * into r from public.client_contacts where id = contact and client_id = cid;
    if r.id is null then raise exception 'not found'; end if;
    if mgr then
      inv := coalesce(p_invoices, r.gets_invoices) and em <> '';
      update public.client_contacts set name = nm, role = rl, phone = ph, email = em, portal_access = ac, gets_invoices = inv
       where id = r.id returning * into r;
    elsif r.portal_access and lower(trim(r.email)) = me then
      -- a contact changing their own entry: they keep their role, their access and their invoice setting
      if em = '' then raise exception 'email_required'; end if;
      update public.client_contacts set name = nm, phone = ph, email = em where id = r.id returning * into r;
    else
      raise exception 'not allowed' using errcode = '42501';
    end if;
  end if;
  return json_build_object('id', r.id);
end $$;
revoke all on function public.portal_contact_save(uuid, uuid, text, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.portal_contact_save(uuid, uuid, text, text, text, text, boolean, boolean) to authenticated;
