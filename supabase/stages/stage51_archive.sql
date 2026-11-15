-- Stage 51: archive website requests and quotes/estimates (hidden from the Leads board until you open the Archived filter).
alter table public.leads add column if not exists archived_at timestamptz;
alter table public.estimates add column if not exists archived_at timestamptz;
