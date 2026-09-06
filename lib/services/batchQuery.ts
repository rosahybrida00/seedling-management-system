// ---------------------------------------------------------------------------
// batchQuery — recherche et filtrage des lots de semis.
//
// Alimente l'écran "liste des lots" : filtre par plage de date de récolte et
// par plage de nombre de graines, plus tri et recherche texte.
// Fonctions pures (aucun accès au store) => faciles à tester et à brancher
// sur n'importe quelle UI.
// ---------------------------------------------------------------------------

import type { SowingBatch } from "@/lib/domain/types"

export interface BatchFilter {
  /** Recherche texte sur code / remarques. */
  query?: string
  /** Date de récolte minimale (ISO, incluse). */
  harvestFrom?: string | null
  /** Date de récolte maximale (ISO, incluse). */
  harvestTo?: string | null
  /** Nombre de graines minimal (inclus). */
  seedCountMin?: number | null
  /** Nombre de graines maximal (inclus). */
  seedCountMax?: number | null
}

export type BatchSortField = "harvestDate" | "seedCount" | "sowingDate" | "code"
export type SortDirection = "asc" | "desc"

export interface BatchSort {
  field: BatchSortField
  direction: SortDirection
}

function withinDateRange(
  value: string | null,
  from?: string | null,
  to?: string | null,
): boolean {
  if (from && (!value || value < from)) return false
  if (to && (!value || value > to)) return false
  return true
}

function withinNumberRange(
  value: number,
  min?: number | null,
  max?: number | null,
): boolean {
  if (min != null && value < min) return false
  if (max != null && value > max) return false
  return true
}

/** Filtre une liste de lots selon les critères fournis. */
export function filterBatches(
  batches: SowingBatch[],
  filter: BatchFilter,
): SowingBatch[] {
  const q = filter.query?.trim().toLowerCase()

  return batches.filter((b) => {
    if (q) {
      const haystack = `${b.code} ${b.remarks}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (!withinDateRange(b.harvestDate, filter.harvestFrom, filter.harvestTo)) {
      return false
    }
    if (!withinNumberRange(b.seedCount, filter.seedCountMin, filter.seedCountMax)) {
      return false
    }
    return true
  })
}

/** Trie une liste de lots (ne mute pas l'entrée). */
export function sortBatches(
  batches: SowingBatch[],
  sort: BatchSort,
): SowingBatch[] {
  const dir = sort.direction === "asc" ? 1 : -1
  return [...batches].sort((a, b) => {
    let cmp = 0
    switch (sort.field) {
      case "seedCount":
        cmp = a.seedCount - b.seedCount
        break
      case "harvestDate":
        cmp = (a.harvestDate ?? "").localeCompare(b.harvestDate ?? "")
        break
      case "sowingDate":
        cmp = a.sowingDate.localeCompare(b.sowingDate)
        break
      case "code":
        cmp = a.code.localeCompare(b.code, undefined, { numeric: true })
        break
    }
    return cmp * dir
  })
}

/** Combine filtre + tri en une passe. */
export function queryBatches(
  batches: SowingBatch[],
  filter: BatchFilter = {},
  sort?: BatchSort,
): SowingBatch[] {
  const filtered = filterBatches(batches, filter)
  return sort ? sortBatches(filtered, sort) : filtered
}
