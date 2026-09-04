-- FUTrek: powiązanie płatności Stripe z jedną ankietą analizy

create table if not exists public.analysis_purchases (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  customer_email text,
  analysis_id uuid not null default gen_random_uuid() unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  constraint analysis_purchases_status_check
    check (status in ('active', 'submitted', 'cancelled'))
);

-- analysis_id jest unikalnym identyfikatorem ankiety przypisanym do zakupu.
-- Relacji FK celowo nie dodajemy na tym etapie, ponieważ rekord zakupu może powstać
-- zanim klient po raz pierwszy otworzy ankietę i utworzy rekord w public.analyses.

alter table public.analysis_purchases enable row level security;

-- Brak publicznych policies jest celowy.
-- Tabela jest obsługiwana wyłącznie przez Netlify Functions z sekretnym kluczem Supabase.

create index if not exists analysis_purchases_customer_email_idx
  on public.analysis_purchases (customer_email);

create index if not exists analysis_purchases_status_idx
  on public.analysis_purchases (status);
