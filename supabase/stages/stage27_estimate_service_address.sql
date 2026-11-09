-- LattaCorp, Stage 27: Online estimates in the new invoice design.
-- The private estimate link (public_doc) now also returns the client's service address (their "Main" property, or
-- the first one on file), shown at the top of the estimate like on invoices. Everything else is the same as Stage 26.
-- Safe to run more than once.

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
    select address into prop_addr from public.properties where client_id = est.client_id and coalesce(address, '') <> ''
     order by (label = 'Main') desc, created_at limit 1;
    return json_build_object('kind', 'estimate',
      'doc', json_build_object('number', est.number, 'title', est.title, 'scope', est.scope, 'issue_date', est.issue_date, 'valid_until', est.valid_until,
                               'status', est.status, 'total', est.total, 'responded_at', est.responded_at, 'response_name', est.response_name,
                               'property_address', prop_addr),
      'items', items, 'client', json_build_object('name', cl.name, 'company', cl.company, 'account_no', cl.account_no), 'business', bz);
  end if;
  return null;
end $$;
grant execute on function public.public_doc(text, boolean) to anon, authenticated;
