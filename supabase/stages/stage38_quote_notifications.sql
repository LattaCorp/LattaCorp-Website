-- LattaCorp, Stage 38: Know when a client answers a quote.
-- 1) Foreman badges: a quote or estimate the client has just accepted or declined is marked "new" until you open it.
-- 2) Email: when a client ACCEPTS (signs) a quote or estimate online (not when you mark one accepted yourself), an email goes to your business email (Support@LattaCorpFL.com).
--    Declines do not send an email. Emails are sent through Resend (resend.com) and only start once its key is saved:
--      select vault.create_secret('re_your_key_here', 'resend_api_key');
--    Optional "from" address once your domain is verified in Resend (until then Resend's test address is used):
--      select vault.create_secret('Foreman <quotes@lattacorpfl.com>', 'resend_from');
-- Safe to run more than once.

create extension if not exists pg_net with schema extensions;

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

-- makes text from the client safe to put in the email
create or replace function public.html_esc(x text) returns text language sql immutable as $$
  select replace(replace(replace(replace(coalesce(x, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

-- the approval email (never blocks the client's signature: any problem here is skipped quietly)
create or replace function public.estimate_accepted_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k text; frm text; b public.business; cl public.clients; num text; word text; dep numeric := 0; html text; site text := 'https://lattacorpfl.com';
begin
  if new.status <> 'accepted' or old.status = 'accepted' then return new; end if;
  begin
    select decrypted_secret into k from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
    if coalesce(k, '') = '' then return new; end if;
    select decrypted_secret into frm from vault.decrypted_secrets where name = 'resend_from' limit 1;
    select * into b from public.business where id = 1;
    if coalesce(b.email, '') = '' then return new; end if;
    select * into cl from public.clients where id = new.client_id;
    word := case when coalesce(new.doc_type, 'quote') = 'estimate' then 'Estimate' else 'Quote' end;
    num := case when word = 'Estimate' then 'EST-' else 'QTE-' end || lpad(new.number::text, 4, '0');
    if new.deposit is not null then
      dep := case when new.deposit->>'mode' = 'pct' then round(new.total * coalesce((new.deposit->>'pct')::numeric, 0) / 100, 2)
                  else coalesce((new.deposit->>'amt')::numeric, 0) end;
    end if;
    html := '<div style="font-family:Arial,sans-serif;font-size:15px;color:#1c2a20;line-height:1.5">'
      || '<h2 style="color:#1b552b;margin:0 0 10px">' || word || ' ' || num || ' was approved</h2>'
      || '<p style="margin:0 0 12px"><b>' || html_esc(cl.name) || case when coalesce(cl.company, '') <> '' then ' · ' || html_esc(cl.company) else '' end || '</b> signed '
      || case when coalesce(new.title, '') <> '' then '“' || html_esc(new.title) || '” ' else '' end || 'for <b>$' || to_char(new.total, 'FM999,999,990.00') || '</b>.</p>'
      || '<table style="border-collapse:collapse;font-size:14px">'
      || '<tr><td style="padding:3px 14px 3px 0;color:#58675c">Signed by</td><td>' || html_esc(new.response_name) || '</td></tr>'
      || case when coalesce(new.response_po, '') <> '' then '<tr><td style="padding:3px 14px 3px 0;color:#58675c">PO / Approval #</td><td>' || html_esc(new.response_po) || '</td></tr>' else '' end
      || case when dep > 0 then '<tr><td style="padding:3px 14px 3px 0;color:#58675c">Deposit due</td><td>$' || to_char(dep, 'FM999,999,990.00') || '</td></tr>' else '' end
      || '<tr><td style="padding:3px 14px 3px 0;color:#58675c">Signed</td><td>' || to_char(coalesce(new.responded_at, now()) at time zone 'America/New_York', 'Mon DD, YYYY at FMHH12:MI AM') || '</td></tr>'
      || '</table>'
      || '<p style="margin:16px 0 0"><a href="' || site || '/d/?t=' || new.share_token || '&p=1" style="background:#1b552b;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;display:inline-block">See the signed ' || lower(word) || '</a>'
      || ' &nbsp; <a href="' || site || '/crm/" style="color:#1b552b">Open Foreman</a></p></div>';
    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || k, 'Content-Type', 'application/json'),
      body := jsonb_build_object('from', coalesce(nullif(frm, ''), 'Foreman <onboarding@resend.dev>'), 'to', jsonb_build_array(b.email),
                                 'subject', word || ' approved: ' || coalesce(cl.name, '') || ' · ' || num || ' · $' || to_char(new.total, 'FM999,999,990.00'),
                                 'html', html));
  exception when others then
    null;
  end;
  return new;
end $$;
revoke execute on function public.estimate_accepted_email() from public, anon, authenticated;

drop trigger if exists estimates_accepted_email on public.estimates;
create trigger estimates_accepted_email after update of status on public.estimates
  for each row when (new.status = 'accepted' and old.status is distinct from 'accepted' and new.response_seen = false)
  execute function public.estimate_accepted_email();

notify pgrst, 'reload schema';
