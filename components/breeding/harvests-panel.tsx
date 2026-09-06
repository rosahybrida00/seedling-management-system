"use client"

import { useState } from "react"
import { Plus, Sprout, Pencil, Check, X, Cherry } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useData } from "./data-provider"
import { Badge, Card, EmptyState, Field, Input, SectionHeading, Select } from "./ui"
import { formatDate, fromDateInput, toDateInput } from "./format"
import type { HipHarvest } from "@/lib/domain/types"

export function HarvestsPanel() {
  const { crosses, hipHarvests, sowingBatches, cross, seedling, run } = useData()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    crossId: "",
    code: "",
    harvestDate: "",
    seedCount: "",
    remarks: "",
  })

  function resetForm() {
    setForm({ crossId: "", code: "", harvestDate: "", seedCount: "", remarks: "" })
  }

  function suggestCode(crossId: string) {
    const c = crosses.find((x) => x.id === crossId)
    if (!c) return ""
    const count = hipHarvests.filter((h) => h.crossId === crossId).length
    // "A" -> "Aa", "Ab", ...
    const suffix = String.fromCharCode(97 + count)
    return `${c.code}${suffix}`
  }

  function createHarvest() {
    if (!form.crossId || !form.code.trim()) return
    run(() =>
      cross.createHarvest({
        crossId: form.crossId,
        code: form.code,
        harvestDate: fromDateInput(form.harvestDate),
        seedCount: Number(form.seedCount) || 0,
        remarks: form.remarks,
      }),
    )
    resetForm()
    setCreating(false)
  }

  function sow(harvest: HipHarvest) {
    run(() => seedling.sow({ hipHarvest: harvest }))
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        title="Récoltes de fruits"
        description="Le fruit « Aa » d'un croisement porte une date de récolte et un nombre de graines."
        action={
          <Button
            onClick={() => setCreating((v) => !v)}
            disabled={crosses.length === 0}
            className="gap-1.5"
          >
            <Plus className="size-4" /> Nouvelle récolte
          </Button>
        }
      />

      {crosses.length === 0 ? (
        <EmptyState
          icon={<Cherry className="size-8" />}
          title="Aucun croisement disponible"
          description="Créez d'abord un croisement avant d'enregistrer la récolte de son fruit."
        />
      ) : null}

      {creating ? (
        <Card className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Croisement parent">
              <Select
                value={form.crossId}
                onChange={(e) =>
                  setForm({ ...form, crossId: e.target.value, code: suggestCode(e.target.value) })
                }
              >
                <option value="">Choisir…</option>
                {crosses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.seedParent} × {c.pollenParent}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Code du fruit" hint="Ex. « Aa ».">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Aa" />
            </Field>
            <Field label="Date de récolte">
              <Input
                type="date"
                value={form.harvestDate}
                onChange={(e) => setForm({ ...form, harvestDate: e.target.value })}
              />
            </Field>
            <Field label="Nombre de graines">
              <Input
                type="number"
                min={0}
                value={form.seedCount}
                onChange={(e) => setForm({ ...form, seedCount: e.target.value })}
                placeholder="0"
              />
            </Field>
            <Field label="Remarques">
              <Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setCreating(false); resetForm() }}>
              Annuler
            </Button>
            <Button onClick={createHarvest} disabled={!form.crossId || !form.code.trim()}>
              Créer
            </Button>
          </div>
        </Card>
      ) : null}

      {hipHarvests.length === 0 && crosses.length > 0 ? (
        <EmptyState
          icon={<Cherry className="size-8" />}
          title="Aucune récolte"
          description="Enregistrez la récolte d'un fruit pour ensuite le semer."
        />
      ) : (
        <div className="grid gap-3">
          {hipHarvests.map((h) => {
            const parent = crosses.find((c) => c.id === h.crossId)
            const batches = sowingBatches.filter((b) => b.hipHarvestId === h.id)
            if (editingId === h.id) {
              return <HarvestEditRow key={h.id} harvest={h} onDone={() => setEditingId(null)} />
            }
            return (
              <Card key={h.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-md bg-accent/15 font-serif text-lg text-accent">
                    {h.code}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Fruit de <span className="text-muted-foreground">{parent?.code ?? "?"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Récolté le {formatDate(h.harvestDate)} · {h.seedCount} graine(s)
                    </p>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {batches.length > 0 ? (
                    <Badge tone="success">{batches.length} lot(s) semé(s)</Badge>
                  ) : (
                    <Badge tone="neutral">Non semé</Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(h.id)} className="gap-1">
                    <Pencil className="size-3.5" /> Éditer
                  </Button>
                  <Button size="sm" onClick={() => sow(h)} className="gap-1">
                    <Sprout className="size-3.5" /> Semer
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HarvestEditRow({ harvest: h, onDone }: { harvest: HipHarvest; onDone: () => void }) {
  const { cross, run } = useData()
  const [draft, setDraft] = useState({
    code: h.code,
    harvestDate: toDateInput(h.harvestDate),
    seedCount: String(h.seedCount),
    remarks: h.remarks,
  })

  function save() {
    run(() =>
      cross.updateHarvest(h, {
        code: draft.code,
        harvestDate: fromDateInput(draft.harvestDate),
        seedCount: Number(draft.seedCount) || 0,
        remarks: draft.remarks,
      }),
    )
    onDone()
  }

  return (
    <Card className="p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Code du fruit">
          <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
        </Field>
        <Field label="Date de récolte">
          <Input
            type="date"
            value={draft.harvestDate}
            onChange={(e) => setDraft({ ...draft, harvestDate: e.target.value })}
          />
        </Field>
        <Field label="Nombre de graines">
          <Input
            type="number"
            min={0}
            value={draft.seedCount}
            onChange={(e) => setDraft({ ...draft, seedCount: e.target.value })}
          />
        </Field>
        <Field label="Remarques">
          <Input value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} className="gap-1">
          <X className="size-4" /> Annuler
        </Button>
        <Button onClick={save} className="gap-1">
          <Check className="size-4" /> Enregistrer
        </Button>
      </div>
    </Card>
  )
}
