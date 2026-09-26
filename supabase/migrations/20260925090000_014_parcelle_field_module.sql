-- =====================================================================
-- 014 — Module Parcelle, plantations, observations et programmes de
--        terrain, avec intégrité stricte pour le futur moteur RAG.
--
-- Triptyque exigé pour chaque observation/traitement/apport :
--   [Variété du Catalogue ou Semis] <-> [Serre ou Parcelle] <-> [Date /
--   Météo Historique du Jour]
-- Ce triptyque est porté par `field_plantings` (variété/semis + lieu),
-- et chaque observation/programme s'y rattache obligatoirement avec une
-- date. La météo du jour se résout via `weather_daily` (migration 013)
-- sur cette date — elle n'est pas dupliquée dans chaque table.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. parcelles : le pendant plein air d'une serre.
-- ---------------------------------------------------------------------
create table if not exists public.parcelles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  soil_type text[] not null default '{}',
  location text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now()
);

alter table public.parcelles enable row level security;
drop policy if exists "own_parcelles" on public.parcelles;
create policy "own_parcelles" on public.parcelles
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 2. field_plantings : quelle variété (Catalogue ou Semis) est en place
--    dans quelle Serre (table) ou Parcelle. C'est l'ancrage du triptyque :
--    toute observation ou programme passe obligatoirement par une ligne
--    ici, jamais par un texte libre d'emplacement.
-- ---------------------------------------------------------------------
create table if not exists public.field_plantings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  variety_id uuid references public.varieties(id) on delete cascade,
  seedling_id uuid references public.seedlings(id) on delete cascade,
  greenhouse_table_id uuid references public.greenhouse_tables(id) on delete cascade,
  parcelle_id uuid references public.parcelles(id) on delete cascade,
  planted_at date not null default current_date,
  removed_at date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  -- Exactement une source (variété du catalogue OU semis) :
  constraint field_plantings_one_source check (
    (variety_id is not null and seedling_id is null) or
    (variety_id is null and seedling_id is not null)
  ),
  -- Exactement un emplacement (table de serre OU parcelle) :
  constraint field_plantings_one_location check (
    (greenhouse_table_id is not null and parcelle_id is null) or
    (greenhouse_table_id is null and parcelle_id is not null)
  )
);

create index if not exists idx_field_plantings_variety on public.field_plantings (variety_id);
create index if not exists idx_field_plantings_seedling on public.field_plantings (seedling_id);
create index if not exists idx_field_plantings_greenhouse_table on public.field_plantings (greenhouse_table_id);
create index if not exists idx_field_plantings_parcelle on public.field_plantings (parcelle_id);

alter table public.field_plantings enable row level security;
drop policy if exists "own_field_plantings" on public.field_plantings;
create policy "own_field_plantings" on public.field_plantings
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3. field_observations : la grille quotidienne, cases à cocher
--    uniquement (remarque = seule exception en texte libre, cf. règle
--    globale de l'appli). Toujours rattachée à une plantation, donc au
--    triptyque variété + lieu ; la météo du jour se résout sur
--    observation_date via weather_daily.
-- ---------------------------------------------------------------------
create table if not exists public.field_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  planting_id uuid not null references public.field_plantings(id) on delete cascade,
  observation_date date not null default current_date,
  intervention_date date,
  disease_pressure text[] not null default '{}',
  pests text[] not null default '{}',
  climate_behavior text[] not null default '{}',
  treatment_applied text[] not null default '{}',
  treatment_reaction text[] not null default '{}',
  remarque text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_field_observations_planting on public.field_observations (planting_id);
create index if not exists idx_field_observations_date on public.field_observations (observation_date);

alter table public.field_observations enable row level security;
drop policy if exists "own_field_observations" on public.field_observations;
create policy "own_field_observations" on public.field_observations
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 4. field_programs : programmes collectifs/curatifs et plans de
--    fertilisation de fond, dissociés des observations quotidiennes.
--    Une ligne cible soit une plantation précise, soit tout un
--    emplacement (parcelle/serre) pour un programme collectif.
-- ---------------------------------------------------------------------
create table if not exists public.field_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  planting_id uuid references public.field_plantings(id) on delete cascade,
  greenhouse_id uuid references public.greenhouses(id) on delete cascade,
  parcelle_id uuid references public.parcelles(id) on delete cascade,
  program_type text not null check (program_type in ('curatif', 'preventif', 'fertilisation')),
  product_name text not null,
  start_date date not null default current_date,
  intervention_count integer not null default 1,
  last_intervention_date date,
  result text check (result in ('amelioration', 'stationnaire', 'echec')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  -- Au moins une cible : une plantation précise, ou tout un emplacement.
  constraint field_programs_has_target check (
    planting_id is not null or greenhouse_id is not null or parcelle_id is not null
  )
);

create index if not exists idx_field_programs_planting on public.field_programs (planting_id);

alter table public.field_programs enable row level security;
drop policy if exists "own_field_programs" on public.field_programs;
create policy "own_field_programs" on public.field_programs
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 5. Rattacher les lots de croisement à une Parcelle, au même titre
--    qu'à une table de serre (jusqu'ici, `location`/`containers` en
--    texte libre — remplacés par un choix réel).
-- ---------------------------------------------------------------------
alter table public.crosses
  add column if not exists greenhouse_table_id uuid references public.greenhouse_tables(id) on delete set null,
  add column if not exists parcelle_id uuid references public.parcelles(id) on delete set null;

alter table public.crosses drop constraint if exists crosses_one_field_location;
alter table public.crosses add constraint crosses_one_field_location check (
  greenhouse_table_id is null or parcelle_id is null
);
