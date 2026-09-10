// ---------------------------------------------------------------------------
// statsService — calculs statistiques Phase 3.
//
// Calcule à partir des données Supabase :
//   - Taux de nouaison réel (fruits récoltés / fleurs pollinisées)
//   - Taux de vacuité (fruits vides / total récolté)
//   - Bilan sanitaire (fréquence des pathologies, couverture des traitements)
//   - Bilan par variété parentale (performance Mère / Père)
//   - Index de fertilité génétique
//
// Toutes les fonctions de calcul sont pures. L'orchestrateur `fetchSeasonBilan`
// interroge Supabase puis délègue aux fonctions de calcul.
// ---------------------------------------------------------------------------

import { supabase } from "@/lib/supabase-client"

export interface MonthlyReport {
  month: string
  pollinatedFlowers: number
  harvestedFruits: number
  nouaisonRate: number
  emptyFruits: number
  vacuiteRate: number
  totalSeeds: number
  diseaseFrequency: Record<string, number>
  treatmentCoverage: number
}

export interface ParentPerformance {
  parentName: string
  role: "mere" | "pere"
  crossesCount: number
  fruitsHarvested: number
  emptyFruits: number
  nouaisonRate: number
  vacuiteRate: number
  avgSeedCount: number
  totalSeedlings: number
  selectedSeedlings: number
  discardedSeedlings: number
  fertilityIndex: number
}

export interface SeasonBilan {
  monthlyReports: MonthlyReport[]
  parentPerformances: ParentPerformance[]
  overall: {
    totalCrosses: number
    totalPollinatedFlowers: number
    totalHarvestedFruits: number
    overallNouaisonRate: number
    overallVacuiteRate: number
    totalSeeds: number
    totalSeedlings: number
    selectedSeedlings: number
    discardedSeedlings: number
    observingSeedlings: number
    diseaseDistribution: Record<string, number>
    treatmentDistribution: Record<string, number>
  }
}

export interface RawData {
  crosses: CrossRow[]
  harvests: HarvestRow[]
  seedlings: SeedlingRow[]
  pollenLots: PollenRow[]
}

interface CrossRow {
  id: string
  code: string
  seed_parent: string | null
  pollen_parent: string | null
  pollination_date: string | null
}

interface HarvestRow {
  id: string
  cross_id: string
  code: string
  harvest_date: string | null
  seed_count: number
  seed_extraction: string | null
  fruit_calibre: string | null
}

interface SeedlingRow {
  id: string
  batch_id: string
  code: string
  status: string
  phenotype_vigueur: string | null
  pression_sanitaire: string | null
  traitement: string | null
}

interface PollenRow {
  id: string
  lot_number: string
  rose_name: string | null
  anther_quality: string | null
  dehiscence: string | null
}

