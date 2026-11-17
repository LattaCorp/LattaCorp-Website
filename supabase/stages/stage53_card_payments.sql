-- Stage 53: credit card payments with a surcharge (credit cards only; debit and prepaid cards are refused).
-- Card payments share the Stripe charges table with bank autopay and "pay now by bank".
alter table public.autopay_charges drop constraint if exists autopay_charges_source_check;
alter table public.autopay_charges add constraint autopay_charges_source_check check (source in ('autopay','paynow','card'));
alter table public.autopay_charges add column if not exists surcharge numeric(12,2) not null default 0; -- the card fee on top of `amount`
alter table public.autopay_charges add column if not exists card text;                                 -- "Visa ending 4242"

-- the owner's switch, the fee (never more than 3%) and the first day the fee may be charged
-- (30 days after telling Stripe and Mastercard; until then card payments stay off)
alter table public.business add column if not exists card_on boolean not null default false;
alter table public.business add column if not exists card_fee_pct numeric(4,2) not null default 3 check (card_fee_pct >= 0 and card_fee_pct <= 3);
alter table public.business add column if not exists card_start date;
