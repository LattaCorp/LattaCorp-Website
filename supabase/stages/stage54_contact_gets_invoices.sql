-- Stage 54: a client's other contacts (spouse, HOA manager, accounts payable) can also receive the invoice emails.
alter table public.client_contacts add column if not exists gets_invoices boolean not null default false;
