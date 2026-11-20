-- Stage 57: winter schedule, schedule resets, and "moved" vs "weather" in the portal.
--
-- business.winter_start / winter_end: the yearly winter break window as MM-DD (default Jan 25 to Feb 25).
--   Weekly jobs switch to every 2 weeks inside it, then go back to weekly.
-- jobs.winter_break: whether a weekly job takes the winter break (on by default for every job).
-- jobs.anchor_date: when set, the job's repeating visits count from this date instead of start_date
--   (set by "Reset schedule" and by re-spacing after a visit is done on a different day).
-- portal_account(): upcoming visits say whether they fall in the winter break, separate "moved" (day shifts,
--   catch-up changes) from "weather" delays, and the account returns the winter break dates ('winter').

alter table public.business add column if not exists winter_start text default '01-25';
alter table public.business add column if not exists winter_end text default '02-25';
update public.business set winter_start = '01-25', winter_end = '02-25' where winter_start is null and winter_end is null;

alter table public.jobs add column if not exists winter_break boolean not null default true;
alter table public.jobs add column if not exists anchor_date date;

-- portal_account: patched in place so the rest of the function (from earlier stages) stays exactly as it was.
do $$
declare
  d text := pg_get_functiondef('public.portal_account(uuid)'::regprocedure);
  n text;
begin
  if position('''winter'', wn' in d) > 0 then
    return; -- already applied
  end if;

  n := replace(d, 'sites json;', 'sites json; wn json; ws text; we text;');
  if n = d then raise exception 'stage57: declare not found'; end if; d := n;

  n := replace(d, '  select coalesce(sum(amount), 0) into credit',
    '  select nullif(winter_start, ''''), nullif(winter_end, '''') into ws, we from public.business limit 1;' || chr(10) ||
    '  select coalesce(sum(amount), 0) into credit');
  if n = d then raise exception 'stage57: credit line not found'; end if; d := n;

  n := replace(d, '''date'', x.scheduled_date, ''status'', x.status, ''done_at'', x.completed_at, ''delayed_from'', x.weather_from,',
    '''date'', x.scheduled_date, ''status'', x.status, ''done_at'', x.completed_at,' ||
    ' ''delayed_from'', case when coalesce(x.weather_batch, '''') like ''s|%'' or coalesce(x.weather_batch, '''') like ''m|%'' then null else x.weather_from end,' ||
    ' ''moved_from'', case when x.weather_batch like ''s|%'' or x.weather_batch like ''m|%'' then x.weather_from end,' ||
    ' ''winter'', coalesce(j.frequency = ''weekly'' and j.winter_break and ws is not null and to_char(x.scheduled_date, ''MM-DD'') between ws and we, false),');
  if n = d then raise exception 'stage57: upcoming visits not found'; end if; d := n;

  n := replace(d, '  bal := greatest(0, round(bal - credit, 2));',
    '  if ws is not null and we is not null and exists (select 1 from public.jobs where client_id = cid and status = ''active'' and frequency = ''weekly'' and winter_break) then' || chr(10) ||
    '    declare y int := extract(year from today)::int; s date; e date;' || chr(10) ||
    '    begin' || chr(10) ||
    '      e := to_date(y || ''-'' || we, ''YYYY-MM-DD'');' || chr(10) ||
    '      if e < today then y := y + 1; e := to_date(y || ''-'' || we, ''YYYY-MM-DD''); end if;' || chr(10) ||
    '      s := to_date(y || ''-'' || ws, ''YYYY-MM-DD'');' || chr(10) ||
    '      wn := json_build_object(''start'', s, ''end'', e, ''active'', today between s and e);' || chr(10) ||
    '    end;' || chr(10) ||
    '  end if;' || chr(10) ||
    '  bal := greatest(0, round(bal - credit, 2));');
  if n = d then raise exception 'stage57: balance line not found'; end if; d := n;

  n := replace(d, '''sites'', sites);', '''sites'', sites, ''winter'', wn);');
  if n = d then raise exception 'stage57: return not found'; end if; d := n;

  execute d;
end $$;
