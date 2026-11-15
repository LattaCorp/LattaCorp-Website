-- LattaCorp CRM, Stage 49: the legal name is "Latta Corp Of Central Florida".
-- Signed texts can't change, so this adds new versions (dated 2026-11-15) and turns the old ones off.
insert into public.agreement_versions (id, kind, title, body, body_sha256, effective)
select replace(v.id, '2026-11-14', '2026-11-15'), v.kind, v.title,
       replace(replace(replace(v.body, 'LattaCorp Of Central Florida', 'Latta Corp Of Central Florida'), '(LattaCorp)', '(Latta Corp)'), '("LattaCorp,"', '("Latta Corp,"'),
       '', '2026-11-15'
  from public.agreement_versions v where v.id in ('service-2026-11-14', 'autopay-2026-11-14')
on conflict (id) do nothing;
alter table public.agreement_versions disable trigger keep_versions;
update public.agreement_versions set body_sha256 = encode(sha256(convert_to(body, 'UTF8')), 'hex') where body_sha256 = '';
alter table public.agreement_versions enable trigger keep_versions;
update public.agreement_versions set active = false where id in ('service-2026-11-14', 'autopay-2026-11-14');
update public.business set name = 'Latta Corp Of Central Florida' where id = 1;
-- The texts match supabase/agreements/*-2026-11-15.md (SHA-256 checked).
