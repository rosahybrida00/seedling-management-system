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
  if (typeof window !== "undefined" && "localStorage" in window) {
    return new LocalStorageAdapter()
  }
  return new MemoryAdapter()
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
