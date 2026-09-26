# Correctifs — Croisement/Serre/Météo + nouveau module Serres & Parcelles

Copiez ces fichiers par-dessus les mêmes chemins du dépôt, dans cet ordre :

1. Migrations SQL sur Supabase, dans l'ordre des numéros (010 à 014) :
   - 010, 012, 013 (déjà connues des passes précédentes)
   - Ne PAS rejouer 011 (obsolète)
   - `20260925090000_014_parcelle_field_module.sql` (nouveau : parcelles,
     field_plantings, field_observations, field_programs + intégrité)
2. Script d'audit (à exécuter à la main dans le SQL Editor quand vous le
   souhaitez, jamais automatiquement) :
   `supabase/scripts/audit_orphans.sql` — lecture seule, ne modifie rien.
3. `lib/domain/nomenclature.ts`, `lib/domain/supabase-types.ts`,
   `lib/domain/fieldLabels.ts` (nouveau)
4. `lib/services/weatherService.ts`, `lib/services/statsService.ts`
5. `app/croisement/page.tsx`, `app/serre/page.tsx`, `app/meteo/page.tsx`
6. `app/parcelle/page.tsx` (nouveau : Serres/Tables, Parcelles,
   Plantations, Observations, Programmes)
7. `npm run build` avant de déployer (non exécuté ici).

Voir le message de chat pour le détail de cette passe et pour la partie
RAG (non traitée — décisions d'architecture nécessaires d'abord).
