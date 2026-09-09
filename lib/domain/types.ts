// ---------------------------------------------------------------------------
// Modèles de domaine — système de sélection végétale (rosiers)
//
// Hiérarchie de sélection :
//   Croisement (Cross) "A"
//     -> Fruit / récolte (HipHarvest) "Aa"
//        -> Semis (Seedling) "Aa1", "Aa2", ...
//
// Note sur les IDs : un seul champ `id` sert d'identifiant unifié (voir ids.ts).
// Chaque entité porte aussi un `code` métier stable et lisible (ex. "Aa1")
// utilisé pour l'upsert par clé stable et l'affichage.
// ---------------------------------------------------------------------------

/** Statut d'un semis. */
export type SeedlingStatus = "observing" | "discarded" | "selected"

export const SEEDLING_STATUSES: readonly SeedlingStatus[] = [
  "observing",
  "discarded",
  "selected",
] as const

/** Libellés d'affichage (FR) des statuts de semis. */
export const SEEDLING_STATUS_LABELS: Record<SeedlingStatus, string> = {
  observing: "En observation",
  discarded: "Éliminé",
  selected: "Sélectionné",
}

/** Champs communs à toutes les entités persistées. */
export interface Entity {
  /** Identifiant unifié (app == base). Voir ids.ts. */
  id: string
  /** Date de création (ISO 8601). */
  createdAt: string
  /** Date de dernière modification (ISO 8601). */
  updatedAt: string
}

/**
 * Croisement — l'acte de pollinisation entre deux parents.
 * `code` est la clé stable métier (ex. "A").
 */
export interface Cross extends Entity {
  code: string
  /** Parent femelle (porte-graine). */
  seedParent: string
  /** Parent mâle (pollen). */
  pollenParent: string
  /** Date de pollinisation (ISO 8601), optionnelle tant que non réalisée. */
  pollinationDate: string | null
  remarks: string
}

/**
 * Récolte du fruit (cynorrhodon / "hip") issu d'un croisement.
 * `code` est la clé stable métier (ex. "Aa").
 */
export interface HipHarvest extends Entity {
  /** Référence vers le croisement parent. */
  crossId: string
  code: string
  /** Date de récolte du fruit (ISO 8601). */
  harvestDate: string | null
  /** Nombre de graines récoltées. */
  seedCount: number
  /** Remarques libres sur la récolte. */
  remarks: string
}

/**
 * Lot de semis — créé au moment du semis à partir d'une récolte.
 * Copie `harvestDate` et `seedCount` depuis la HipHarvest source.
 */
export interface SowingBatch extends Entity {
  /** Référence vers la récolte source. */
  hipHarvestId: string
  /** Code de lot dérivé du fruit (ex. "Aa"). */
  code: string
  /** Date de semis (ISO 8601). */
  sowingDate: string
  /** Copie de la date de récolte de la HipHarvest source. */
  harvestDate: string | null
  /** Copie du nombre de graines de la HipHarvest source. */
  seedCount: number
  /** Emplacement optionnel : table de serre. */
  tableId: string | null
  remarks: string
}

/**
 * Semis individuel issu d'un lot.
 * `code` est la clé stable métier (ex. "Aa1").
 */
export interface Seedling extends Entity {
  /** Référence vers le lot de semis. */
  batchId: string
  /** Code métier stable (ex. "Aa1"). */
  code: string
  /** Index séquentiel dans le lot (1-based). */
  index: number
  status: SeedlingStatus
  remarks: string
}

/** Serre. */
export interface Greenhouse extends Entity {
  name: string
  remarks: string
}

/** Table (planche) à l'intérieur d'une serre. */
export interface GreenhouseTable extends Entity {
  greenhouseId: string
  name: string
  /** Capacité optionnelle (nombre de pots). */
  capacity: number | null
  remarks: string
}

