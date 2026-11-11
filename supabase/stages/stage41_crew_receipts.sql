-- LattaCorp, Stage 41: crew members can upload receipts.
-- Crew logins can snap a receipt from their route screen. It lands in Receipts to enter on the Expenses page for the
-- office to type in (then the photo is deleted). Crew can only add receipt photos into their own folder; they still
-- can't see any other photos or data. Safe to run more than once.

create or replace function public.is_crew_login() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crew where user_id = auth.uid() and active and kind = 'login');
$$;
grant execute on function public.is_crew_login() to authenticated;

drop policy if exists "crew add receipt files" on storage.objects;
create policy "crew add receipt files" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_crew_login() and name like 'crew-receipts/' || auth.uid()::text || '/%');

create or replace function public.crew_add_receipt(p_path text, p_thumb text, p_size bigint, p_w int, p_h int, p_caption text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if not public.is_crew_login() then raise exception 'not allowed'; end if;
  if p_path not like 'crew-receipts/' || auth.uid()::text || '/%' or p_thumb not like 'crew-receipts/' || auth.uid()::text || '/%' then
    raise exception 'bad path';
  end if;
  select coalesce(nullif(email, ''), name) into v_name from public.crew where user_id = auth.uid() limit 1;
  insert into public.photos (kind, caption, path, thumb_path, size_bytes, width, height, created_by)
  values ('receipt_todo', left(coalesce(p_caption, ''), 200), p_path, p_thumb, coalesce(p_size, 0), p_w, p_h, coalesce(v_name, ''))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.crew_add_receipt(text, text, bigint, int, int, text) from public, anon;
grant execute on function public.crew_add_receipt(text, text, bigint, int, int, text) to authenticated;
notify pgrst, 'reload schema';
