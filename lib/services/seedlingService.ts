// ---------------------------------------------------------------------------
// seedlingService — Système "Aa1"
//
//   Croisement A  ->  Fruit / récolte Aa  ->  Semis Aa1, Aa2, ...
//
// Responsabilités :
//   - Créer réellement un SowingBatch AU MOMENT DU SEMIS, en copiant
//     `harvestDate` et `seedCount` depuis la HipHarvest source.
//   - Générer le code des semis : fruitCode + index (ex. "Aa" + 1 => "Aa1").
//   - Gérer les statuts de semis : observing / discarded / selected.
//   - S'appuyer sur HipHarvest.remarks et l'ID unifié.
// ---------------------------------------------------------------------------

import type {
  HipHarvest,
  Seedling,
  SeedlingStatus,
  SowingBatch,
} from "@/lib/domain/types"
import { newId, nowIso } from "@/lib/domain/ids"
import { store as defaultStore, type JsonStore } from "@/lib/store/jsonStore"
import { mutate, patchById, removeById } from "@/lib/store/repository"

/**
 * Génère le code d'un semis à partir du code du fruit et d'un index.
 * Ex. buildSeedlingCode("Aa", 1) === "Aa1".
 */
export function buildSeedlingCode(fruitCode: string, index: number): string {
  return `${fruitCode.trim()}${index}`
}

export interface SowInput {
  /** Récolte source (fruit "Aa"). */
  hipHarvest: HipHarvest
  /** Date de semis (ISO). Par défaut : maintenant. */
  sowingDate?: string
  /** Emplacement optionnel (table de serre). */
  tableId?: string | null
  /** Remarques du lot. */
  remarks?: string
  /**
   * Nombre de semis individuels à générer immédiatement.
   * Par défaut : `seedCount` copié de la récolte.
   */
  generateSeedlings?: number
}

export class SeedlingService {
  constructor(private store: JsonStore = defaultStore) {}

  // ----- Lots de semis (SowingBatch) --------------------------------------

  listBatches(): SowingBatch[] {
    return this.store.getAll("sowingBatches")
  }

  getBatch(id: string): SowingBatch | undefined {
    return this.store.getAll("sowingBatches").find((b) => b.id === id)
  }

  /**
   * SEMIS : crée réellement un SowingBatch à partir d'une récolte, en copiant
   * `harvestDate` et `seedCount`. Génère optionnellement les semis Aa1..AaN.
   */
  sow(input: SowInput): { batch: SowingBatch; seedlings: Seedling[] } {
    const { hipHarvest } = input
    const ts = nowIso()

    const batch: SowingBatch = {
      id: newId(),
      hipHarvestId: hipHarvest.id,
      code: hipHarvest.code, // code du fruit, ex. "Aa"
      sowingDate: input.sowingDate ?? ts,
      // Copies explicites depuis la récolte source :
      harvestDate: hipHarvest.harvestDate,
      seedCount: hipHarvest.seedCount,
      tableId: input.tableId ?? null,
      remarks: input.remarks ?? "",
      createdAt: ts,
      updatedAt: ts,
    }

    mutate(this.store, "sowingBatches", (items) => [...items, batch])

    const count = input.generateSeedlings ?? hipHarvest.seedCount
    const seedlings =
      count > 0 ? this.generateSeedlings(batch, count) : []

    return { batch, seedlings }
  }

  /** Met à jour un lot de semis. */
  updateBatch(
    id: string,
    changes: Partial<Pick<SowingBatch, "sowingDate" | "harvestDate" | "seedCount" | "tableId" | "remarks">>,
  ): SowingBatch {
    const current = this.getBatch(id)
    if (!current) throw new Error(`Lot de semis introuvable: ${id}`)
    mutate(this.store, "sowingBatches", (items) => patchById(items, id, changes))
    return { ...current, ...changes, updatedAt: nowIso() }
  }

  // ----- Semis individuels (Seedling "Aa1") -------------------------------

  listSeedlings(batchId?: string): Seedling[] {
    const all = this.store.getAll("seedlings")
    return batchId ? all.filter((s) => s.batchId === batchId) : all
  }

  getSeedling(id: string): Seedling | undefined {
    return this.store.getAll("seedlings").find((s) => s.id === id)
  }

  /** Prochain index disponible dans un lot (1-based, sans collision). */
  private nextIndex(batchId: string): number {
    const existing = this.listSeedlings(batchId)
    return existing.reduce((max, s) => Math.max(max, s.index), 0) + 1
  }

  /**
   * Génère `count` semis pour un lot, codés fruitCode+index (Aa1, Aa2, ...).
   * Les indices continuent après les semis existants du lot.
   */
  generateSeedlings(batch: SowingBatch, count: number): Seedling[] {
    const start = this.nextIndex(batch.id)
    const ts = nowIso()
    const created: Seedling[] = []

    for (let i = 0; i < count; i++) {
      const index = start + i
      created.push({
        id: newId(),
        batchId: batch.id,
        code: buildSeedlingCode(batch.code, index), // ex. "Aa1"
        index,
        status: "observing", // statut initial
        remarks: "",
        createdAt: ts,
        updatedAt: ts,
      })
    }

    mutate(this.store, "seedlings", (items) => [...items, ...created])
    return created
  }

  /** Ajoute un unique semis au lot (index auto). */
  addSeedling(batchId: string, remarks = ""): Seedling {
    const batch = this.getBatch(batchId)
    if (!batch) throw new Error(`Lot de semis introuvable: ${batchId}`)
    const [seedling] = this.generateSeedlings(batch, 1)
    if (remarks) return this.updateSeedling(seedling.id, { remarks })
    return seedling
  }

  /** Met à jour un semis (statut, remarques...). */
  updateSeedling(
    id: string,
    changes: Partial<Pick<Seedling, "status" | "remarks">>,
  ): Seedling {
    const current = this.getSeedling(id)
    if (!current) throw new Error(`Semis introuvable: ${id}`)
    mutate(this.store, "seedlings", (items) => patchById(items, id, changes))
    return { ...current, ...changes, updatedAt: nowIso() }
  }

  /** Change le statut d'un semis : observing | discarded | selected. */
  setStatus(id: string, status: SeedlingStatus): Seedling {
    return this.updateSeedling(id, { status })
  }

  /** Supprime un semis. */
  removeSeedling(id: string): void {
    mutate(this.store, "seedlings", (items) => removeById(items, id))
  }

  /** Compte des semis d'un lot par statut. */
  countByStatus(batchId: string): Record<SeedlingStatus, number> {
    const counts: Record<SeedlingStatus, number> = {
      observing: 0,
      discarded: 0,
      selected: 0,
    }
    for (const s of this.listSeedlings(batchId)) counts[s.status]++
    return counts
  }
}

/** Instance partagée. */
export const seedlingService = new SeedlingService()
