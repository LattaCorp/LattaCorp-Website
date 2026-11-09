-- LattaCorp, Stage 23: Client portal (lattacorpfl.com/portal/).
-- Clients sign in with an emailed code. They never get direct access to CRM tables: every CRM table stays
-- staff-only. Instead these "my account" lookups return only the signed-in person's own account(s).
-- Who can sign in:
--   * the client's main email (clients.portal_access, on by default; turn off to block)
--   * any Other contact whose "Portal access" box is ticked (client_contacts.portal_access, off by default)
-- Safe to run more than once.

-- 1) Access switches
alter table public.clients         add column if not exists portal_access boolean not null default true;
alter table public.client_contacts add column if not exists portal_access boolean not null default false;
alter table public.clients         add column if not exists portal_invited_at timestamptz;
comment on column public.clients.portal_access is 'Client portal: the main email may sign in (on by default).';
comment on column public.client_contacts.portal_access is 'Client portal: this contact may sign in to this account (off until ticked).';

-- 2) Sign-in code requests (server-only; used to stop someone flooding an inbox with codes)
create table if not exists public.portal_signins (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email      text not null,
  sent       boolean not null default false
);
create index if not exists portal_signins_email_idx on public.portal_signins (email, created_at desc);
alter table public.portal_signins enable row level security;  -- no policies: only the server (secret key) reads/writes it
comment on table public.portal_signins is 'PORTAL › Sign-in: each sign-in code request, used for rate limiting. Server-only.';

-- 3) Which accounts the signed-in person may see
create or replace function public.portal_email() returns text
language sql stable set search_path = public as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', '')))
$$;

create or replace function public.portal_client_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.id from public.clients c
   where c.portal_access and not c.archived and public.portal_email() <> ''
     and lower(trim(c.email)) = public.portal_email()
  union
  select cc.client_id from public.client_contacts cc join public.clients c on c.id = cc.client_id
   where cc.portal_access and not c.archived and public.portal_email() <> ''
     and lower(trim(cc.email)) = public.portal_email()
$$;

-- Used by the server before it sends a sign-in code: is this email allowed into the portal?
create or replace function public.portal_email_allowed(e text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clients c
                  where c.portal_access and not c.archived and lower(trim(c.email)) = lower(trim(e)) and trim(e) <> '')
      or exists (select 1 from public.client_contacts cc join public.clients c on c.id = cc.client_id
                  where cc.portal_access and not c.archived and lower(trim(cc.email)) = lower(trim(e)) and trim(e) <> '')
$$;

-- The accounts list (for people linked to more than one, like a property manager)
create or replace function public.portal_accounts() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', c.id, 'name', c.name, 'company', c.company, 'type', c.type) order by c.name), '[]'::json)
    from public.clients c where c.id in (select public.portal_client_ids())
$$;

-- 4) Everything the portal shows for one account. Internal notes, prices of individual visits, crew,
--    receipts and anything about other clients are never included.
create or replace function public.portal_account(cid uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  me text := public.portal_email();
  today date := (now() at time zone 'America/New_York')::date;
  c public.clients;
  inv json; pays json; vis json; hist json; props json; contacts json; photos json; reqs json; biz json; who json;
  bal numeric := 0; credit numeric := 0; past_due numeric := 0; oldest date; next_visit json; acct_status text;
begin
  if cid is null or cid not in (select public.portal_client_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into c from public.clients where id = cid;

  select json_build_object('name', coalesce(cc.name, c.name), 'role', coalesce(nullif(cc.role, ''), case when cc.id is null then 'Account holder' else 'Contact' end))
    into who
    from (select 1) x left join public.client_contacts cc
      on cc.client_id = cid and cc.portal_access and lower(trim(cc.email)) = me and lower(trim(c.email)) <> me;

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
           'token', i.share_token, 'property', pr.label, 'address', pr.address)
           order by i.issue_date desc, i.number desc), '[]'::json),
         coalesce(sum(i.balance), 0),
         coalesce(sum(i.balance) filter (where i.due_date < today), 0),
         min(i.due_date) filter (where i.balance > 0 and i.due_date < today)
    into inv, bal, past_due, oldest
    from i left join public.properties pr on pr.id = i.property_id;

  select coalesce(sum(amount), 0) into credit from public.invoice_payments where client_id = cid and invoice_id is null;

  select coalesce(json_agg(json_build_object('date', x.paid_on, 'amount', x.amount, 'method', x.method, 'invoice', v.number)
           order by x.paid_on desc, x.created_at desc), '[]'::json)
    into pays
    from public.invoice_payments x left join public.invoices v on v.id = x.invoice_id
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
    'photos', photos, 'requests', reqs, 'business', biz);
end $$;

-- Only signed-in people may call the portal lookups (and they only ever get their own accounts).
revoke all on function public.portal_client_ids()      from public, anon;
revoke all on function public.portal_accounts()        from public, anon;
revoke all on function public.portal_account(uuid)     from public, anon;
revoke all on function public.portal_email_allowed(text) from public, anon, authenticated;
grant execute on function public.portal_accounts()    to authenticated;
grant execute on function public.portal_account(uuid) to authenticated;
grant execute on function public.portal_client_ids()  to authenticated;
grant execute on function public.portal_email_allowed(text) to service_role;

-- 5) Photos: a signed-in client may open the photo files that belong to their own account (not receipts).
create or replace function public.portal_photo_ok(obj text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.photos ph
                  where (ph.path = obj or ph.thumb_path = obj)
                    and ph.expense_id is null and ph.kind <> 'receipt'
                    and ph.client_id in (select public.portal_client_ids()))
$$;
revoke all on function public.portal_photo_ok(text) from public, anon;
grant execute on function public.portal_photo_ok(text) to authenticated;
drop policy if exists "portal read own photos" on storage.objects;
create policy "portal read own photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.portal_photo_ok(name));
