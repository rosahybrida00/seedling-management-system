// ---------------------------------------------------------------------------
// Helpers de repository génériques, partagés par les services.
//
// Point clé : l'UPSERT PAR CLÉ STABLE. Historiquement, updateHarvest /
// updatePollination échouaient silencieusement quand l'ID ne correspondait à
// aucune ligne (ID app != ID base), laissant des données non mises à jour.
// Ici, si aucune ligne ne matche par `id`, on retombe sur une clé métier
// stable (ex. le `code`) au lieu de créer un orphelin ou de perdre la mise à
// jour.
// ---------------------------------------------------------------------------

import type { CollectionName, Database, JsonStore } from "@/lib/store/jsonStore"
import { nowIso } from "@/lib/domain/ids"

type Item = Database[CollectionName][number]

/** Trouve un élément par ID unifié. */
export function findById<T extends { id: string }>(
  items: T[],
  id: string,
): T | undefined {
  return items.find((it) => it.id === id)
}

/**
 * Upsert par ID unifié avec REPLI par clé stable.
 *
 * @param items       collection courante
 * @param next        entité à écrire (doit porter un `id`)
 * @param stableKeyOf fonction extrayant la clé stable (ex. `x => normalizeCode(x.code)`)
 * @returns nouvelle collection (immuable) — l'appelant persiste ensuite.
 */
export function upsertByIdOrStableKey<T extends { id: string; updatedAt: string }>(
  items: T[],
  next: T,
  stableKeyOf: (item: T) => string,
): T[] {
  const stamped = { ...next, updatedAt: nowIso() }

  // 1) match par ID unifié
  let idx = items.findIndex((it) => it.id === stamped.id)

  // 2) repli : match par clé stable (évite l'orphelin / la MAJ perdue)
  if (idx === -1) {
    const key = stableKeyOf(stamped)
    idx = items.findIndex((it) => stableKeyOf(it) === key)
    if (idx !== -1) {
      // On conserve l'ID déjà présent en base pour ne pas dupliquer la ligne.
      stamped.id = items[idx].id
    }
  }

  if (idx === -1) {
    return [...items, stamped]
  }
  const copy = [...items]
  copy[idx] = { ...items[idx], ...stamped }
  return copy
}

/** Supprime par ID et retourne la nouvelle collection. */
export function removeById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((it) => it.id !== id)
}

/** Applique une mise à jour partielle par ID, en horodatant. */
export function patchById<T extends { id: string; updatedAt: string }>(
  items: T[],
  id: string,
  patch: NoInfer<Partial<T>>,
): T[] {
  return items.map((it) =>
    it.id === id ? { ...it, ...patch, id: it.id, updatedAt: nowIso() } : it,
  )
}

/** Petit utilitaire : lit, transforme, réécrit une collection du store. */
export function mutate<K extends CollectionName>(
  store: JsonStore,
  name: K,
  fn: (items: Database[K]) => Database[K],
): void {
  const current = store.getAll(name)
  store.setAll(name, fn(current))
}

// Ré-export de type pour confort d'import côté services.
export type { Item }
