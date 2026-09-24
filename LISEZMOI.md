# Correctifs — Architecture Croisement + Serre + refonte UI (Focus/inline)

Copiez ces fichiers par-dessus les mêmes chemins du dépôt, dans cet ordre :

1. Migrations SQL sur Supabase :
   - `supabase/migrations/20260923090000_010_fix_croisement_architecture.sql`
   - Ne PAS rejouer `20260923150000_011_bridge_serre.sql` (gardée pour
     mémoire ; ciblait l'ancien modèle seedlings/batch_id, différent du
     vôtre — sans effet si vous la lancez quand même, mais inutile).
   - `supabase/migrations/20260923180000_012_bridge_serre_v2.sql`
     (cible le vrai schéma : seedlings.cross_id direct, fruit_code,
     seed_code — idempotente, peut être rejouée sans risque)
2. `lib/domain/nomenclature.ts`
3. `lib/domain/supabase-types.ts` (type Seedling étendu)
4. `app/croisement/page.tsx` (mode Focus, édition inline, suivi de
   nouaison par fruit, météo complète)
5. `app/serre/page.tsx` (lit directement seedlings.cross_id/fruit_code/
   table_id, sowing_batches redevient une info secondaire)
6. `lib/services/statsService.ts`
7. `npm run build` avant de déployer (non exécuté ici, aucun environnement
   Node avec les dépendances du projet n'était disponible).

Voir le message de chat pour le détail de ce qui a changé, ce qui a été
volontairement laissé de côté (module "Parcelle" séparé — non retrouvé
dans le code, seule la table `treatments` existante est utilisée), et un
bug pré-existant repéré mais non corrigé (taux de nouaison basé sur des
tables non encore branchées).
