-- LattaCorp CRM, Stage 48: signed Service Agreements and Automatic Payment Authorizations.
-- Clients sign in the portal. Signed records (and the agreement texts they signed) can never be changed or deleted,
-- by clients or by staff: a trigger refuses every UPDATE and DELETE. Autopay cancellations are added as events.
-- Safe to run more than once.

create table if not exists public.agreement_versions (
  id          text primary key,
  kind        text not null check (kind in ('service', 'autopay')),
  title       text not null,
  body        text not null,
  body_sha256 text not null,
  effective   date not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.signed_agreements (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete restrict,
  version_id    text not null references public.agreement_versions(id) on delete restrict,
  kind          text not null check (kind in ('service', 'autopay')),
  body_sha256   text not null,
  details       jsonb not null default '{}'::jsonb,
  method        text check (method in ('ach', 'card')),
  typed_name    text not null check (length(trim(typed_name)) between 2 and 120),
  signer_title  text,
  signer_email  text not null,
  signer_user   uuid,
  signature_png text not null check (signature_png like 'data:image/png;base64,%' and length(signature_png) < 400000),
  ip            text,
  user_agent    text,
  signed_at     timestamptz not null default now(),
  check (kind <> 'autopay' or method is not null)
);
create index if not exists signed_agreements_client on public.signed_agreements (client_id, signed_at desc);

create table if not exists public.agreement_events (
  id           uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.signed_agreements(id) on delete restrict,
  kind         text not null check (kind in ('autopay_cancelled')),
  by_email     text not null,
  note         text,
  at           timestamptz not null default now()
);

-- Nothing signed can be edited or removed (a new version or an event is added instead).
create or replace function public.agreements_are_permanent() returns trigger
language plpgsql as $$
begin
  if tg_table_name = 'agreement_versions' and tg_op = 'UPDATE'
     and new.body = old.body and new.title = old.title and new.kind = old.kind and new.id = old.id and new.body_sha256 = old.body_sha256 then
    return new; -- only turning a version on/off is allowed
  end if;
  raise exception 'Signed agreements are permanent and cannot be changed or deleted.' using errcode = '42501';
end;
$$;
drop trigger if exists keep_signed on public.signed_agreements;
create trigger keep_signed before update or delete on public.signed_agreements for each row execute function public.agreements_are_permanent();
drop trigger if exists keep_events on public.agreement_events;
create trigger keep_events before update or delete on public.agreement_events for each row execute function public.agreements_are_permanent();
drop trigger if exists keep_versions on public.agreement_versions;
create trigger keep_versions before update or delete on public.agreement_versions for each row execute function public.agreements_are_permanent();

alter table public.agreement_versions enable row level security;
alter table public.signed_agreements enable row level security;
alter table public.agreement_events enable row level security;
drop policy if exists "anyone signed in reads agreement texts" on public.agreement_versions;
create policy "anyone signed in reads agreement texts" on public.agreement_versions for select to authenticated using (true);
drop policy if exists "account and staff read signed" on public.signed_agreements;
create policy "account and staff read signed" on public.signed_agreements for select to authenticated
  using (client_id in (select public.portal_client_ids()));
drop policy if exists "account and staff read events" on public.agreement_events;
create policy "account and staff read events" on public.agreement_events for select to authenticated
  using (agreement_id in (select id from public.signed_agreements where client_id in (select public.portal_client_ids())));
revoke insert, update, delete, truncate on public.signed_agreements, public.agreement_events, public.agreement_versions from anon, authenticated;

insert into public.agreement_versions (id, kind, title, body, body_sha256, effective) values
  ('service-2026-11-14', 'service', 'Service Agreement', $agr$This Service Agreement is between LattaCorp Of Central Florida ("LattaCorp," "we," "us") of Kissimmee, Florida, and the client named above ("you"). It covers the property and service plan shown above and any other work we do for you.

## 1. The agreement
1.1 **What makes up the agreement.** This Service Agreement, any quote or estimate you approve, and our Terms of Service at lattacorpfl.com/terms are one agreement. If they conflict, this order wins: (a) a signed HOA or commercial contract or board-approved proposal, (b) this Service Agreement, (c) an approved quote or estimate, (d) the Terms of Service.
1.2 **Who may sign.** The person signing confirms they own the property, or are authorized to order and pay for service on behalf of the owner, association or business named above.
1.3 **Other people on the account.** People you add to your client portal account (such as a spouse, board member or property manager) may request service and see invoices. You remain responsible for the account.

## 2. Services and schedule
2.1 **Scope.** We perform the services in your plan or approved quote. Anything not listed is extra work, priced and approved separately before we do it, except small add-ons you request on site, which are billed at our listed rates.
2.2 **Schedule.** Recurring visits happen on your scheduled day, Monday through Saturday. During cooler months, weekly lawns may be serviced every other week so the grass isn't stressed; we tell you before the change.
2.3 **Weather.** Rain, storms, lightning, wet ground or extreme heat can delay a visit. We move it to the next available day. A weather delay is not a missed visit.
2.4 **Access.** You agree to give our crew safe access on your service day: gates unlocked or a gate code provided, pets secured, and toys, hoses, furniture and loose items cleared. If we arrive and can't safely do the work, the visit may be charged.
2.5 **Your responsibilities.** You agree to:
- tell us about anything hidden or fragile in the work area, such as sprinkler heads, shallow pipes, buried cables, invisible pet fences, landscape lighting, septic parts or drain lines;
- water new plants and sod as we instruct;
- get any HOA, landlord or government approval a project needs, unless we agree in writing to do it;
- tell us before a visit about anyone on the property with allergies or sensitivities to plants, pollen or lawn treatments.
2.6 **Crew and subcontractors.** Our employees do the work. We may use qualified subcontractors for specialized work; we stay responsible for their work under this agreement. We are an independent contractor, not your employee or agent.

## 3. Prices, billing and ways to pay
3.1 **Prices.** Your price is shown above or on your approved quote. We may change recurring prices with at least 30 days' written notice; you may cancel before the new price starts. Signed HOA and commercial contract prices change only as that contract allows.
3.2 **Invoices.** We invoice at the start of each month for the prior month's completed visits and add-ons, unless your quote says otherwise. Invoices are emailed and are always available in your client portal. Payment is due by the Payment Due date on the invoice. Payments apply to your oldest balance first.
3.3 **Ways to pay.** Residential accounts may pay by bank (ACH) automatic payment, Zelle, cash or credit card. HOA and commercial accounts may pay by any of those or by check. We do not accept debit or prepaid cards. Bank (ACH), Zelle, cash and check payments have no fee.
3.4 **Zelle and checks.** Zelle payments go to 407-470-5309 (LattaCorp) and must include your invoice number in the note. Checks must be made payable to "LattaCorp Of Central Florida" and should include your invoice number in the memo. We will apply a payment we can't match once it is identified.
3.5 **Credit card surcharge.** Paying by credit card adds a surcharge equal to 3% of the payment, or our actual cost of accepting the card if lower. The surcharge is shown before you confirm payment, listed separately on your receipt, and refunded if the payment is refunded.
3.6 **Debit and prepaid cards.** We do not accept debit or prepaid cards. If one is entered, the payment will be declined, and you can pay by bank (ACH) at no cost instead.
3.7 **Taxes.** Any sales tax that applies to a service is added to the invoice as required by Florida law.

## 4. Late, returned and disputed payments
4.1 **Late fees.** Residential accounts: a $10 late fee is added when an invoice is 10 days past due, and a finance charge of 1.5% per month (18% per year) is added to any balance still unpaid 30 days past due. HOA and commercial accounts: past-due balances are charged 1.5% per month. Finance charges never exceed the highest rate Florida law allows.
4.2 **Returned payments.** If a bank (ACH) payment or check is returned unpaid for any reason, you owe the payment plus the service charge allowed by Florida Statutes section 68.065: $25 if the payment was $50 or less, $30 if it was over $50 up to $300, $40 if it was over $300, or 5% of the payment if that is more. After two returned payments in 12 months we may require payment by Zelle, cash or credit card.
4.3 **Pausing service.** We may pause service on an account more than 30 days past due until the balance is paid. Pausing service does not end this agreement or the amount owed.
4.4 **Collection costs.** If an account goes to collection or court, you agree to pay reasonable collection costs, court costs and attorney's fees. Under Florida law this works both ways: whoever wins a dispute about this agreement may recover reasonable attorney's fees from the other.
4.5 **Questioning a charge.** If you think an invoice is wrong, tell us in writing (email to Support@LattaCorpFL.com is fine) within 30 days of the invoice date and we will review it. Please pay any part you don't dispute by the due date.
4.6 **Chargebacks.** Please contact us before disputing a card or bank payment with your bank. If you dispute a payment for services we provided as agreed, you remain responsible for the amount, plus any dispute fees charged to us, and we may end automatic payments and require another way to pay.

## 5. Quality, damage, liability and insurance
5.1 **Making it right.** If something about a visit isn't right, tell us within 48 hours and we will come back and fix it at no charge. This is your main remedy for workmanship concerns.
5.2 **Damage we cause.** We work carefully. If our crew damages your property, tell us within 48 hours, with photos if you can, and let us inspect before repairs are made. We will repair or replace the damaged item, or pay the reasonable cost to do so, at our choice.
5.3 **What we are not responsible for.** We are not responsible for:
- hidden or unmarked items you didn't point out to us (2.5), such as sprinkler lines and heads, buried cables, invisible pet fences, landscape lighting and drain lines;
- items already broken, worn, rotted or not installed to code;
- normal results of the work, such as minor turf marks from equipment, clippings or debris carried by wind, or small chips from objects hidden in the grass;
- damage from weather, flooding, freezes, drought, pests, disease, animals, vehicles, or anyone other than our crew;
- plants, sod or trees that decline because of watering, irrigation problems or conditions outside our control.
5.4 **Treatments.** Fertilizer, weed and pest treatments are applied according to the product label and Florida law. Keep children and pets off treated areas until they are dry. Results depend on weather and conditions and can take several weeks; we don't guarantee a specific result.
5.5 **Plants, sod and trees.** New plants and sod we install are guaranteed for 30 days. If one dies in that time, we replace it once, as long as it was watered as instructed and wasn't harmed by anything in 5.3. Mulch, rock and other materials aren't guaranteed against fading, settling or washing out. Tree work near power lines is done only by qualified crews; we may decline work we judge unsafe.
5.6 **Limit of liability.** To the extent Florida law allows, our total liability for any claim connected with this agreement is limited to the cost of repairing or replacing the damaged property, and we are not liable for indirect or consequential losses such as lost rent, loss of use, or emotional distress. This limit does not apply to injury caused by our gross negligence or intentional misconduct.
5.7 **Insurance.** We carry commercial general liability insurance and workers' compensation coverage as required by Florida law. HOA and commercial clients may request a certificate of insurance, and we can name the association or property manager as an additional insured when required. You are responsible for insuring your own property.
5.8 **Photos.** We may take photos of the work area before and after service for quality and records. We won't publish photos that show your address, people or vehicles without your permission.

## 6. Term, cancellation and general terms
6.1 **Term.** Recurring service continues month to month until either of us ends it. One-time jobs end when the work is finished and paid.
6.2 **Cancelling.** You may cancel recurring service at any time with 7 days' notice before your next visit, by call, text, email or the client portal. You pay only for work done. We may end service with 7 days' notice for any reason, or right away if an account is more than 30 days past due or conditions on the property are unsafe for our crew. Amounts owed survive cancellation.
6.3 **Events outside our control.** We aren't responsible for delays caused by hurricanes, storms, flooding, government orders, utility outages, supply shortages or similar events. We will resume service as soon as it is safe and practical.
6.4 **Florida law and venue.** Florida law governs this agreement. Any lawsuit about it will be brought in the county or circuit court for Osceola County, Florida, or in small claims court where the amount allows.
6.5 **Electronic signatures and notices.** You agree that signing electronically (typing your name, drawing a signature or checking a box in our client portal) is the same as signing on paper, under the federal E-SIGN Act and Florida's Uniform Electronic Transaction Act (Florida Statutes section 668.50). You agree to receive invoices, receipts and notices by email or in the client portal. Notices to us go to Support@LattaCorpFL.com.
6.6 **Records.** We keep a permanent copy of this signed agreement, the date and time it was signed and the device information used, and a copy is available to you in your client portal at any time.
6.7 **Changes to these terms.** We may update our Terms of Service and this form for new clients. A change to your signed agreement takes effect only with 30 days' written notice; if you keep receiving service after that date, the change applies. Price changes follow 3.1.
6.8 **Construction lien notice.** For one-time improvement projects over $2,500 at a residential property of up to four units, the notice required by Florida Statutes section 713.015 is included with that project's quote and must be signed with it.
6.9 **The whole agreement.** This agreement and the documents in 1.1 are the entire agreement between us and replace earlier discussions. If any part is found unenforceable, the rest still applies. If we don't enforce a term right away, we haven't waived it. You may not transfer this agreement without our consent.
$agr$, '', '2026-11-14'),
  ('autopay-2026-11-14', 'autopay', 'Automatic Payment Authorization', $agr$This Automatic Payment Authorization is between LattaCorp Of Central Florida ("LattaCorp," "we," "us") and the account holder signing below ("you"), for the client account named above.

## What you authorize
1. **Payment method.** You choose a bank account (ACH), with no fee, or a credit card, with the credit card surcharge in our Service Agreement (3% of the payment, or our actual card cost if lower). Debit and prepaid cards are not accepted. You will connect the bank account or card through our secure payment page; we never store full account or card numbers.
2. **Charges.** You authorize LattaCorp Of Central Florida, and its payment processor, to charge that account for each invoice we issue to this client account, on or after the invoice's Payment Due date, until you cancel. You also authorize us to correct an error in a charge by a credit or debit to the same account.
3. **Amount and timing.** The amount is the invoice total, which varies from month to month. We email each invoice at least 10 days before it is charged, and you can see it in your client portal. If you would rather be told only when an amount falls outside a range, tell us the range in writing.
4. **Cancelling.** You can cancel at any time in the client portal, by email to Support@LattaCorpFL.com, or by calling or texting 407-470-5309. Cancellations received at least 3 business days before a scheduled charge stop that charge. You may also stop a bank payment through your bank. Cancelling automatic payments does not cancel your service or any amount owed.
5. **Failed payments.** If a charge is declined or returned, we will notify you, and the returned-payment charge in our Service Agreement applies to returned bank payments. We may retry a declined charge once within 10 days.
6. **Your copy and our records.** A copy of this authorization is emailed to you when you sign and stays in your client portal. We keep it for at least 2 years after it ends, as card and bank rules require.
7. **Your account.** You confirm you are an authorized signer on the bank account or card you connect, and that it is not a debit or prepaid card.
$agr$, '', '2026-11-14')
on conflict (id) do nothing;
-- fingerprints of the exact texts (set once, right after insert; the trigger allows nothing later)
alter table public.agreement_versions disable trigger keep_versions;
update public.agreement_versions set body_sha256 = encode(sha256(convert_to(body, 'UTF8')), 'hex') where body_sha256 = '';
alter table public.agreement_versions enable trigger keep_versions;

-- Client signs in the portal (staff can't sign for a client).
create or replace function public.portal_sign(cid uuid, ver text, p_name text, p_title text, p_sig text, p_method text default null)
returns json language plpgsql security definer set search_path = public as $$
declare v public.agreement_versions; c public.clients; d jsonb; hdr json; rid uuid; at timestamptz; em text := public.portal_email();
begin
  if cid is null or cid not in (select public.portal_client_ids()) then raise exception 'not allowed' using errcode = '42501'; end if;
  if public.is_staff() then raise exception 'Staff accounts can''t sign for a client.' using errcode = '42501'; end if;
  select * into v from public.agreement_versions where id = ver and active;
  if not found then raise exception 'This agreement version is not available.'; end if;
  if v.kind = 'autopay' and coalesce(p_method, '') not in ('ach', 'card') then raise exception 'Pick bank (ACH) or credit card.'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Type your full name.'; end if;
  if coalesce(p_sig, '') not like 'data:image/png;base64,%' or length(p_sig) < 200 then raise exception 'Please sign in the box.'; end if;
  select * into c from public.clients where id = cid;
  d := jsonb_build_object(
    'client', c.name, 'company', c.company, 'account_no', c.account_no, 'type', coalesce(c.type, 'residential'),
    'property', (select p.address from public.properties p where p.client_id = cid and coalesce(p.address, '') <> ''
                  order by (p.label = 'Main') desc, p.created_at limit 1),
    'services', (select coalesce(jsonb_agg(jsonb_build_object('title', j.title, 'frequency', j.frequency, 'price', j.price) order by j.created_at), '[]'::jsonb)
                   from public.jobs j where j.client_id = cid and j.status = 'active'));
  begin hdr := current_setting('request.headers', true)::json; exception when others then hdr := null; end;
  insert into public.signed_agreements (client_id, version_id, kind, body_sha256, details, method, typed_name, signer_title,
                                        signer_email, signer_user, signature_png, ip, user_agent)
  values (cid, v.id, v.kind, v.body_sha256, d, case when v.kind = 'autopay' then p_method end, trim(p_name), nullif(trim(coalesce(p_title, '')), ''),
          em, auth.uid(), p_sig,
          left(coalesce(hdr ->> 'cf-connecting-ip', split_part(hdr ->> 'x-forwarded-for', ',', 1), ''), 64),
          left(coalesce(hdr ->> 'user-agent', ''), 300))
  returning id, signed_at into rid, at;
  return json_build_object('id', rid, 'signed_at', at);
end;
$$;

-- Turning off automatic payments: recorded as an event; the signed authorization itself stays.
create or replace function public.portal_autopay_cancel(cid uuid, agreement uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if cid is null or cid not in (select public.portal_client_ids()) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.signed_agreements where id = agreement and client_id = cid and kind = 'autopay') then
    raise exception 'not found';
  end if;
  if exists (select 1 from public.agreement_events where agreement_id = agreement and kind = 'autopay_cancelled') then return; end if;
  insert into public.agreement_events (agreement_id, kind, by_email, note)
  values (agreement, 'autopay_cancelled', coalesce(nullif(public.portal_email(), ''), 'staff'), left(p_note, 300));
end;
$$;

-- Everything the portal (or Foreman) shows about one account's agreements.
create or replace function public.portal_agreements(cid uuid) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if cid is null or cid not in (select public.portal_client_ids()) then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object(
    'current', (select coalesce(json_agg(json_build_object('id', v.id, 'kind', v.kind, 'title', v.title, 'body', v.body, 'effective', v.effective)), '[]'::json)
                  from public.agreement_versions v where v.active),
    'signed', (select coalesce(json_agg(json_build_object(
                   'id', s.id, 'kind', s.kind, 'version_id', s.version_id, 'title', v.title, 'body', v.body, 'body_sha256', s.body_sha256,
                   'details', s.details, 'method', s.method, 'typed_name', s.typed_name, 'signer_title', s.signer_title,
                   'signer_email', s.signer_email, 'signature_png', s.signature_png, 'ip', s.ip, 'signed_at', s.signed_at,
                   'cancelled_at', (select e.at from public.agreement_events e where e.agreement_id = s.id and e.kind = 'autopay_cancelled' limit 1))
                 order by s.signed_at desc), '[]'::json)
                 from public.signed_agreements s join public.agreement_versions v on v.id = s.version_id where s.client_id = cid));
end;
$$;
revoke all on function public.portal_sign(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.portal_autopay_cancel(uuid, uuid, text) from public, anon;
revoke all on function public.portal_agreements(uuid) from public, anon;
grant execute on function public.portal_sign(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.portal_autopay_cancel(uuid, uuid, text) to authenticated;
grant execute on function public.portal_agreements(uuid) to authenticated;