function monthKey(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function isEmptyFruit(h: HarvestRow): boolean {
  return h.seed_extraction === "totalement_vide" || (h.seed_count === 0 && h.seed_extraction !== "plein")
}

function computeNouaisonRate(pollinated: number, harvested: number): number {
  if (pollinated === 0) return 0
  return Math.round((harvested / pollinated) * 1000) / 10
}

function computeVacuiteRate(total: number, empty: number): number {
  if (total === 0) return 0
  return Math.round((empty / total) * 1000) / 10
}

function computeFertilityIndex(
  nouaisonRate: number,
  vacuiteRate: number,
  avgSeeds: number,
  selectedRatio: number,
): number {
  const nouaisonScore = Math.min(nouaisonRate / 100, 1) * 40
  const vacuiteScore = (1 - Math.min(vacuiteRate / 100, 1)) * 30
  const seedScore = Math.min(avgSeeds / 10, 1) * 15
  const selectionScore = selectedRatio * 15
  return Math.round((nouaisonScore + vacuiteScore + seedScore + selectionScore) * 10) / 10
}

export function buildMonthlyReports(
  crosses: CrossRow[],
  harvests: HarvestRow[],
  seedlings: SeedlingRow[],
): MonthlyReport[] {
  const months = new Map<string, {
    pollinated: number
    harvested: number
    empty: number
    seeds: number
    diseases: Record<string, number>
    treated: number
    totalSeedlings: number
  }>()

  for (const c of crosses) {
    const mk = monthKey(c.pollination_date)
    if (!months.has(mk)) months.set(mk, { pollinated: 0, harvested: 0, empty: 0, seeds: 0, diseases: {}, treated: 0, totalSeedlings: 0 })
    months.get(mk)!.pollinated += 1
  }

  const harvestByCross = new Map<string, HarvestRow[]>()
  for (const h of harvests) {
    const arr = harvestByCross.get(h.cross_id) ?? []
    arr.push(h)
    harvestByCross.set(h.cross_id, arr)
  }

  for (const c of crosses) {
    const mk = monthKey(c.pollination_date)
    const entry = months.get(mk)
    if (!entry) continue
    const cHarvests = harvestByCross.get(c.id) ?? []
    entry.harvested += cHarvests.length
    for (const h of cHarvests) {
      entry.seeds += h.seed_count
      if (isEmptyFruit(h)) entry.empty += 1
    }
  }

  for (const s of seedlings) {
    const batch = harvests.find((h) => h.id === s.batch_id)
    const cross = batch ? crosses.find((c) => c.id === batch.cross_id) : null
    if (!cross) continue
    const mk = monthKey(cross.pollination_date)
    const entry = months.get(mk)
    if (!entry) continue
    entry.totalSeedlings += 1
    if (s.pression_sanitaire) {
      entry.diseases[s.pression_sanitaire] = (entry.diseases[s.pression_sanitaire] ?? 0) + 1
    }
    if (s.traitement) {
      entry.treated += 1
    }
  }

  const sorted = Array.from(months.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  return sorted.map(([month, d]) => ({
    month,
    pollinatedFlowers: d.pollinated,
    harvestedFruits: d.harvested,
    nouaisonRate: computeNouaisonRate(d.pollinated, d.harvested),
    emptyFruits: d.empty,
    vacuiteRate: computeVacuiteRate(d.harvested, d.empty),
    totalSeeds: d.seeds,
    diseaseFrequency: d.diseases,
    treatmentCoverage: d.totalSeedlings > 0 ? Math.round((d.treated / d.totalSeedlings) * 1000) / 10 : 0,
  }))
}

export function buildParentPerformances(
  crosses: CrossRow[],
  harvests: HarvestRow[],
  seedlings: SeedlingRow[],
): ParentPerformance[] {
  const harvestByCross = new Map<string, HarvestRow[]>()
  for (const h of harvests) {
    const arr = harvestByCross.get(h.cross_id) ?? []
    arr.push(h)
    harvestByCross.set(h.cross_id, arr)
  }

  type ParentAccum = {
    parentName: string
    role: "mere" | "pere"
    crossesCount: number
    fruitsHarvested: number
    emptyFruits: number
    totalSeeds: number
    totalSeedlings: number
    selectedSeedlings: number
    discardedSeedlings: number
  }

  const parents = new Map<string, ParentAccum>()

  function track(name: string | null, role: "mere" | "pere", cross: CrossRow) {
    if (!name) return
    const key = `${role}:${name}`
    if (!parents.has(key)) {
      parents.set(key, {
        parentName: name,
        role,
        crossesCount: 0,
        fruitsHarvested: 0,
        emptyFruits: 0,
        totalSeeds: 0,
        totalSeedlings: 0,
        selectedSeedlings: 0,
        discardedSeedlings: 0,
      })
    }
    const acc = parents.get(key)!
    acc.crossesCount += 1
    const cHarvests = harvestByCross.get(cross.id) ?? []
    acc.fruitsHarvested += cHarvests.length
    for (const h of cHarvests) {
      acc.totalSeeds += h.seed_count
      if (isEmptyFruit(h)) acc.emptyFruits += 1
    }
    for (const h of cHarvests) {
      for (const s of seedlings) {
        if (s.batch_id === h.id) {
          acc.totalSeedlings += 1
          if (s.status === "selected") acc.selectedSeedlings += 1
          if (s.status === "discarded") acc.discardedSeedlings += 1
        }
      }
    }
  }

  for (const c of crosses) {
    track(c.seed_parent, "mere", c)
    track(c.pollen_parent, "pere", c)
  }

  return Array.from(parents.values())
    .map((acc) => {
      const nouaisonRate = computeNouaisonRate(acc.crossesCount, acc.fruitsHarvested)
      const vacuiteRate = computeVacuiteRate(acc.fruitsHarvested, acc.emptyFruits)
      const avgSeedCount = acc.fruitsHarvested > 0 ? Math.round((acc.totalSeeds / acc.fruitsHarvested) * 10) / 10 : 0
      const selectedRatio = acc.totalSeedlings > 0 ? acc.selectedSeedlings / acc.totalSeedlings : 0
      const fertilityIndex = computeFertilityIndex(nouaisonRate, vacuiteRate, avgSeedCount, selectedRatio)
      return {
        parentName: acc.parentName,
        role: acc.role,
        crossesCount: acc.crossesCount,
        fruitsHarvested: acc.fruitsHarvested,
        emptyFruits: acc.emptyFruits,
        nouaisonRate,
        vacuiteRate,
        avgSeedCount,
        totalSeedlings: acc.totalSeedlings,
        selectedSeedlings: acc.selectedSeedlings,
        discardedSeedlings: acc.discardedSeedlings,
        fertilityIndex,
      }
    })
    .sort((a, b) => b.fertilityIndex - a.fertilityIndex)
}

export function buildSeasonBilan(raw: RawData): SeasonBilan {
  const monthlyReports = buildMonthlyReports(raw.crosses, raw.harvests, raw.seedlings)
  const parentPerformances = buildParentPerformances(raw.crosses, raw.harvests, raw.seedlings)

  const totalCrosses = raw.crosses.length
  const totalPollinatedFlowers = raw.crosses.length
  const totalHarvestedFruits = raw.harvests.length
  const totalEmpty = raw.harvests.filter(isEmptyFruit).length
  const totalSeeds = raw.harvests.reduce((sum, h) => sum + h.seed_count, 0)

  const diseaseDistribution: Record<string, number> = {}
  const treatmentDistribution: Record<string, number> = {}
  let selectedSeedlings = 0
  let discardedSeedlings = 0
  let observingSeedlings = 0

  for (const s of raw.seedlings) {
    if (s.status === "selected") selectedSeedlings += 1
    if (s.status === "discarded") discardedSeedlings += 1
    if (s.status === "observing") observingSeedlings += 1
    if (s.pression_sanitaire) {
      diseaseDistribution[s.pression_sanitaire] = (diseaseDistribution[s.pression_sanitaire] ?? 0) + 1
    }
    if (s.traitement) {
      treatmentDistribution[s.traitement] = (treatmentDistribution[s.traitement] ?? 0) + 1
    }
  }

  return {
    monthlyReports,
    parentPerformances,
    overall: {
      totalCrosses,
      totalPollinatedFlowers,
      totalHarvestedFruits,
      overallNouaisonRate: computeNouaisonRate(totalPollinatedFlowers, totalHarvestedFruits),
      overallVacuiteRate: computeVacuiteRate(totalHarvestedFruits, totalEmpty),
      totalSeeds,
      totalSeedlings: raw.seedlings.length,
      selectedSeedlings,
      discardedSeedlings,
      observingSeedlings,
      diseaseDistribution,
      treatmentDistribution,
    },
  }
}

export async function fetchRawData(): Promise<RawData> {
  const [{ data: cData }, { data: hData }, { data: sData }, { data: pData }] = await Promise.all([
    supabase.from("crosses").select("id, code, seed_parent, pollen_parent, pollination_date").order("created_at", { ascending: false }),
    supabase.from("hip_harvests").select("id, cross_id, code, harvest_date, seed_count, seed_extraction, fruit_calibre").order("created_at", { ascending: false }),
    supabase.from("seedlings").select("id, batch_id, code, status, phenotype_vigueur, pression_sanitaire, traitement").order("created_at", { ascending: false }),
    supabase.from("pollen_lots").select("id, lot_number, rose_name, anther_quality, dehiscence").order("created_at", { ascending: false }),
  ])

  return {
    crosses: (cData ?? []) as CrossRow[],
    harvests: (hData ?? []) as HarvestRow[],
    seedlings: (sData ?? []) as SeedlingRow[],
    pollenLots: (pData ?? []) as PollenRow[],
  }
}

export async function fetchSeasonBilan(): Promise<SeasonBilan> {
  const raw = await fetchRawData()
  return buildSeasonBilan(raw)
}
