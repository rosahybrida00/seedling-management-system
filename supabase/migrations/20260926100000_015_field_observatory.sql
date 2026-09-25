-- 015 — Relevés terrain structurés pour le futur moteur RAG
create table if not exists public.field_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  seedling_id uuid references public.seedlings(id) on delete cascade,
  variety_id uuid references public.varieties(id) on delete set null,
  greenhouse_id uuid references public.greenhouses(id) on delete cascade,
  parcelle_id uuid references public.parcelles(id) on delete cascade,
  observation_date date not null,
  intervention_date date not null,
  weather_daily_id uuid not null references public.weather_daily(id) on delete restrict,
  observations text[] not null default '{}',
  notes text not null default '',
  intervention_passes integer not null default 1 check (intervention_passes > 0),
  intervention_result text not null default 'Amélioration' check (intervention_result in ('Amélioration', 'Stationnaire', 'Échec')),
  created_at timestamptz not null default now(),
  constraint field_observations_subject_check check ((seedling_id is not null) <> (variety_id is not null)),
  constraint field_observations_location_check check ((greenhouse_id is not null) <> (parcelle_id is not null)),
  constraint field_observations_dates_check check (intervention_date >= observation_date)
);

alter table public.field_observations enable row level security;
drop policy if exists field_observations_own on public.field_observations;
create policy field_observations_own on public.field_observations for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_field_observations_rag on public.field_observations(user_id, observation_date, weather_daily_id);

create or replace function public.validate_field_observation_integrity()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.weather_daily w where w.id = new.weather_daily_id and w.user_id = new.user_id and w.date = new.observation_date) then
    raise exception 'La météo historique doit appartenir à l’utilisateur et correspondre à la date d’observation';
  end if;
  if new.parcelle_id is not null and not exists (select 1 from public.parcelles p where p.id = new.parcelle_id and p.user_id = new.user_id) then
    raise exception 'La parcelle doit appartenir au même utilisateur';
  end if;
  return new;
end; $$;

drop trigger if exists field_observations_integrity on public.field_observations;
create trigger field_observations_integrity before insert or update on public.field_observations for each row execute function public.validate_field_observation_integrity();

create or replace view public.rag_field_observation_chain with (security_invoker = true) as
select f.id, f.user_id, f.observation_date, f.intervention_date, f.observations, f.notes, f.intervention_passes, f.intervention_result,
       f.seedling_id, f.variety_id, f.greenhouse_id, f.parcelle_id, f.weather_daily_id
from public.field_observations f;
grant select on public.rag_field_observation_chain to authenticated;

comment on table public.field_observations is 'Relevé terrain atomique : variété ou semis, serre ou parcelle, météo du jour, observation et intervention datées.';
comment on view public.rag_field_observation_chain is 'Chaînage propre pour le futur RAG agronomique.';
