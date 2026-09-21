// ---------------------------------------------------------------------------
// crossService — croisements (Cross "A") et récoltes de fruits (HipHarvest "Aa").
//
// Corrige les points CRITIQUES du tableau :
//   - updateHarvest / updatePollination : upsert par clé stable (plus de
//     mise à jour perdue quand l'ID ne matche pas).
//   - stratégie d'ID unifiée : `newId()` génère l'unique identifiant, jamais
//     réattribué par la couche de stockage.
// ---------------------------------------------------------------------------

import type { Cross, CrossFruit, CrossLot, EventLog, HipHarvest } from "@/lib/domain/types"
import { newId, nowIso, normalizeCode } from "@/lib/domain/ids"
import { store as defaultStore, type JsonStore } from "@/lib/store/jsonStore"
import { mutate, upsertByIdOrStableKey } from "@/lib/store/repository"

export interface CreateCrossInput {
  code: string
  root?: string
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
      root: input.root?.trim() || input.code.trim(),
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

  // ----- Lots et fruits ----------------------------------------------------

  listLots(crossId?: string): CrossLot[] {
    const lots = this.store.getAll("crossLots")
    return crossId ? lots.filter((lot) => lot.crossId === crossId) : lots
  }

  listFruits(lotId?: string): CrossFruit[] {
    const fruits = this.store.getAll("crossFruits")
    return lotId ? fruits.filter((fruit) => fruit.lotId === lotId) : fruits
  }

  createLot(input: Omit<CrossLot, "id" | "createdAt" | "updatedAt" | "lotLetter">): CrossLot {
    const ts = nowIso()
    const existing = this.listLots(input.crossId)
    const lotLetter = String.fromCharCode(65 + existing.length)
    const lot: CrossLot = { ...input, id: newId(), lotLetter, createdAt: ts, updatedAt: ts }
    mutate(this.store, "crossLots", (items) => [...items, lot])
    this.log("lot.created", `Lot ${lotLetter} créé`, { lotId: lot.id, crossId: lot.crossId })
    return lot
  }

  createFruits(lot: CrossLot, count: number): CrossFruit[] {
    if (!Number.isInteger(count) || count < 1) throw new Error("Le nombre de fleurs doit être positif")
    const ts = nowIso()
    const fruits = Array.from({ length: count }, (_, index) => ({
      id: newId(), lotId: lot.id, fruitLetter: String.fromCharCode(97 + index), outcome: "pending" as const,
      harvestDate: null, calibre: "", maturation: "", seedCount: null, extractionStatus: "", abortionCauses: [], createdAt: ts, updatedAt: ts,
    }))
    mutate(this.store, "crossFruits", (items) => [...items.filter((fruit) => fruit.lotId !== lot.id), ...fruits])
    mutate(this.store, "crossLots", (items) => items.map((item) => item.id === lot.id ? { ...item, flowerCount: count, updatedAt: ts } : item))
    return fruits
  }

  updateFruit(fruit: CrossFruit, changes: Partial<CrossFruit>): CrossFruit {
    const next = { ...fruit, ...changes, updatedAt: nowIso() }
    mutate(this.store, "crossFruits", (items) => items.map((item) => item.id === fruit.id ? next : item))
    this.log("fruit.updated", `Fruit ${next.fruitLetter} mis à jour`, { fruitId: next.id })
    return next
  }

  listEventLog(): EventLog[] { return this.store.getAll("eventLog") }

  private log(type: EventLog["type"], label: string, payload: Record<string, unknown>): void {
    const ts = nowIso()
    mutate(this.store, "eventLog", (items) => [...items, { id: newId(), type: type === "weather_alert" ? type : "action", label, payload, createdAt: ts, updatedAt: ts }])
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
