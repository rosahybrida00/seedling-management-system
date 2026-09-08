"use client"

import { useEffect, useState, useMemo } from "react"
import { Search, Download, Trash2, Sprout, Leaf, Warehouse, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/layout/app-shell"
import { supabase } from "@/lib/supabase-client"
import { Card, Badge, EmptyState, Select } from "@/components/breeding/ui"
import { formatDate } from "@/components/breeding/format"

interface Greenhouse {
  id: string
  name: string
}

interface GreenhouseTable {
  id: string
  greenhouse_id: string
  name: string
}

interface SowingBatch {
  id: string
  hip_harvest_id: string
  code: string
  sowing_date: string
  harvest_date: string | null
  seed_count: number
  table_id: string | null
  remarks: string
  created_at: string
}

interface Seedling {
  id: string
  batch_id: string
  code: string
  index: number
  status: "observing" | "discarded" | "selected"
  remarks: string
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  observing: "En observation",
  discarded: "Éliminé",
  selected: "Sélectionné",
}

const STATUS_TONES: Record<string, "neutral" | "primary" | "warning" | "danger"> = {
  observing: "warning",
  discarded: "danger",
  selected: "primary",
}

export default function SerrePage() {
  return (
    <AppShell>
      <SerreContent />
    </AppShell>
  )
}

function SerreContent() {
  const [seedlings, setSeedlings] = useState<Seedling[]>([])
  const [batches, setBatches] = useState<SowingBatch[]>([])
  const [tables, setTables] = useState<GreenhouseTable[]>([])
  const [greenhouses, setGreenhouses] = useState<Greenhouse[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [greenhouseFilter, setGreenhouseFilter] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const [seed, bat, tbl, gh] = await Promise.all([
      supabase.from("seedlings").select("*").order("code"),
      supabase.from("sowing_batches").select("*").order("sowing_date", { ascending: false }),
      supabase.from("greenhouse_tables").select("id, greenhouse_id, name").order("name"),
      supabase.from("greenhouses").select("id, name").order("name"),
    ])
    if (seed.data) setSeedlings(seed.data as Seedling[])
    if (bat.data) setBatches(bat.data as SowingBatch[])
    if (tbl.data) setTables(tbl.data as GreenhouseTable[])
    if (gh.data) setGreenhouses(gh.data as Greenhouse[])
    setLoading(false)
  }

  const batchMap = useMemo(() => {
    const m = new Map<string, SowingBatch>()
    batches.forEach((b) => m.set(b.id, b))
    return m
  }, [batches])

  const tableMap = useMemo(() => {
    const m = new Map<string, GreenhouseTable>()
    tables.forEach((t) => m.set(t.id, t))
    return m
  }, [tables])

  const greenhouseMap = useMemo(() => {
    const m = new Map<string, Greenhouse>()
    greenhouses.forEach((g) => m.set(g.id, g))
    return m
  }, [greenhouses])

  function seedlingGreenhouseId(s: Seedling): string | null {
    const batch = batchMap.get(s.batch_id)
    if (!batch || !batch.table_id) return null
    const tbl = tableMap.get(batch.table_id)
    return tbl ? tbl.greenhouse_id : null
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return seedlings.filter((s) => {
      if (q) {
        const batch = batchMap.get(s.batch_id)
        const haystack = `${s.code} ${s.remarks ?? ""} ${batch?.code ?? ""} ${batch?.remarks ?? ""}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (statusFilter && s.status !== statusFilter) return false
      if (greenhouseFilter) {
        const ghId = seedlingGreenhouseId(s)
        if (ghId !== greenhouseFilter) return false
      }
      return true
    })
  }, [seedlings, query, statusFilter, greenhouseFilter, batchMap, tableMap])

  async function handleExport() {
    const csv = [
      "Code,Statut,Lot,Date semis,Graines,Serre,Table,Remarques",
      ...filtered.map((s) => {
        const batch = batchMap.get(s.batch_id)
        const tbl = batch?.table_id ? tableMap.get(batch.table_id) : null
        const gh = tbl ? greenhouseMap.get(tbl.greenhouse_id) : null
        return [
          `"${s.code}"`,
          `"${STATUS_LABELS[s.status]}"`,
          `"${batch?.code ?? ""}"`,
          `"${batch ? formatDate(batch.sowing_date) : ""}"`,
          `"${batch?.seed_count ?? ""}"`,
          `"${gh?.name ?? ""}"`,
          `"${tbl?.name ?? ""}"`,
          `"${s.remarks ?? ""}"`,
        ].join(",")
      }),
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "catalogue-semis.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDeleteAll() {
    if (!confirm("Supprimer tous vos semis ?")) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    await supabase.from("seedlings").delete().eq("user_id", userData.user.id)
    fetchData()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Catalogue des Semis</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filtered.length} semis — recherchez par code, lot ou remarque.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="size-4" /> Exporter
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDeleteAll} className="gap-1.5">
            <Trash2 className="size-4" /> Tout supprimer
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par code, lot, remarque…"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
        >
          <option value="">Tous statuts</option>
          <option value="observing">En observation</option>
          <option value="selected">Sélectionné</option>
          <option value="discarded">Éliminé</option>
        </Select>
        <Select
          value={greenhouseFilter}
          onChange={(e) => setGreenhouseFilter(e.target.value)}
          className="w-44"
        >
          <option value="">Toutes serres</option>
          {greenhouses.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Sprout className="size-8 animate-pulse text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Sprout className="size-8" />}
          title="Aucun semis trouvé"
          description="Créez des croisements et des lots de semis depuis la page Croisement, ou modifiez vos critères de recherche."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s) => (
            <SeedlingCard
              key={s.id}
              seedling={s}
              batch={batchMap.get(s.batch_id) ?? null}
              table={batchMap.get(s.batch_id)?.table_id ? tableMap.get(batchMap.get(s.batch_id)!.table_id!) ?? null : null}
              greenhouse={(() => {
                const batch = batchMap.get(s.batch_id)
                const tbl = batch?.table_id ? tableMap.get(batch.table_id) : null
                return tbl ? greenhouseMap.get(tbl.greenhouse_id) ?? null : null
              })()}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SeedlingCard({
  seedling,
  batch,
  table,
  greenhouse,
}: {
  seedling: Seedling
  batch: SowingBatch | null
  table: GreenhouseTable | null
  greenhouse: Greenhouse | null
}) {
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative flex aspect-[4/3] items-center justify-center bg-primary/5">
        <Leaf className="size-10 text-primary/30" />
        <div className="absolute top-2 right-2">
          <Badge tone={STATUS_TONES[seedling.status] ?? "neutral"}>
            {STATUS_LABELS[seedling.status]}
          </Badge>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-serif text-base leading-tight text-foreground">{seedling.code}</h3>
        {batch ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Lot {batch.code} · {batch.seed_count} graine(s)
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {greenhouse ? (
            <Badge tone="neutral">
              <Warehouse className="size-3" /> {greenhouse.name}
            </Badge>
          ) : null}
          {table ? (
            <Badge tone="neutral">
              <Table2 className="size-3" /> {table.name}
            </Badge>
          ) : null}
        </div>
        {batch ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Semé le {formatDate(batch.sowing_date)}
          </p>
        ) : null}
        {seedling.remarks ? (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{seedling.remarks}</p>
        ) : null}
      </div>
    </Card>
  )
}
