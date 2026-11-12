-- Stage 42: Google Maps key for Street View photos of properties (staff-only table)
alter table public.business add column if not exists maps_key text not null default '';
