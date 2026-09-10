// Point d'entrée unique de la couche métier (sélection de rosiers).
// import { seedlingService, crossService, greenhouseService } from "@/lib"

export * from "@/lib/domain/types"
export * from "@/lib/domain/ids"

export { JsonStore, store } from "@/lib/store/jsonStore"
export type { Database, CollectionName, StorageAdapter } from "@/lib/store/jsonStore"

export { CrossService, crossService } from "@/lib/services/crossService"
export {
  SeedlingService,
  seedlingService,
  buildSeedlingCode,
} from "@/lib/services/seedlingService"
export {
  GreenhouseService,
  greenhouseService,
} from "@/lib/services/greenhouseService"
export * from "@/lib/services/batchQuery"
