-- FUTrek: przygotowanie tabeli analyses pod wersje robocze (draft/autosave)
-- Uruchom w Supabase -> SQL Editor -> New query.

alter table public.analyses
  add column if not exists draft_key_hash text;

-- Draft musi móc istnieć zanim klient uzupełni wszystkie pola.
alter table public.analyses alter column email drop not null;
alter table public.analyses alter column name drop not null;
alter table public.analyses alter column division drop not null;
alter table public.analyses alter column budget drop not null;
alter table public.analyses alter column play_style drop not null;
alter table public.analyses alter column playstyles drop not null;
alter table public.analyses alter column other_playstyle drop not null;
alter table public.analyses alter column squad_image_url drop not null;
alter table public.analyses alter column rebuild_priorities drop not null;
alter table public.analyses alter column tradeable_players drop not null;
alter table public.analyses alter column must_keep_players drop not null;
alter table public.analyses alter column feedback drop not null;

alter table public.analyses alter column created_at set default now();
alter table public.analyses alter column status set default 'draft';

-- Opcjonalne, ale porządkuje dozwolone statusy.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'analyses_status_check'
  ) then
    alter table public.analyses
      add constraint analyses_status_check check (status in ('draft', 'submitted', 'completed'));
  end if;
end $$;
