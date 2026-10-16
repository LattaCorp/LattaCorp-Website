-- LattaCorp CRM, Stage 7: team logins (owner / co-owner and office staff).
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
alter table public.staff add column if not exists name    text not null default '';
alter table public.staff add column if not exists role    text not null default 'office';
alter table public.staff add column if not exists user_id uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'staff_role_check') then
    alter table public.staff add constraint staff_role_check check (role in ('owner','office'));
  end if;
end $$;

-- You are the owner. (Anyone added later through the Team screen picks their own role.)
update public.staff set role = 'owner' where lower(email) = 'lattacorpofcentralfl@gmail.com';
update public.staff set name = 'Matteo Latalladi' where lower(email) = 'lattacorpofcentralfl@gmail.com' and name = '';

-- Lets the CRM ask "what is my role?" after sign-in.
create or replace function public.staff_role() returns text
language sql security definer set search_path = public stable as $$
  select role from public.staff where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1;
$$;
revoke all on function public.staff_role() from public, anon;
grant execute on function public.staff_role() to authenticated;
