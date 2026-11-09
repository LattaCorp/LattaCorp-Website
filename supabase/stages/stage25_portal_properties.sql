-- LattaCorp, Stage 25: Client portal, one box per property.
-- HOAs and management companies often have several properties billed separately. portal_account now also returns
-- "sites": each billed or serviced property with its own balance, past-due amount, next due date, last invoice and
-- next visit. Invoices and payments carry a "site" key so the portal can filter them by property.
-- Safe to run more than once.

create or replace function public.portal_account(cid uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  me text := public.portal_email();
  today date := (now() at time zone 'America/New_York')::date;
  c public.clients;
  ccr public.client_contacts;
  inv json; pays json; vis json; hist json; props json; contacts json; photos json; reqs json; biz json; who json; sites json;
  bal numeric := 0; credit numeric := 0; past_due numeric := 0; oldest date; next_visit json; acct_status text;
begin
  if cid is null or cid not in (select public.portal_client_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into c from public.clients where id = cid;

  -- who is looking: the account holder, an Other contact with portal access, or LattaCorp staff (master view)
  select * into ccr from public.client_contacts
   where client_id = cid and portal_access and lower(trim(email)) = me limit 1;
  if lower(trim(coalesce(c.email, ''))) = me then
    who := json_build_object('name', c.name, 'role', 'Account holder', 'staff', false);
  elsif ccr.id is not null then
    who := json_build_object('name', ccr.name, 'role', coalesce(nullif(ccr.role, ''), 'Contact'), 'staff', false);
  else
    who := json_build_object('name', (select coalesce(nullif(st.name, ''), st.email) from public.staff st where lower(st.email) = me limit 1),
                             'role', 'LattaCorp staff', 'staff', true);
  end if;

  -- invoices with what has been paid on each
  with p as (select invoice_id, sum(amount) amt from public.invoice_payments where client_id = cid and invoice_id is not null group by invoice_id),
       i as (select v.*, coalesce(p.amt, 0) paid,
                    case when v.status = 'open' then greatest(0, round(v.total - coalesce(p.amt, 0), 2)) else 0 end balance
               from public.invoices v left join p on p.invoice_id = v.id
              where v.client_id = cid and v.status <> 'void')
  select coalesce(json_agg(json_build_object(
           'id', i.id, 'number', i.number, 'issue_date', i.issue_date, 'due_date', i.due_date,
           'period_start', i.period_start, 'period_end', i.period_end, 'total', i.total, 'paid', i.paid,
           'balance', i.balance, 'status', case when i.status = 'open' and i.balance > 0 and i.due_date < today then 'past_due'
                                                when i.status = 'open' and i.balance > 0 then 'due'
                                                when i.status = 'open' then 'paid' else i.status end,
           'token', i.share_token, 'property', pr.label, 'address', pr.address,
           'site', lower(trim(coalesce(nullif(pr.address, ''), pr.label))))
           order by i.issue_date desc, i.number desc), '[]'::json),
         coalesce(sum(i.balance), 0),
         coalesce(sum(i.balance) filter (where i.due_date < today), 0),
         min(i.due_date) filter (where i.balance > 0 and i.due_date < today)
    into inv, bal, past_due, oldest
    from i left join public.properties pr on pr.id = i.property_id;

  select coalesce(sum(amount), 0) into credit from public.invoice_payments where client_id = cid and invoice_id is null;

  select coalesce(json_agg(json_build_object('date', x.paid_on, 'amount', x.amount, 'method', x.method, 'invoice', v.number,
                                         'site', lower(trim(coalesce(nullif(pr.address, ''), pr.label))))
           order by x.paid_on desc, x.created_at desc), '[]'::json)
    into pays
    from public.invoice_payments x left join public.invoices v on v.id = x.invoice_id
    left join public.properties pr on pr.id = v.property_id
   where x.client_id = cid;

  -- upcoming visits: scheduled from today on (next 120 days)
  select coalesce(json_agg(json_build_object(
           'date', x.scheduled_date, 'status', x.status, 'done_at', x.completed_at, 'delayed_from', x.weather_from,
           'service', coalesce(nullif(j.title, ''), s.name, 'Service visit'), 'property', pr.label, 'address', pr.address)
           order by x.scheduled_date), '[]'::json)
    into vis
    from public.visits x
    left join public.jobs j on j.id = x.job_id
    left join public.services s on s.id = j.service_id
    left join public.properties pr on pr.id = x.property_id
   where x.client_id = cid
     and x.status = 'scheduled' and x.scheduled_date between today and today + 120;

  -- past visits also come from the dated lines on their invoices (older history was billed before visits were tracked)
  select coalesce(json_agg(h order by h->>'date' desc), '[]'::json) into hist from (
    select json_build_object('date', x.scheduled_date, 'service', coalesce(nullif(j.title, ''), s.name, 'Service visit'),
                             'property', pr.label, 'address', pr.address, 'delayed_from', x.weather_from) h
      from public.visits x left join public.jobs j on j.id = x.job_id left join public.services s on s.id = j.service_id
      left join public.properties pr on pr.id = x.property_id
     where x.client_id = cid and x.status = 'done' and x.scheduled_date >= today - 730
    union all
    select json_build_object('date', it.service_date, 'service', it.description, 'property', null,
                             'address', nullif(it.address, ''), 'delayed_from', null)
      from public.invoice_items it join public.invoices v on v.id = it.invoice_id
     where v.client_id = cid and v.status <> 'void' and it.service_date is not null and it.service_date >= today - 730
       and (it.visit_id is null or not exists (select 1 from public.visits x2 where x2.id = it.visit_id and x2.status = 'done'))
  ) t;

  select json_build_object('date', x.scheduled_date, 'service', coalesce(nullif(j.title, ''), 'Service visit'), 'address', pr.address)
    into next_visit
    from public.visits x left join public.jobs j on j.id = x.job_id left join public.properties pr on pr.id = x.property_id
   where x.client_id = cid and x.status = 'scheduled' and x.scheduled_date >= today
   order by x.scheduled_date limit 1;

  select coalesce(json_agg(json_build_object('id', id, 'label', label, 'address', address) order by created_at), '[]'::json)
    into props from public.properties where client_id = cid;

  select coalesce(json_agg(json_build_object('name', name, 'role', role) order by created_at), '[]'::json)
    into contacts from public.client_contacts where client_id = cid;

  select coalesce(json_agg(json_build_object('id', ph.id, 'path', ph.path, 'thumb', ph.thumb_path, 'caption', ph.caption,
           'kind', ph.kind, 'date', ph.created_at, 'property', pr.label) order by ph.created_at desc), '[]'::json)
    into photos
    from public.photos ph left join public.properties pr on pr.id = ph.property_id
   where ph.client_id = cid and ph.expense_id is null and ph.kind <> 'receipt';

  select coalesce(json_agg(json_build_object('date', l.created_at, 'kind', l.kind, 'status', l.status, 'service', l.service)
           order by l.created_at desc), '[]'::json)
    into reqs from public.leads l where l.client_id = cid;

  select json_build_object('name', b.name, 'phone', b.phone, 'email', b.email, 'zelle', b.zelle,
                           'payment_note', b.payment_note, 'terms_days', b.terms_days)
    into biz from public.business b limit 1;

  -- Each property that is billed or serviced, with its own balance (an HOA or manager can have several, billed
  -- separately). Property records with the same address count as one. Properties with no invoices, no visits and no
  -- active job (like a billing office address) are left out.
  with ps as (select p.*, lower(trim(coalesce(nullif(p.address, ''), p.label))) k from public.properties p where p.client_id = cid),
       pay as (select invoice_id, sum(amount) amt from public.invoice_payments where client_id = cid and invoice_id is not null group by invoice_id),
       iv as (select v.*, ps.k,
                     case when v.status = 'open' then greatest(0, round(v.total - coalesce(pay.amt, 0), 2)) else 0 end ob
                from public.invoices v join ps on ps.id = v.property_id left join pay on pay.invoice_id = v.id
               where v.client_id = cid and v.status <> 'void'),
       g as (select ps.k, min(ps.created_at) first_at,
                    (array_agg(ps.address order by length(coalesce(ps.address, '')) desc))[1] address,
                    (array_agg(nullif(ps.label, '') order by ps.created_at))[1] label
               from ps group by ps.k)
  select coalesce(json_agg(json_build_object(
           'key', g.k,
           'name', coalesce(nullif(trim(split_part(g.address, ',', 1)), ''), g.label, g.address),
           'address', g.address,
           'balance', coalesce((select sum(iv.ob) from iv where iv.k = g.k), 0),
           'past_due', coalesce((select sum(iv.ob) from iv where iv.k = g.k and iv.due_date < today), 0),
           'next_due', (select min(due_date) from iv where iv.k = g.k and iv.ob > 0 and due_date >= today),
           'invoices', (select count(*) from iv where iv.k = g.k),
           'last_invoice', (select json_build_object('number', number, 'date', issue_date, 'total', total)
                              from iv where iv.k = g.k order by issue_date desc, number desc limit 1),
           'next_visit', (select min(x.scheduled_date) from public.visits x join ps on ps.id = x.property_id
                           where ps.k = g.k and x.status = 'scheduled' and x.scheduled_date >= today))
           order by (select max(issue_date) from iv where iv.k = g.k) desc nulls last, g.first_at), '[]'::json)
    into sites
    from g
   where exists (select 1 from iv where iv.k = g.k)
      or exists (select 1 from public.visits x join ps on ps.id = x.property_id where ps.k = g.k and x.status in ('scheduled', 'done'))
      or exists (select 1 from public.jobs j join ps on ps.id = j.property_id where ps.k = g.k and j.status = 'active');

  bal := greatest(0, round(bal - credit, 2));
  acct_status := case
    when past_due > 0 and bal > 0 then 'past_due'
    when bal > 0 then 'due'
    when next_visit is null and not exists (select 1 from public.jobs where client_id = cid and status = 'active') then 'paused'
    else 'active' end;

  return json_build_object(
    'client', json_build_object('id', c.id, 'name', c.name, 'nickname', c.nickname, 'company', c.company, 'type', c.type,
                                'phone', c.phone, 'phone2', c.phone2, 'email', c.email),
    'me', who,
    'summary', json_build_object('status', acct_status, 'balance', bal, 'credit', credit, 'past_due', least(past_due, bal),
                                 'past_due_since', oldest, 'next_visit', next_visit, 'today', today),
    'invoices', inv, 'payments', pays, 'upcoming', vis, 'history', hist, 'properties', props, 'contacts', contacts,
    'photos', photos, 'requests', reqs, 'business', biz, 'sites', sites);
end $$;

revoke all on function public.portal_account(uuid) from public, anon;
grant execute on function public.portal_account(uuid) to authenticated;
