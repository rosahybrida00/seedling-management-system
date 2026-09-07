"use client"

import { useEffect, useState } from "react"
import { Plus, Sprout, Warehouse, Pencil, Check, X, Trash2, Table2, Leaf } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/layout/app-shell"
import { supabase } from "@/lib/supabase-client"
import { Badge, Card, EmptyState, Field, Input, SectionHeading, Select } from "@/components/breeding/ui"
import { formatDate } from "@/components/breeding/format"

interface Greenhouse {
  id: string
  name: string
  remarks: string
  created_at: string
  updated_at: string
}

interface GreenhouseTable {
  id: string
  greenhouse_id: string
  name: string
  capacity: number | null
  remarks: string
  created_at: string
  updated_at: string
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
  updated_at: string
}

interface Seedling {
  id: string
  batch_id: string
  code: string
  index: number
  status: "observing" | "discarded" | "selected"
  remarks: string
  created_at: string
  updated_at: string
}

const STATUS_LABELS: Record<string, string> = {
  observing: "En observation",
  discarded: "Éliminé",
  selected: "Sélectionné",
}

export default function SerrePage() {
  return (
    <AppShell>
      <SerreContent />
    </AppShell>
  )
}

function SerreContent() {
  const [greenhouses, setGreenhouses] = useState<Greenhouse[]>([])
  const [tables, setTables] = useState<GreenhouseTable[]>([])
  const [batches, setBatches] = useState<SowingBatch[]>([])
  const [seedlings, setSeedlings] = useState<Seedling[]>([])
  const [loading, setLoading] = useState(true)
  const [ghName, setGhName] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const [gh, tbl, bat, seed] = await Promise.all([
      supabase.from("greenhouses").select("*").order("created_at"),
      supabase.from("greenhouse_tables").select("*").order("created_at"),
      supabase.from("sowing_batches").select("*").order("sowing_date", { ascending: false }),
      supabase.from("seedlings").select("*").order("index"),
    ])
    if (gh.data) setGreenhouses(gh.data as Greenhouse[])
    if (tbl.data) setTables(tbl.data as GreenhouseTable[])
    if (bat.data) setBatches(bat.data as SowingBatch[])
    if (seed.data) setSeedlings(seed.data as Seedling[])
    setLoading(false)
  }

  async function addGreenhouse() {
    if (!ghName.trim()) return
    await supabase.from("greenhouses").insert({ name: ghName.trim() })
    setGhName("")
    fetchData()
  }

  async function addTable(ghId: string, name: string, capacity: string) {
    if (!name.trim()) return
    await supabase.from("greenhouse_tables").insert({
      greenhouse_id: ghId,
      name: name.trim(),
      capacity: capacity ? Number(capacity) : null,
    })
    fetchData()
  }

  async function deleteGreenhouse(id: string) {
    if (!confirm("Supprimer cette serre et toutes ses tables ?")) return
    await supabase.from("greenhouses").delete().eq("id", id)
    fetchData()
  }

  async function deleteTable(id: string) {
    await supabase.from("greenhouse_tables").delete().eq("id", id)
    fetchData()
  }

  async function setSeedlingStatus(id: string, status: Seedling["status"]) {
    await supabase.from("seedlings").update({ status }).eq("id", id)
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Sprout className="size-8 animate-pulse text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        title="Serre / Semis"
        description="Module de saisie rapide et évaluation des individus Aa1."
      />

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Field label="Nouvelle serre" htmlFor="gh-name">
          <Input
            id="gh-name"
            value={ghName}
            onChange={(e) => setGhName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addGreenhouse() }}
            placeholder="Serre nord"
            className="w-64"
          />
        </Field>
        <Button onClick={addGreenhouse} disabled={!ghName.trim()} className="gap-1.5">
          <Plus className="size-4" /> Ajouter
        </Button>
      </Card>

      {greenhouses.length === 0 ? (
        <EmptyState
          icon={<Warehouse className="size-8" />}
          title="Aucune serre"
          description="Ajoutez une serre pour commencer à organiser vos tables et semis."
        />
      ) : (
        <div className="grid gap-4">
          {greenhouses.map((g) => (
            <GreenhouseCard
              key={g.id}
              greenhouse={g}
              tables={tables.filter((t) => t.greenhouse_id === g.id)}
              batches={batches}
              seedlings={seedlings}
              onAddTable={addTable}
              onDeleteGreenhouse={deleteGreenhouse}
              onDeleteTable={deleteTable}
              onSetStatus={setSeedlingStatus}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GreenhouseCard({
  greenhouse,
  tables,
  batches,
  seedlings,
  onAddTable,
  onDeleteGreenhouse,
  onDeleteTable,
  onSetStatus,
}: {
  greenhouse: Greenhouse
  tables: GreenhouseTable[]
  batches: SowingBatch[]
  seedlings: Seedling[]
  onAddTable: (ghId: string, name: string, capacity: string) => void
  onDeleteGreenhouse: (id: string) => void
  onDeleteTable: (id: string) => void
  onSetStatus: (id: string, status: Seedling["status"]) => void
}) {
  const [tableName, setTableName] = useState("")
  const [tableCap, setTableCap] = useState("")

  const tableBatches = (tableId: string) => batches.filter((b) => b.table_id === tableId)
  const batchSeedlings = (batchId: string) => seedlings.filter((s) => s.batch_id === batchId)

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Warehouse className="size-4" />
        </span>
        <h3 className="font-serif text-lg text-foreground">{greenhouse.name}</h3>
        <Badge tone="neutral">{tables.length} table(s)</Badge>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onDeleteGreenhouse(greenhouse.id)}
            className="gap-1"
          >
            <Trash2 className="size-3.5" /> Supprimer
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 pl-12">
        {tables.map((t) => {
          const tBatches = tableBatches(t.id)
          return (
            <div key={t.id} className="rounded-md border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <Table2 className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t.capacity != null ? `capacité ${t.capacity}` : "capacité libre"} · {tBatches.length} lot(s)
                </span>
                <Button size="sm" variant="ghost" onClick={() => onDeleteTable(t.id)} className="ml-auto gap-1">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              {tBatches.length > 0 ? (
                <div className="mt-2 grid gap-1.5">
                  {tBatches.map((b) => {
                    const bSeedlings = batchSeedlings(b.id)
                    return (
                      <div key={b.id} className="rounded border border-border bg-muted/20 p-2">
                        <div className="flex items-center gap-2">
                          <span className="font-serif text-sm text-primary">{b.code}</span>
                          <span className="text-xs text-muted-foreground">
                            Semé le {formatDate(b.sowing_date)} · {b.seed_count} graine(s) · {bSeedlings.length} semis
                          </span>
                        </div>
                        {bSeedlings.length > 0 ? (
                          <div className="mt-1.5 grid gap-1">
                            {bSeedlings.map((s) => (
                              <div key={s.id} className="flex flex-wrap items-center gap-2">
                                <span className="flex items-center gap-1 font-serif text-xs text-foreground">
                                  <Leaf className="size-3 text-primary" />
                                  {s.code}
                                </span>
                                <div className="flex gap-1">
                                  {(["observing", "selected", "discarded"] as const).map((st) => (
                                    <button
                                      key={st}
                                      onClick={() => onSetStatus(s.id, st)}
                                      className={
                                        s.status === st
                                          ? statusActiveClass(st)
                                          : "rounded-full border border-border px-2 py-0.5 text-[0.65rem] text-muted-foreground transition-colors hover:bg-muted"
                                      }
                                    >
                                      {STATUS_LABELS[st]}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}

        <div className="mt-1 flex flex-wrap items-end gap-2">
          <Field label="Nouvelle table">
            <Input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  onAddTable(greenhouse.id, tableName, tableCap)
                  setTableName("")
                  setTableCap("")
                }
              }}
              placeholder="Table A1"
              className="w-44"
            />
          </Field>
          <Field label="Capacité">
            <Input
              type="number"
              min={0}
              value={tableCap}
              onChange={(e) => setTableCap(e.target.value)}
              placeholder="—"
              className="w-24"
            />
          </Field>
          <Button
            size="sm"
            variant="outline"
            disabled={!tableName.trim()}
            onClick={() => {
              onAddTable(greenhouse.id, tableName, tableCap)
              setTableName("")
              setTableCap("")
            }}
            className="gap-1"
          >
            <Plus className="size-3.5" /> Table
          </Button>
        </div>
      </div>
    </Card>
  )
}

function statusActiveClass(status: string): string {
  const base = "rounded-full px-2 py-0.5 text-[0.65rem] font-medium"
  switch (status) {
    case "selected":
      return `${base} bg-primary text-primary-foreground`
    case "discarded":
      return `${base} bg-destructive/15 text-destructive`
    case "observing":
      return `${base} bg-chart-3/25 text-foreground`
    default:
      return base
  }
}
