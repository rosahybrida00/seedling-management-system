// ---------------------------------------------------------------------------
// crossService — croisements (Cross "A") et récoltes de fruits (HipHarvest "Aa").
//
// Corrige les points CRITIQUES du tableau :
//   - updateHarvest / updatePollination : upsert par clé stable (plus de
//     mise à jour perdue quand l'ID ne matche pas).
//   - stratégie d'ID unifiée : `newId()` génère l'unique identifiant, jamais
//     réattribué par la couche de stockage.
// ---------------------------------------------------------------------------

import type { Cross, HipHarvest } from "@/lib/domain/types"
import { newId, nowIso, normalizeCode } from "@/lib/domain/ids"
import { store as defaultStore, type JsonStore } from "@/lib/store/jsonStore"
import { mutate, upsertByIdOrStableKey } from "@/lib/store/repository"

export interface CreateCrossInput {
  code: string
  seedParent: string
  pollenParent: string
  pollinationDate?: string | null
  remarks?: string
}

export interface CreateHarvestInput {
  crossId: string
  code: string
  harvestDate?: string | null
  seedCount?: number
  remarks?: string
}

export class CrossService {
  constructor(private store: JsonStore = defaultStore) {}

  // ----- Croisements -------------------------------------------------------

  listCrosses(): Cross[] {
    return this.store.getAll("crosses")
  }

  getCross(id: string): Cross | undefined {
    return this.store.getAll("crosses").find((c) => c.id === id)
  }

  getCrossByCode(code: string): Cross | undefined {
    const key = normalizeCode(code)
    return this.store.getAll("crosses").find((c) => normalizeCode(c.code) === key)
  }

  createCross(input: CreateCrossInput): Cross {
    const ts = nowIso()
    const cross: Cross = {
      id: newId(), // ID unifié, défini une seule fois
      code: input.code.trim(),
      seedParent: input.seedParent.trim(),
      pollenParent: input.pollenParent.trim(),
      pollinationDate: input.pollinationDate ?? null,
      remarks: input.remarks ?? "",
      createdAt: ts,
      updatedAt: ts,
    }
    mutate(this.store, "crosses", (items) =>
      upsertByIdOrStableKey(items, cross, (c) => normalizeCode(c.code)),
    )
    return cross
  }

  /**
   * Met à jour la pollinisation d'un croisement.
   * Upsert par clé stable : si `id` est introuvable, on retombe sur le `code`.
   */
  updatePollination(
    crossOrId: Cross | string,
    changes: Partial<Pick<Cross, "pollinationDate" | "seedParent" | "pollenParent" | "remarks" | "code">>,
  ): Cross {
    const current =
      typeof crossOrId === "string" ? this.getCross(crossOrId) : crossOrId
    if (!current) {
      throw new Error(`Croisement introuvable: ${String(crossOrId)}`)
    }
    const next: Cross = { ...current, ...changes, updatedAt: nowIso() }
    mutate(this.store, "crosses", (items) =>
      upsertByIdOrStableKey(items, next, (c) => normalizeCode(c.code)),
    )
    return next
  }

  // ----- Récoltes (fruits) -------------------------------------------------

  listHarvests(crossId?: string): HipHarvest[] {
    const all = this.store.getAll("hipHarvests")
    return crossId ? all.filter((h) => h.crossId === crossId) : all
  }

  getHarvest(id: string): HipHarvest | undefined {
    return this.store.getAll("hipHarvests").find((h) => h.id === id)
  }

  getHarvestByCode(code: string): HipHarvest | undefined {
    const key = normalizeCode(code)
    return this.store
      .getAll("hipHarvests")
      .find((h) => normalizeCode(h.code) === key)
  }

  createHarvest(input: CreateHarvestInput): HipHarvest {
    const ts = nowIso()
    const harvest: HipHarvest = {
      id: newId(),
      crossId: input.crossId,
      code: input.code.trim(),
      harvestDate: input.harvestDate ?? null,
      seedCount: input.seedCount ?? 0,
      remarks: input.remarks ?? "",
      createdAt: ts,
      updatedAt: ts,
    }
    mutate(this.store, "hipHarvests", (items) =>
      upsertByIdOrStableKey(items, harvest, (h) => normalizeCode(h.code)),
    )
    return harvest
  }

  /**
   * Met à jour une récolte (date, nombre de graines, remarques...).
   * Upsert par clé stable pour éviter toute mise à jour perdue.
   */
  updateHarvest(
    harvestOrId: HipHarvest | string,
    changes: Partial<Pick<HipHarvest, "harvestDate" | "seedCount" | "remarks" | "code">>,
  ): HipHarvest {
    const current =
      typeof harvestOrId === "string" ? this.getHarvest(harvestOrId) : harvestOrId
    if (!current) {
      throw new Error(`Récolte introuvable: ${String(harvestOrId)}`)
    }
    const next: HipHarvest = { ...current, ...changes, updatedAt: nowIso() }
    mutate(this.store, "hipHarvests", (items) =>
      upsertByIdOrStableKey(items, next, (h) => normalizeCode(h.code)),
    )
    return next
  }
}

/** Instance partagée. */
export const crossService = new CrossService()
