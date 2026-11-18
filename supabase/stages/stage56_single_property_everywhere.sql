-- Stage 56: a client with only one property gets that property (their Main) on everything saved
-- without one: quotes/estimates, jobs, visits and photos, the same way Stage 30 did for invoices.
-- Uses the invoice_default_property() function from Stage 30. Multi-property clients are untouched.

drop trigger if exists estimate_default_property on public.estimates;
create trigger estimate_default_property
  before insert or update of property_id, client_id on public.estimates
  for each row execute function public.invoice_default_property();

drop trigger if exists job_default_property on public.jobs;
create trigger job_default_property
  before insert or update of property_id, client_id on public.jobs
  for each row execute function public.invoice_default_property();

drop trigger if exists visit_default_property on public.visits;
create trigger visit_default_property
  before insert or update of property_id, client_id on public.visits
  for each row execute function public.invoice_default_property();

drop trigger if exists photo_default_property on public.photos;
create trigger photo_default_property
  before insert or update of property_id, client_id on public.photos
  for each row execute function public.invoice_default_property();
