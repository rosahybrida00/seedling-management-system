"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { crossService } from "@/lib/services/crossService"
import { seedlingService } from "@/lib/services/seedlingService"
import { greenhouseService } from "@/lib/services/greenhouseService"
import { store } from "@/lib/store/jsonStore"
import type {
  Cross,
  Greenhouse,
  GreenhouseTable,
  HipHarvest,
  Seedling,
  SowingBatch,
} from "@/lib/domain/types"

interface Snapshot {
  crosses: Cross[]
  hipHarvests: HipHarvest[]
  sowingBatches: SowingBatch[]
  seedlings: Seedling[]
  greenhouses: Greenhouse[]
  greenhouseTables: GreenhouseTable[]
}

interface DataContextValue extends Snapshot {
  cross: typeof crossService
  seedling: typeof seedlingService
  greenhouse: typeof greenhouseService
  /** Rejoue une action puis rafraîchit le snapshot. */
  run: <T>(action: () => T) => T
  refresh: () => void
  resetAll: () => void
}

const DataContext = createContext<DataContextValue | null>(null)

function readSnapshot(): Snapshot {
  return {
    crosses: crossService.listCrosses(),
    hipHarvests: crossService.listHarvests(),
    sowingBatches: seedlingService.listBatches(),
    seedlings: seedlingService.listSeedlings(),
    greenhouses: greenhouseService.listGreenhouses(),
    greenhouseTables: greenhouseService.listTables(),
  }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(readSnapshot)

  const refresh = useCallback(() => setSnapshot(readSnapshot()), [])

  const run = useCallback(
    <T,>(action: () => T): T => {
      const result = action()
      setSnapshot(readSnapshot())
      return result
    },
    [],
  )

  const resetAll = useCallback(() => {
    store.reset()
    setSnapshot(readSnapshot())
  }, [])

  const value = useMemo<DataContextValue>(
    () => ({
      ...snapshot,
      cross: crossService,
      seedling: seedlingService,
      greenhouse: greenhouseService,
      run,
      refresh,
      resetAll,
    }),
    [snapshot, run, refresh, resetAll],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error("useData doit être utilisé dans <DataProvider>")
  return ctx
}
