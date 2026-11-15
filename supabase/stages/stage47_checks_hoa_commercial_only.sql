-- LattaCorp CRM, Stage 47: checks are only for HOA and commercial accounts.
-- Invoice and quote links now also carry the client's type, so the invoice can show the right ways to pay.
-- Safe to run more than once.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'public_doc';
  if d is not null and position('''type'', cl.type' in d) = 0 then
    d := replace(d, '''phone'', cl.phone, ''email'', cl.email)', '''phone'', cl.phone, ''email'', cl.email, ''type'', cl.type)');
    execute d;
  end if;
end $$;

update public.business
   set payment_note = 'Cash is also accepted.',
       accepts = replace(accepts, 'Check,', 'Check (HOA and commercial only),')
 where id = 1 and payment_note = 'Cash or Checks are also accepted';
