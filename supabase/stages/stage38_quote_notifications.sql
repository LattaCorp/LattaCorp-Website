-- LattaCorp, Stage 38: Know when a client answers a quote.
-- 1) Foreman badges: a quote or estimate the client has just accepted or declined is marked "new" until you open it.
-- 2) Email: when a client ACCEPTS (signs) a quote or estimate online, the website emails the business (declines are
--    not emailed). Safe to run more than once.

alter table public.estimates add column if not exists response_seen boolean not null default true;

create or replace function public.respond_estimate(tok text, decision text, who text, note text, sig text, po text)
returns json language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if tok is null or length(tok) < 32 or decision not in ('accepted', 'declined') then return json_build_object('ok', false); end if;
  if decision = 'accepted' and length(trim(coalesce(who, ''))) = 0 then return json_build_object('ok', false, 'reason', 'name'); end if;
  if decision = 'accepted' and (sig is null or sig not like 'data:image/png;base64,%' or length(sig) > 300000) then
    return json_build_object('ok', false, 'reason', 'signature');
  end if;
  update public.estimates
     set status = decision, responded_at = now(), response_name = left(trim(coalesce(who, '')), 120),
         response_note = left(trim(coalesce(note, '')), 500),
         response_signature = case when decision = 'accepted' then sig end,
         response_po = case when decision = 'accepted' then left(trim(coalesce(po, '')), 60) else '' end,
         response_seen = false
   where share_token = tok and status in ('draft', 'sent')
     and (valid_until is null or valid_until >= (now() at time zone 'America/New_York')::date);
  get diagnostics n = row_count;
  return json_build_object('ok', n > 0, 'status', decision);
end $$;
grant execute on function public.respond_estimate(text, text, text, text, text, text) to anon, authenticated;

-- the approval email is sent by the website (the same Resend setup as the website forms, from our verified domain);
-- this records when it went out so it is never sent twice
alter table public.estimates add column if not exists approval_emailed_at timestamptz;

-- (an earlier draft of this stage emailed from the database; that is removed)
drop trigger if exists estimates_accepted_email on public.estimates;
drop function if exists public.estimate_accepted_email();
drop function if exists public.html_esc(text);

notify pgrst, 'reload schema';
