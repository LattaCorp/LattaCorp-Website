-- LattaCorp CRM, Stage 8: shared to-do list for the team.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run more than once.
create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  title       text not null,
  notes       text not null default '',
  due_date    date,
  client_id   uuid references public.clients(id) on delete set null,
  assigned_to text not null default '',      -- a team member's email, or empty for "anyone"
  created_by  text not null default '',
  done        boolean not null default false,
  done_at     timestamptz,
  done_by     text not null default ''
);
create index if not exists todos_done_due_idx on public.todos (done, due_date);

alter table public.todos enable row level security;
drop policy if exists "staff all todos" on public.todos;
create policy "staff all todos" on public.todos for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Lets every team member see the names to pick from when assigning a task.
create or replace function public.team_names() returns table(email text, name text)
language sql security definer set search_path = public stable as $$
  select s.email, s.name from public.staff s where public.is_staff() order by s.name, s.email;
$$;
revoke all on function public.team_names() from public, anon;
grant execute on function public.team_names() to authenticated;
