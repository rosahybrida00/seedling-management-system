-- =====================================================================
-- Audit d'intégrité — données orphelines et triptyque incomplet
--
-- Script en LECTURE SEULE : aucune ligne n'est modifiée ni supprimée. Il
-- retourne un tableau récapitulatif, une ligne par vérification, avec le
-- nombre de lignes concernées. Un compte à 0 partout signifie que la
-- base est propre. À exécuter directement dans le SQL Editor de
-- Supabase (Run) — un seul résultat s'affiche, avec tout le détail.
--
-- Note : la plupart des FK de la migration 014 empêchent déjà la
-- création de NOUVELLES données orphelines (contraintes bloquantes).
-- Ce script sert à repérer les données ANCIENNES, créées avant ces
-- contraintes, qui pourraient ne pas les respecter.
-- =====================================================================

select 'crosses sans lot lié à une Serre NI une Parcelle' as verification,
       count(*) as nombre
from public.crosses
where greenhouse_table_id is null and parcelle_id is null

union all

select 'crosses sans météo enregistrée pour la date de pollinisation',
       count(*)
from public.crosses c
where c.pollination_date is not null
  and not exists (
    select 1 from public.weather_daily w
    where w.user_id = c.user_id and w.date = c.pollination_date
  )

union all

select 'cross_fruits dont le lot (cross_id) n''existe plus',
       count(*)
from public.cross_fruits f
where not exists (select 1 from public.crosses c where c.id = f.cross_id)

union all

select 'harvested_seeds dont le fruit (fruit_id) n''existe plus',
       count(*)
from public.harvested_seeds s
where not exists (select 1 from public.cross_fruits f where f.id = s.fruit_id)

union all

select 'seedlings dont le croisement (cross_id) n''existe plus',
       count(*)
from public.seedlings sl
where sl.cross_id is not null
  and not exists (select 1 from public.crosses c where c.id = sl.cross_id)

union all

select 'sowing_batches dont le fruit (fruit_id) n''existe plus',
       count(*)
from public.sowing_batches b
where b.fruit_id is not null
  and not exists (select 1 from public.cross_fruits f where f.id = b.fruit_id)

union all

select 'treatments dont le croisement (cross_id) n''existe plus',
       count(*)
from public.treatments t
where not exists (select 1 from public.crosses c where c.id = t.cross_id)

union all

select 'field_plantings sans variété du Catalogue NI Semis (ne devrait jamais arriver)',
       count(*)
from public.field_plantings
where variety_id is null and seedling_id is null

union all

select 'field_plantings sans Serre NI Parcelle (ne devrait jamais arriver)',
       count(*)
from public.field_plantings
where greenhouse_table_id is null and parcelle_id is null

union all

select 'field_observations sans météo enregistrée pour la date d''observation',
       count(*)
from public.field_observations o
where not exists (
  select 1 from public.weather_daily w
  where w.user_id = o.user_id and w.date = o.observation_date
)

union all

select 'field_observations dont la plantation (planting_id) n''existe plus',
       count(*)
from public.field_observations o
where not exists (select 1 from public.field_plantings p where p.id = o.planting_id)

union all

select 'field_programs sans aucune cible (plantation, serre ou parcelle) — ne devrait jamais arriver',
       count(*)
from public.field_programs
where planting_id is null and greenhouse_id is null and parcelle_id is null

union all

select 'pollen_lots sans date de récolte ni météo associée',
       count(*)
from public.pollen_lots
where harvest_date is null or weather_data = '{}'::jsonb

order by nombre desc, verification;
