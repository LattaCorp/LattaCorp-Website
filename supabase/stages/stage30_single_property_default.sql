-- Stage 30: a client with only one property gets every invoice on that property (their Main).
-- Multi-property clients (Commercial / HOA) are untouched: their invoices keep whatever property was picked.

-- 1. Going forward: any invoice saved without a property, for a client that has exactly one, lands on that property.
create or replace function public.invoice_default_property()
returns trigger
language plpgsql
as $$
declare
  only_prop uuid;
begin
  if new.property_id is null and new.client_id is not null then
    select min(p.id::text)::uuid into only_prop
    from public.properties p
    where p.client_id = new.client_id
    having count(*) = 1;
    if only_prop is not null then
      new.property_id := only_prop;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_default_property on public.invoices;
create trigger invoice_default_property
  before insert or update of property_id, client_id on public.invoices
  for each row execute function public.invoice_default_property();

-- 2. Existing invoices: keep a list of what changes (so it can be undone), then tag them.
create table if not exists public.backfill_stage30_invoice_property (
  invoice_id uuid primary key,
  property_id uuid,
  changed_at timestamptz default now()
);

insert into public.backfill_stage30_invoice_property (invoice_id, property_id)
select i.id, p.id
from public.invoices i
join public.properties p on p.client_id = i.client_id
where i.property_id is null
  and (select count(*) from public.properties q where q.client_id = i.client_id) = 1
on conflict do nothing;

update public.invoices i
set property_id = b.property_id
from public.backfill_stage30_invoice_property b
where b.invoice_id = i.id and i.property_id is null;

alter table public.backfill_stage30_invoice_property enable row level security;

-- Undo for step 2, if ever needed:
-- update public.invoices i set property_id = null
--   from public.backfill_stage30_invoice_property b where b.invoice_id = i.id;
