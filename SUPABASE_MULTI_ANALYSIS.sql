-- FUTrek: pozwala kupić kilka analiz BUILD YOUR TEAM w jednym checkoutcie.
-- Uruchom raz w Supabase -> SQL Editor -> New query.

alter table public.analysis_purchases
  add column if not exists unit_index integer;

update public.analysis_purchases
set unit_index = 1
where unit_index is null;

alter table public.analysis_purchases
  alter column unit_index set default 1;

alter table public.analysis_purchases
  alter column unit_index set not null;

-- Stary model wymuszał tylko jeden rekord na jedną sesję Stripe.
alter table public.analysis_purchases
  drop constraint if exists analysis_purchases_stripe_session_id_key;

drop index if exists public.analysis_purchases_stripe_session_id_key;

-- Teraz jedna sesja może zawierać kilka osobnych analiz, każda z własnym analysis_id.
create unique index if not exists analysis_purchases_session_unit_key
  on public.analysis_purchases (stripe_session_id, unit_index);

notify pgrst, 'reload schema';
