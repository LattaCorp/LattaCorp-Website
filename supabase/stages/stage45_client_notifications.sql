-- LattaCorp, Stage 45: phone notifications for clients (client portal), offers, and news posts.
-- Safe to run more than once.

-- devices: staff phones (Foreman) and client phones (portal)
alter table public.push_devices add column if not exists kind text not null default 'staff';

-- each portal person's choices per account (missing = the default for that account's type)
create table if not exists public.portal_push_prefs (
  email      text not null,
  client_id  uuid not null references public.clients(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (email, client_id)
);
alter table public.portal_push_prefs enable row level security;   -- server only

-- news posts sent from Foreman (shown in the portal and sent as notifications)
create table if not exists public.news_posts (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title      text not null,
  body       text not null default '',
  link       text not null default '',
  audience   text not null default 'all' check (audience in ('all','residential','hoa','commercial')),
  sent_count int not null default 0,
  created_by text not null default ''
);
alter table public.news_posts enable row level security;
drop policy if exists "staff all news_posts" on public.news_posts;
create policy "staff all news_posts" on public.news_posts for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- offers: a quote sent to the client's phone as a recommendation
alter table public.estimates add column if not exists offered_at timestamptz;
-- so each finished visit and each sent invoice notifies the client only once
alter table public.visits   add column if not exists client_notified_at timestamptz;
alter table public.invoices add column if not exists client_notified_at timestamptz;

-- the portal's "News & offers" for one account
create or replace function public.portal_feed(cid uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare c public.clients;
begin
  if cid is null or cid not in (select public.portal_client_ids()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into c from public.clients where id = cid;
  return json_build_object(
    'news', (select coalesce(json_agg(json_build_object('title', n.title, 'body', n.body, 'link', n.link, 'date', n.created_at) order by n.created_at desc), '[]'::json)
               from (select * from public.news_posts
                      where (audience = 'all' or audience = coalesce(c.type, 'residential'))
                        and created_at > now() - interval '120 days'
                      order by created_at desc limit 5) n),
    'offers', (select coalesce(json_agg(json_build_object('title', coalesce(nullif(e.title, ''), 'Recommended service'), 'total', e.total,
                                                          'token', e.share_token, 'date', e.offered_at) order by e.offered_at desc), '[]'::json)
                 from public.estimates e
                where e.client_id = cid and e.offered_at is not null and e.status in ('draft', 'sent')));
end $$;
revoke all on function public.portal_feed(uuid) from public, anon;
grant execute on function public.portal_feed(uuid) to authenticated;
