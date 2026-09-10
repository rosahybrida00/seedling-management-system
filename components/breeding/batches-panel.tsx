"use client"

import { useMemo, useState } from "react"
import { Search, Sprout, Plus, Leaf, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useData } from "./data-provider"
import { Badge, Card, EmptyState, Field, Input, SectionHeading, Select } from "./ui"
import { formatDate } from "./format"
import { queryBatches, type BatchSortField, type SortDirection } from "@/lib/services/batchQuery"
import {
  SEEDLING_STATUSES,
  SEEDLING_STATUS_LABELS,
  type Seedling,
  type SeedlingStatus,
  type SowingBatch,
} from "@/lib/domain/types"

const STATUS_TONE: Record<SeedlingStatus, "warning" | "danger" | "success"> = {
  observing: "warning",
  discarded: "danger",
  selected: "success",
}

export function BatchesPanel() {
  const { sowingBatches } = useData()

  const [query, setQuery] = useState("")
  const [harvestFrom, setHarvestFrom] = useState("")
  const [harvestTo, setHarvestTo] = useState("")
  const [seedMin, setSeedMin] = useState("")
  const [seedMax, setSeedMax] = useState("")
  const [sortField, setSortField] = useState<BatchSortField>("sowingDate")
  const [sortDir, setSortDir] = useState<SortDirection>("desc")

  const results = useMemo(
    () =>
      queryBatches(
        sowingBatches,
        {
          query,
          harvestFrom: harvestFrom || null,
          harvestTo: harvestTo || null,
          seedCountMin: seedMin ? Number(seedMin) : null,
          seedCountMax: seedMax ? Number(seedMax) : null,
        },
        { field: sortField, direction: sortDir },
      ),
    [sowingBatches, query, harvestFrom, harvestTo, seedMin, seedMax, sortField, sortDir],
  )

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        title="Lots & semis"
        description="Un lot est créé au semis d'un fruit (date de récolte et nombre de graines copiés). Les semis « Aa1 » se suivent individuellement."
      />

      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Recherche">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Code ou remarques…"
                className="pl-8"
              />
            </div>
          </Field>
          <Field label="Récolte : du">
            <Input type="date" value={harvestFrom} onChange={(e) => setHarvestFrom(e.target.value)} />
          </Field>
          <Field label="Récolte : au">
            <Input type="date" value={harvestTo} onChange={(e) => setHarvestTo(e.target.value)} />
          </Field>
          <Field label="Graines min.">
            <Input type="number" min={0} value={seedMin} onChange={(e) => setSeedMin(e.target.value)} />
          </Field>
          <Field label="Graines max.">
            <Input type="number" min={0} value={seedMax} onChange={(e) => setSeedMax(e.target.value)} />
          </Field>
          <Field label="Trier par">
            <div className="flex gap-2">
              <Select value={sortField} onChange={(e) => setSortField(e.target.value as BatchSortField)}>
                <option value="sowingDate">Date de semis</option>
                <option value="harvestDate">Date de récolte</option>
                <option value="seedCount">Nombre de graines</option>
                <option value="code">Code</option>
              </Select>
              <Select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as SortDirection)}
                className="w-28"
              >
                <option value="desc">↓ Décroiss.</option>
                <option value="asc">↑ Croiss.</option>
              </Select>
            </div>
          </Field>
        </div>
      </Card>

      {sowingBatches.length === 0 ? (
        <EmptyState
          icon={<Sprout className="size-8" />}
          title="Aucun lot semé"
          description="Utilisez le bouton « Semer » sur une récolte pour créer un lot de semis."
        />
      ) : results.length === 0 ? (
        <EmptyState title="Aucun résultat" description="Aucun lot ne correspond aux filtres." />
      ) : (
        <div className="grid gap-3">
          {results.map((b) => (
            <BatchCard key={b.id} batch={b} />
          ))}
        </div>
      )}
    </div>
  )
}

