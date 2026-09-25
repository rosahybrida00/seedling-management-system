-- 014 — Parcelles plein air, intégrité relationnelle et indexation RAG
-- Cette migration complète la Serre par une localisation extérieure stable.

create table if not exists public.parcelles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  latitude numeric,
  longitude numeric,
  city text,
  soil_type text,
  soil_notes text,
  area_m2 numeric check (area_m2 is null or area_m2 > 0),
  remarks text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.parcelles enable row level security;
drop policy if exists parcelles_select_own on public.parcelles;
drop policy if exists parcelles_insert_own on public.parcelles;
drop policy if exists parcelles_update_own on public.parcelles;
drop policy if exists parcelles_delete_own on public.parcelles;
create policy parcelles_select_own on public.parcelles for select to authenticated using (auth.uid() = user_id);
create policy parcelles_insert_own on public.parcelles for insert to authenticated with check (auth.uid() = user_id);
create policy parcelles_update_own on public.parcelles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy parcelles_delete_own on public.parcelles for delete to authenticated using (auth.uid() = user_id);
create index if not exists idx_parcelles_user on public.parcelles(user_id);

-- Une observation extérieure est explicitement rattachée à une Parcelle,
-- un Semis/Catalogue et au relevé météo du jour J.
create table if not exists public.outdoor_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parcelle_id uuid not null references public.parcelles(id) on delete cascade,
  seedling_id uuid references public.seedlings(id) on delete cascade,
  variety_id uuid references public.varieties(id) on delete set null,
  observation_date date not null,
  weather_daily_id uuid not null references public.weather_daily(id) on delete restrict,
  observation_type text not null default 'culture',
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint outdoor_observations_catalogue_check check (seedling_id is not null or variety_id is not null)
);

alter table public.outdoor_observations enable row level security;
drop policy if exists outdoor_observations_own on public.outdoor_observations;
create policy outdoor_observations_own on public.outdoor_observations for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_outdoor_observations_chain on public.outdoor_observations(user_id, parcelle_id, observation_date, weather_daily_id);
create index if not exists idx_outdoor_observations_seedling on public.outdoor_observations(seedling_id) where seedling_id is not null;

-- Localisation unifiée pour les croisements : serre ou parcelle, jamais les deux.
alter table public.crosses add column if not exists location_kind text;
alter table public.crosses add column if not exists parcelle_id uuid references public.parcelles(id) on delete restrict;
alter table public.crosses add column if not exists weather_daily_id uuid references public.weather_daily(id) on delete restrict;
alter table public.crosses drop constraint if exists crosses_location_kind_check;
alter table public.crosses add constraint crosses_location_kind_check check (location_kind is null or location_kind in ('greenhouse','parcelle'));
create index if not exists idx_crosses_rag_chain on public.crosses(user_id, parcelle_id, weather_daily_id);

-- Le relevé météo doit correspondre à la date métier de la ligne.
create or replace function public.validate_weather_day_link()
returns trigger language plpgsql set search_path = public as $$
declare weather_day date;
begin
  select date into weather_day from public.weather_daily where id = new.weather_daily_id and user_id = new.user_id;
  if weather_day is null then raise exception 'Le relevé météo appartient à un autre utilisateur ou n’existe pas'; end if;
  if tg_table_name = 'outdoor_observations' and weather_day <> new.observation_date then
    raise exception 'Le relevé météo doit correspondre au jour de l’observation';
  end if;
  return new;
end; $$;

drop trigger if exists outdoor_observations_weather_day on public.outdoor_observations;
create trigger outdoor_observations_weather_day before insert or update of weather_daily_id, observation_date, user_id on public.outdoor_observations for each row execute function public.validate_weather_day_link();

-- Vue d'indexation stable pour le futur moteur RAG : chaîne complète.
create or replace view public.rag_agronomic_chain with (security_invoker = true) as
select o.id as observation_id, o.user_id, o.observation_date, o.observation_type, o.notes,
       p.id as parcelle_id, p.name as parcelle_name, p.soil_type, p.latitude, p.longitude,
       o.seedling_id, o.variety_id, w.id as weather_daily_id, w.temperature, w.humidity, w.uv_index, w.location as weather_location
from public.outdoor_observations o
join public.parcelles p on p.id = o.parcelle_id
join public.weather_daily w on w.id = o.weather_daily_id;

grant select on public.rag_agronomic_chain to authenticated;

comment on table public.parcelles is 'Localisation plein air, sol et historique cultural de l’utilisateur.';
comment on view public.rag_agronomic_chain is 'Chaînage indexable Variété/Semis ↔ Parcelle ↔ Météo historique du jour.';

-- À exécuter après correction des données historiques :
-- select * from public.verify_orphaned_data();
create or replace function public.verify_orphaned_data()
returns table(entity text, row_id uuid, reason text)
language sql stable security invoker set search_path = public as $$
  select 'outdoor_observations', o.id, 'parcelle absente ou météo du mauvais jour'
  from public.outdoor_observations o
  left join public.parcelles p on p.id = o.parcelle_id
  left join public.weather_daily w on w.id = o.weather_daily_id and w.user_id = o.user_id and w.date = o.observation_date
  where p.id is null or w.id is null
  union all
  select 'crosses', c.id, 'parcelle ou météo référencée absente'
  from public.crosses c
  where (c.parcelle_id is not null and not exists (select 1 from public.parcelles p where p.id = c.parcelle_id and p.user_id = c.user_id))
     or (c.weather_daily_id is not null and not exists (select 1 from public.weather_daily w where w.id = c.weather_daily_id and w.user_id = c.user_id));
$$;
grant execute on function public.verify_orphaned_data() to authenticated;

-- Refuse les liens croisés Parcelle/Utilisateur sur les observations.
create or replace function public.validate_parcelle_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.parcelles p where p.id = new.parcelle_id and p.user_id = new.user_id) then
    raise exception 'La Parcelle doit appartenir au même utilisateur';
  end if;
  return new;
end; $$;
drop trigger if exists outdoor_observations_parcelle_owner on public.outdoor_observations;
create trigger outdoor_observations_parcelle_owner before insert or update of parcelle_id, user_id on public.outdoor_observations for each row execute function public.validate_parcelle_owner();

-- Les données historiques doivent être contrôlées avant de rendre ces liens NOT NULL.
-- select * from public.verify_orphaned_data();
-- alter table public.crosses alter column weather_daily_id set not null;
-- alter table public.crosses alter column parcelle_id set not null; -- uniquement pour les croisements plein air
