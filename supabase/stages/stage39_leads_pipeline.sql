-- LattaCorp, Stage 39: Leads and quotes in one place, and turning them into jobs.
-- A quote can be linked to the website request (lead) it answers, and quotes and leads remember the job made from
-- them (the "Make job" button), so they show as Won. Safe to run more than once.

alter table public.estimates add column if not exists lead_id uuid references public.leads(id) on delete set null;
alter table public.estimates add column if not exists job_id uuid references public.jobs(id) on delete set null;
alter table public.leads add column if not exists job_id uuid references public.jobs(id) on delete set null;
create index if not exists estimates_lead_idx on public.estimates (lead_id);

notify pgrst, 'reload schema';
