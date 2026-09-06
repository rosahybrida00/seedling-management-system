"use client"

import { useState } from "react"
import { Plus, Warehouse, Pencil, Check, X, Trash2, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useData } from "./data-provider"
import { Badge, Card, EmptyState, Field, Input, SectionHeading } from "./ui"
import type { Greenhouse, GreenhouseTable } from "@/lib/domain/types"

export function GreenhousesPanel() {
  const { greenhouses, greenhouse, run } = useData()
  const [name, setName] = useState("")

  function addGreenhouse() {
    if (!name.trim()) return
    run(() => greenhouse.createGreenhouse({ name }))
    setName("")
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        title="Serres & tables"
        description="Organisez vos serres et leurs tables (planches) pour y placer les lots de semis."
      />

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Field label="Nouvelle serre" htmlFor="gh-name">
          <Input
            id="gh-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) addGreenhouse()
            }}
            placeholder="Serre nord"
            className="w-64"
          />
        </Field>
        <Button onClick={addGreenhouse} disabled={!name.trim()} className="gap-1.5">
          <Plus className="size-4" /> Ajouter
        </Button>
      </Card>

      {greenhouses.length === 0 ? (
        <EmptyState
          icon={<Warehouse className="size-8" />}
          title="Aucune serre"
          description="Ajoutez une serre pour commencer à organiser vos tables."
        />
      ) : (
        <div className="grid gap-4">
          {greenhouses.map((g) => (
            <GreenhouseCard key={g.id} greenhouse={g} />
          ))}
        </div>
      )}
    </div>
  )
}

function GreenhouseCard({ greenhouse: g }: { greenhouse: Greenhouse }) {
  const { greenhouseTables, sowingBatches, greenhouse: svc, run } = useData()
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(g.name)
  const [tableName, setTableName] = useState("")
  const [tableCap, setTableCap] = useState("")

  const tables = greenhouseTables.filter((t) => t.greenhouseId === g.id)

  function saveName() {
    run(() => svc.updateGreenhouse(g.id, { name: draftName }))
    setEditing(false)
  }

  function addTable() {
    if (!tableName.trim()) return
    run(() =>
      svc.createTable({
        greenhouseId: g.id,
        name: tableName,
        capacity: tableCap ? Number(tableCap) : null,
      }),
    )
    setTableName("")
    setTableCap("")
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Warehouse className="size-4" />
        </span>
        {editing ? (
          <>
            <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="w-56" />
            <Button size="sm" onClick={saveName} className="gap-1">
              <Check className="size-3.5" /> OK
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraftName(g.name); setEditing(false) }} className="gap-1">
              <X className="size-3.5" /> Annuler
            </Button>
          </>
        ) : (
          <>
            <h3 className="font-serif text-lg text-foreground">{g.name}</h3>
            <Badge tone="neutral">{tables.length} table(s)</Badge>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="gap-1">
                <Pencil className="size-3.5" /> Renommer
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => run(() => svc.deleteGreenhouse(g.id))}
                className="gap-1"
              >
                <Trash2 className="size-3.5" /> Supprimer
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 grid gap-2 pl-12">
        {tables.map((t) => (
          <TableRow
            key={t.id}
            table={t}
            batchCount={sowingBatches.filter((b) => b.tableId === t.id).length}
          />
        ))}

        <div className="mt-1 flex flex-wrap items-end gap-2">
          <Field label="Nouvelle table">
            <Input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) addTable()
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
          <Button size="sm" variant="outline" onClick={addTable} disabled={!tableName.trim()} className="gap-1">
            <Plus className="size-3.5" /> Table
          </Button>
        </div>
      </div>
    </Card>
  )
}

function TableRow({ table: t, batchCount }: { table: GreenhouseTable; batchCount: number }) {
  const { greenhouse: svc, run } = useData()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: t.name, capacity: t.capacity?.toString() ?? "" })

  function save() {
    run(() =>
      svc.updateTable(t.id, {
        name: draft.name,
        capacity: draft.capacity ? Number(draft.capacity) : null,
      }),
    )
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
        <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-8 w-40" />
        <Input
          type="number"
          min={0}
          value={draft.capacity}
          onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
          placeholder="Capacité"
          className="h-8 w-24"
        />
        <Button size="sm" onClick={save} className="gap-1">
          <Check className="size-3.5" /> OK
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="gap-1">
          <X className="size-3.5" /> Annuler
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card p-2">
      <Table2 className="size-4 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">{t.name}</span>
      <span className="text-xs text-muted-foreground">
        {t.capacity != null ? `capacité ${t.capacity}` : "capacité libre"} · {batchCount} lot(s)
      </span>
      <div className="ml-auto flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="gap-1">
          <Pencil className="size-3.5" /> Éditer
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => run(() => svc.deleteTable(t.id))}
          className="gap-1"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
