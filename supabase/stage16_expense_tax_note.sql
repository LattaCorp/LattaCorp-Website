-- LattaCorp CRM, Stage 16: a tax description box on each expense (notes for your accountant).
alter table public.expenses add column if not exists tax_note text not null default '';
