-- Stage 58: Client Portal sign-in finds the email on file even when it's typed a little differently.
--
-- portal_signin_emails(): every email allowed into the portal (same rules as portal_email_allowed), so the
--   server (src/portal-match.js) can match "cowan.mollya@gmail.com" to "cowanmollya@gmail.com" or catch a small typo.
--   Server only (secret key).
-- portal_signins.ip: the device's internet address, so one device can't try a long list of emails
--   (5 emails not on file in 10 minutes, then it has to wait).
-- portal_signins.sent_to: the email on file the code went to, when it differs from what was typed.

create or replace function public.portal_signin_emails() returns setof text
language sql stable security definer set search_path = public as $$
  select distinct lower(trim(c.email)) from public.clients c
   where c.portal_access and not c.archived and coalesce(trim(c.email), '') <> ''
  union
  select distinct lower(trim(cc.email)) from public.client_contacts cc join public.clients c on c.id = cc.client_id
   where cc.portal_access and not c.archived and coalesce(trim(cc.email), '') <> ''
  union
  select distinct lower(trim(s.email)) from public.staff s where coalesce(trim(s.email), '') <> ''
$$;
revoke all on function public.portal_signin_emails() from public, anon, authenticated;
grant execute on function public.portal_signin_emails() to service_role;
comment on function public.portal_signin_emails() is 'PORTAL › Sign-in: every email allowed into the portal, for matching a near-miss typed email. Server-only.';

alter table public.portal_signins add column if not exists ip text;
alter table public.portal_signins add column if not exists sent_to text;
create index if not exists portal_signins_ip_idx on public.portal_signins (ip, created_at desc);
comment on column public.portal_signins.ip is 'Device address, for limiting how many emails not on file one device can try.';
comment on column public.portal_signins.sent_to is 'The email on file the code was sent to, when it differs from the typed email.';
