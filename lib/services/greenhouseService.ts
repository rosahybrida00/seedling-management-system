// ---------------------------------------------------------------------------
// greenhouseService — serres et tables (planches).
//
// Ajoute les méthodes manquantes du tableau :
//   - updateGreenhouse
//   - updateTable
//   - deleteTable   (avec détachement des lots posés sur la table)
//   - updateBatch   (repositionnement d'un lot sur une table)
// ---------------------------------------------------------------------------

import type { Greenhouse, GreenhouseTable } from "@/lib/domain/types"
import { newId, nowIso } from "@/lib/domain/ids"
import { store as defaultStore, type JsonStore } from "@/lib/store/jsonStore"
import { mutate, patchById, removeById } from "@/lib/store/repository"

export interface CreateGreenhouseInput {
  name: string
  remarks?: string
}

export interface CreateTableInput {
  greenhouseId: string
  name: string
  capacity?: number | null
  remarks?: string
}

export class GreenhouseService {
  constructor(private store: JsonStore = defaultStore) {}

  // ----- Serres ------------------------------------------------------------

  listGreenhouses(): Greenhouse[] {
    return this.store.getAll("greenhouses")
  }

  getGreenhouse(id: string): Greenhouse | undefined {
    return this.store.getAll("greenhouses").find((g) => g.id === id)
  }

  createGreenhouse(input: CreateGreenhouseInput): Greenhouse {
    const ts = nowIso()
    const greenhouse: Greenhouse = {
      id: newId(),
      name: input.name.trim(),
      remarks: input.remarks ?? "",
      createdAt: ts,
      updatedAt: ts,
    }
    mutate(this.store, "greenhouses", (items) => [...items, greenhouse])
    return greenhouse
  }

  /** Édite une serre existante. */
  updateGreenhouse(
    id: string,
    changes: Partial<Pick<Greenhouse, "name" | "remarks">>,
  ): Greenhouse {
    const current = this.getGreenhouse(id)
    if (!current) throw new Error(`Serre introuvable: ${id}`)
    mutate(this.store, "greenhouses", (items) => patchById(items, id, changes))
    return { ...current, ...changes, updatedAt: nowIso() }
  }

  /** Supprime une serre et toutes ses tables (les lots sont détachés). */
  deleteGreenhouse(id: string): void {
    const tables = this.listTables(id)
    for (const t of tables) this.deleteTable(t.id)
    mutate(this.store, "greenhouses", (items) => removeById(items, id))
  }

  // ----- Tables ------------------------------------------------------------

  listTables(greenhouseId?: string): GreenhouseTable[] {
    const all = this.store.getAll("greenhouseTables")
    return greenhouseId ? all.filter((t) => t.greenhouseId === greenhouseId) : all
  }

  getTable(id: string): GreenhouseTable | undefined {
    return this.store.getAll("greenhouseTables").find((t) => t.id === id)
  }

  createTable(input: CreateTableInput): GreenhouseTable {
    const ts = nowIso()
    const table: GreenhouseTable = {
      id: newId(),
      greenhouseId: input.greenhouseId,
      name: input.name.trim(),
      capacity: input.capacity ?? null,
      remarks: input.remarks ?? "",
      createdAt: ts,
      updatedAt: ts,
    }
    mutate(this.store, "greenhouseTables", (items) => [...items, table])
    return table
  }

  /** Édite une table existante. */
  updateTable(
    id: string,
    changes: Partial<Pick<GreenhouseTable, "name" | "capacity" | "remarks" | "greenhouseId">>,
  ): GreenhouseTable {
    const current = this.getTable(id)
    if (!current) throw new Error(`Table introuvable: ${id}`)
    mutate(this.store, "greenhouseTables", (items) => patchById(items, id, changes))
    return { ...current, ...changes, updatedAt: nowIso() }
  }

  /**
   * Supprime une table. Les lots de semis qui y étaient posés sont détachés
   * (tableId = null) pour ne pas devenir des références orphelines.
   */
  deleteTable(id: string): void {
    mutate(this.store, "sowingBatches", (batches) =>
      batches.map((b) =>
        b.tableId === id ? { ...b, tableId: null, updatedAt: nowIso() } : b,
      ),
    )
    mutate(this.store, "greenhouseTables", (items) => removeById(items, id))
  }

  // ----- Positionnement d'un lot sur une table -----------------------------

  /** Déplace (ou retire) un lot de semis sur une table. */
  updateBatch(batchId: string, tableId: string | null): void {
    mutate(this.store, "sowingBatches", (items) =>
      patchById(items, batchId, { tableId }),
    )
  }

  /** Lots posés sur une table. */
  batchesOnTable(tableId: string) {
    return this.store.getAll("sowingBatches").filter((b) => b.tableId === tableId)
  }
}

/** Instance partagée. */
export const greenhouseService = new GreenhouseService()
