-- LattaCorp CRM, Stage 20: bill by property.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.

-- Per client: send a separate invoice for each property (default off = one combined invoice).
alter table public.clients  add column if not exists bill_by_property boolean not null default false;

-- Per invoice: which property it was billed to (empty = the whole account).
alter table public.invoices add column if not exists property_id uuid references public.properties(id) on delete set null;
