// ---------------------------------------------------------------------------
// Store JSON — remplace l'ancien stockage HTML.
//
// Les données étaient auparavant sérialisées en HTML (fragile à parser et à
// faire évoluer). On persiste désormais en JSON pur : un unique document
// contenant toutes les collections, sérialisé/désérialisé de façon sûre.
//
// La persistance est abstraite derrière `StorageAdapter` :
//   - navigateur  -> localStorage
//   - serveur/SSR -> mémoire (pas de fuite entre requêtes voulue au niveau lib)
//
// L'ID unifié (voir ids.ts) est TOUJOURS la clé primaire. Le store ne
// réattribue jamais d'identifiant.
// ---------------------------------------------------------------------------

import { supabase } from "@/lib/supabase-client"
import type {
  Cross,
  Greenhouse,
  GreenhouseTable,
  HipHarvest,
  Seedling,
  SowingBatch,
} from "@/lib/domain/types"

/** Forme du document JSON persisté. */
export interface Database {
  version: number
  crosses: Cross[]
  hipHarvests: HipHarvest[]
  sowingBatches: SowingBatch[]
  seedlings: Seedling[]
  greenhouses: Greenhouse[]
  greenhouseTables: GreenhouseTable[]
}

export type CollectionName = Exclude<keyof Database, "version">

const CURRENT_VERSION = 1
const STORAGE_KEY = "breeding.db.v1"

function emptyDatabase(): Database {
  return {
    version: CURRENT_VERSION,
    crosses: [],
    hipHarvests: [],
    sowingBatches: [],
    seedlings: [],
    greenhouses: [],
    greenhouseTables: [],
  }
}

/** Contrat minimal d'un backend de persistance. */
export interface StorageAdapter {
  read(): string | null
  write(value: string): void
}

/** Adapter localStorage (navigateur). */
class LocalStorageAdapter implements StorageAdapter {
  read(): string | null {
    return window.localStorage.getItem(STORAGE_KEY)
  }
  write(value: string): void {
    window.localStorage.setItem(STORAGE_KEY, value)
  }
}

/** Adapter mémoire (SSR / tests). */
class MemoryAdapter implements StorageAdapter {
  private value: string | null = null
  read(): string | null {
    return this.value
  }
  write(value: string): void {
    this.value = value
  }
}

function defaultAdapter(): StorageAdapter {
  return new MemoryAdapter()
}

const columnMap: Record<string, string> = {
  createdAt: "created_at", updatedAt: "updated_at", crossId: "cross_id", harvestDate: "harvest_date",
  seedCount: "seed_count", hipHarvestId: "hip_harvest_id", sowingDate: "sowing_date", tableId: "table_id",
  greenhouseId: "greenhouse_id", seedling_code: "seedling_code", evaluation_status: "evaluation_status",
  free_notes: "free_notes", is_promoted_to_variety: "is_promoted_to_variety", index: "seedling_index",
}

function toSupabaseRow(name: CollectionName, item: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = { ...item }
  for (const [from, to] of Object.entries(columnMap)) {
    if (from in row) { row[to] = row[from]; delete row[from] }
  }
  if (name === "seedlings" && !row.status) row.status = "observing"
  return row
}

function fromSupabaseRow(row: Record<string, unknown>): Record<string, unknown> {
  const item: Record<string, unknown> = { ...row }
  for (const [from, to] of Object.entries(columnMap)) {
    if (to in item) { item[from] = item[to]; delete item[to] }
  }
  return item
}

/**
 * Store JSON. Une instance = une base. Sérialisation JSON explicite,
 * jamais de HTML. Toute mutation passe par `save()` pour rester atomique.
 */
export class JsonStore {
  private adapter: StorageAdapter
  private db: Database

  constructor(adapter: StorageAdapter = defaultAdapter()) {
    this.adapter = adapter
    this.db = this.load()
  }

  private load(): Database {
    const raw = this.adapter.read()
    if (!raw) return emptyDatabase()
    try {
      const parsed = JSON.parse(raw) as Partial<Database>
      return this.migrate(parsed)
    } catch {
      // Document corrompu : on repart sur une base vide plutôt que de crasher.
      return emptyDatabase()
    }
  }

  /** Fusion défensive avec la forme courante (tolérante aux champs manquants). */
  private migrate(parsed: Partial<Database>): Database {
    const base = emptyDatabase()
    return {
      version: CURRENT_VERSION,
      crosses: parsed.crosses ?? base.crosses,
      hipHarvests: parsed.hipHarvests ?? base.hipHarvests,
      sowingBatches: parsed.sowingBatches ?? base.sowingBatches,
      seedlings: parsed.seedlings ?? base.seedlings,
      greenhouses: parsed.greenhouses ?? base.greenhouses,
      greenhouseTables: parsed.greenhouseTables ?? base.greenhouseTables,
    }
  }

  /** Persiste le document courant en JSON. */
  save(): void {
    this.adapter.write(JSON.stringify(this.db))
  }

  /** Accès en lecture à une collection (copie défensive). */
  getAll<K extends CollectionName>(name: K): Database[K] {
    return [...this.db[name]] as Database[K]
  }

  /** Remplace intégralement une collection puis persiste. */
  setAll<K extends CollectionName>(name: K, items: Database[K]): void {
    this.db[name] = items
    this.save()
    void this.persistCollection(name, items)
  }

  async hydrateFromSupabase(): Promise<void> {
    const tables: Record<CollectionName, string> = {
      crosses: "crosses",
      hipHarvests: "hip_harvests",
      sowingBatches: "sowing_batches",
      seedlings: "seedlings",
      greenhouses: "greenhouses",
      greenhouseTables: "greenhouse_tables",
    }
    const results = await Promise.all(
      (Object.entries(tables) as [CollectionName, string][]).map(async ([name, table]) => {
        const { data, error } = await supabase.from(table).select("*").order("created_at")
        if (error) throw error
        return [name, data ?? []] as const
      }),
    )
    for (const [name, rows] of results) this.db[name] = rows.map(fromSupabaseRow) as Database[typeof name]
  }

  private async persistCollection<K extends CollectionName>(name: K, items: Database[K]): Promise<void> {
    const tables: Record<CollectionName, string> = {
      crosses: "crosses", hipHarvests: "hip_harvests", sowingBatches: "sowing_batches",
      seedlings: "seedlings", greenhouses: "greenhouses", greenhouseTables: "greenhouse_tables",
    }
    const table = tables[name]
    const rows = (items as Array<Record<string, unknown>>).map((item) => toSupabaseRow(name, item))
    const { error } = await supabase.from(table).upsert(rows, { onConflict: name === "crosses" || name === "greenhouses" || name === "greenhouseTables" ? "id" : "id" })
    if (error) console.error("[v0] Supabase persistence error", { table, error: error.message })
  }

  /** Retourne le document complet (copie défensive). */
  snapshot(): Database {
    return JSON.parse(JSON.stringify(this.db)) as Database
  }

  /** Réinitialise entièrement la base. */
  reset(): void {
    this.db = emptyDatabase()
    this.save()
  }
}

/** Instance partagée par défaut. */
export const store = new JsonStore()
