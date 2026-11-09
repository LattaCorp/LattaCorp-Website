-- LattaCorp CRM, Stage 10: photos (client profiles, visits, expense receipts, and the Photos library).
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.

-- 1) A private storage bucket for the picture files (5 MB max each, pictures only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "staff read photos"   on storage.objects;
drop policy if exists "staff add photos"    on storage.objects;
drop policy if exists "staff delete photos" on storage.objects;
create policy "staff read photos"   on storage.objects for select to authenticated using (bucket_id = 'photos' and public.is_staff());
create policy "staff add photos"    on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_staff());
create policy "staff delete photos" on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_staff());

-- 2) One row per photo: who/what it belongs to, a caption, and its size (so the Photos tab can show space used).
create table if not exists public.photos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  client_id   uuid references public.clients(id)  on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  visit_id    uuid references public.visits(id)   on delete set null,
  expense_id  uuid references public.expenses(id) on delete set null,
  kind        text not null default 'other',       -- before / after / property / issue / receipt / other
  caption     text not null default '',
  path        text not null,                        -- the full picture in the bucket
  thumb_path  text,                                 -- a small preview in the bucket
  size_bytes  integer not null default 0,
  width       integer,
  height      integer,
  created_by  text not null default ''
);
create index if not exists photos_client_idx  on public.photos (client_id);
create index if not exists photos_created_idx on public.photos (created_at desc);

alter table public.photos enable row level security;
drop policy if exists "staff all photos" on public.photos;
create policy "staff all photos" on public.photos for all to authenticated using (public.is_staff()) with check (public.is_staff());
