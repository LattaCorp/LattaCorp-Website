-- LattaCorp, Stage 26: Invoice redesign (account numbers, payment methods, account summary).
-- 1. Every client gets an account number (oldest client first, starting at 1001). New clients get the next one
--    automatically. Staff can change any number on the client page (for example, to match GroundsKeeper); numbers
--    must be unique.
-- 2. Business settings get a "We accept" line for invoices.
-- 3. The private invoice link (public_doc) now also returns the service period, the account number, the "We accept"
--    line, and an account summary: unpaid balance from earlier invoices (and how much of it is past due), payments
--    on this invoice, credit on the account, and the total amount due. For clients billed by property, the
--    summary only counts that property's invoices.
-- Safe to run more than once.

-- 1. Account numbers
create sequence if not exists public.client_account_no_seq start 1001;
alter table public.clients add column if not exists account_no integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_account_no_key') then
    alter table public.clients add constraint clients_account_no_key unique (account_no);
  end if;
end $$;

-- the next free number (skips any number a person typed in by hand)
create or replace function public.next_account_no() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  loop
    n := nextval('public.client_account_no_seq');
    exit when not exists (select 1 from public.clients where account_no = n);
  end loop;
  return n;
end $$;
revoke all on function public.next_account_no() from public, anon, authenticated;

create or replace function public.clients_set_account_no() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.account_no is null then new.account_no := public.next_account_no(); end if;
  return new;
end $$;
drop trigger if exists clients_account_no on public.clients;
create trigger clients_account_no before insert on public.clients
  for each row execute function public.clients_set_account_no();

do $$
declare r record;
begin
  for r in select id from public.clients where account_no is null order by created_at, id loop
    update public.clients set account_no = public.next_account_no() where id = r.id;
  end loop;
end $$;
comment on column public.clients.account_no is 'Client account number shown on invoices and in the portal. Editable; must be unique.';

-- 2. "We accept" line
alter table public.business add column if not exists accepts text not null
  default 'Zelle, Cash, Check, Credit/Debit Card, Automated Payments';

-- 3. Private invoice and estimate link
create or replace function public.public_doc(tok text, peek boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare
  inv public.invoices; est public.estimates; cl public.clients; b public.business; items json; bz json;
  today date := (now() at time zone 'America/New_York')::date;
  by_prop boolean; this_paid numeric := 0; prev numeric := 0; prev_late numeric := 0; credit numeric := 0;
  this_bal numeric := 0; prop_addr text;
begin
  if tok is null or length(tok) < 32 then return null; end if;
  select * into b from public.business where id = 1;
  bz := json_build_object('name', b.name, 'phone', b.phone, 'email', b.email, 'address', b.address,
                          'zelle', b.zelle, 'payment_note', b.payment_note, 'footer', b.footer, 'accepts', b.accepts);

  select * into inv from public.invoices where share_token = tok;
  if found then
    select * into cl from public.clients where id = inv.client_id;
    select coalesce(json_agg(json_build_object('date', i.service_date, 'description', i.description, 'address', i.address, 'amount', i.amount)
                             order by i.service_date nulls last, i.description), '[]'::json)
      into items from public.invoice_items i where i.invoice_id = inv.id;
    if not peek and inv.viewed_at is null then update public.invoices set viewed_at = now() where id = inv.id; end if;

    -- account summary, as of today
    by_prop := coalesce(cl.bill_by_property, false) and inv.property_id is not null;
    select coalesce(sum(amount), 0) into this_paid from public.invoice_payments where invoice_id = inv.id;
    this_bal := case when inv.status = 'open' then greatest(0, round(inv.total - this_paid, 2)) else 0 end;
    with p as (select invoice_id, sum(amount) amt from public.invoice_payments where client_id = inv.client_id and invoice_id is not null group by invoice_id),
         e as (select v.due_date, greatest(0, round(v.total - coalesce(p.amt, 0), 2)) bal
                 from public.invoices v left join p on p.invoice_id = v.id
                where v.client_id = inv.client_id and v.status = 'open' and v.id <> inv.id
                  and (v.issue_date < inv.issue_date or (v.issue_date = inv.issue_date and v.number < inv.number))
                  and (not by_prop or v.property_id = inv.property_id))
    select coalesce(sum(bal), 0), coalesce(sum(bal) filter (where due_date < today), 0) into prev, prev_late from e;
    if not by_prop then
      select coalesce(sum(amount), 0) into credit from public.invoice_payments where client_id = inv.client_id and invoice_id is null;
    end if;
    if inv.property_id is not null then select address into prop_addr from public.properties where id = inv.property_id; end if;

    return json_build_object('kind', 'invoice',
      'doc', json_build_object('number', inv.number, 'issue_date', inv.issue_date, 'due_date', inv.due_date, 'status', inv.status,
                               'total', inv.total, 'reference', inv.reference, 'paid_at', inv.paid_at, 'paid_method', inv.paid_method,
                               'period_start', inv.period_start, 'period_end', inv.period_end, 'property_address', prop_addr),
      'summary', json_build_object('previous', prev, 'previous_past_due', prev_late, 'this_total', inv.total,
                                   'this_paid', this_paid, 'this_balance', this_bal, 'credit', credit,
                                   'by_property', by_prop, 'today', today,
                                   'total_due', greatest(0, round(prev + this_bal - credit, 2))),
      'items', items,
      'client', json_build_object('name', cl.name, 'company', cl.company, 'account_no', cl.account_no),
      'business', bz);
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
      'items', items, 'client', json_build_object('name', cl.name, 'company', cl.company, 'account_no', cl.account_no), 'business', bz);
  end if;
  return null;
end $$;
grant execute on function public.public_doc(text, boolean) to anon, authenticated;

-- 4. The client portal shows the account number too (same as Stage 25, plus account_no).
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
                                'phone', c.phone, 'phone2', c.phone2, 'email', c.email, 'account_no', c.account_no),
    'me', who,
    'summary', json_build_object('status', acct_status, 'balance', bal, 'credit', credit, 'past_due', least(past_due, bal),
                                 'past_due_since', oldest, 'next_visit', next_visit, 'today', today),
    'invoices', inv, 'payments', pays, 'upcoming', vis, 'history', hist, 'properties', props, 'contacts', contacts,
    'photos', photos, 'requests', reqs, 'business', biz, 'sites', sites);
end $$;

revoke all on function public.portal_account(uuid) from public, anon;
grant execute on function public.portal_account(uuid) to authenticated;