function BatchCard({ batch }: { batch: SowingBatch }) {
  const { seedlings, greenhouseTables, greenhouses, seedling, greenhouse, run } = useData()
  const [open, setOpen] = useState(false)

  const mySeedlings = seedlings
    .filter((s) => s.batchId === batch.id)
    .sort((a, b) => a.index - b.index)

  const counts = SEEDLING_STATUSES.reduce(
    (acc, st) => ({ ...acc, [st]: mySeedlings.filter((s) => s.status === st).length }),
    {} as Record<SeedlingStatus, number>,
  )

  const table = greenhouseTables.find((t) => t.id === batch.tableId)
  const gh = table ? greenhouses.find((g) => g.id === table.greenhouseId) : undefined

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 p-4 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 font-serif text-lg text-primary">
            {batch.code}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              Lot {batch.code} · {mySeedlings.length} semis
            </p>
            <p className="text-xs text-muted-foreground">
              Semé le {formatDate(batch.sowingDate)} · récolte {formatDate(batch.harvestDate)} ·{" "}
              {batch.seedCount} graine(s)
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {counts.selected > 0 ? <Badge tone="success">{counts.selected} sélectionné(s)</Badge> : null}
          {counts.observing > 0 ? <Badge tone="warning">{counts.observing} en obs.</Badge> : null}
          {counts.discarded > 0 ? <Badge tone="danger">{counts.discarded} éliminé(s)</Badge> : null}
          {gh ? <Badge tone="primary">{gh.name} · {table?.name}</Badge> : null}
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open ? (
        <div className="border-t border-border bg-muted/20 p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Field label="Emplacement (table)">
              <Select
                value={batch.tableId ?? ""}
                onChange={(e) =>
                  run(() => greenhouse.updateBatch(batch.id, e.target.value || null))
                }
                className="min-w-[220px]"
              >
                <option value="">— Non placé —</option>
                {greenhouseTables.map((t) => {
                  const g = greenhouses.find((x) => x.id === t.greenhouseId)
                  return (
                    <option key={t.id} value={t.id}>
                      {g?.name} · {t.name}
                    </option>
                  )
                })}
              </Select>
            </Field>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 self-end"
              onClick={() => run(() => seedling.addSeedling(batch.id))}
            >
              <Plus className="size-3.5" /> Ajouter un semis
            </Button>
          </div>

          {mySeedlings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aucun semis individuel dans ce lot.
            </p>
          ) : (
            <div className="grid gap-2">
              {mySeedlings.map((s) => (
                <SeedlingRow key={s.id} seedling={s} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </Card>
  )
}

function SeedlingRow({ seedling: s }: { seedling: Seedling }) {
  const { seedling, run } = useData()
  const [remarks, setRemarks] = useState(s.remarks)

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-2.5">
      <span className="flex items-center gap-1.5 font-serif text-sm text-foreground">
        <Leaf className="size-3.5 text-primary" />
        {s.code}
      </span>
      <Input
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        onBlur={() => {
          if (remarks !== s.remarks) run(() => seedling.updateSeedling(s.id, { remarks }))
        }}
        placeholder="Remarques d'observation…"
        className="h-8 flex-1 min-w-[160px]"
      />
      <div className="flex gap-1">
        {SEEDLING_STATUSES.map((st) => {
          const active = s.status === st
          return (
            <button
              key={st}
              onClick={() => run(() => seedling.setStatus(s.id, st))}
              className={
                active
                  ? statusActiveClass(st)
                  : "rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
              }
            >
              {SEEDLING_STATUS_LABELS[st]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function statusActiveClass(status: SeedlingStatus): string {
  const base = "rounded-full px-2.5 py-1 text-xs font-medium"
  switch (status) {
    case "selected":
      return `${base} bg-primary text-primary-foreground`
    case "discarded":
      return `${base} bg-destructive/15 text-destructive`
    case "observing":
      return `${base} bg-chart-3/25 text-foreground`
  }
}
