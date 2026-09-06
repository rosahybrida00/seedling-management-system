"use client"

import { useState } from "react"
import { Plus, Flower2, Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useData } from "./data-provider"
import { Badge, Card, Field, Input, SectionHeading, EmptyState } from "./ui"
import { formatDate, fromDateInput, toDateInput } from "./format"
import type { Cross } from "@/lib/domain/types"

export function CrossesPanel() {
  const { crosses, hipHarvests, cross, run } = useData()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    code: "",
    seedParent: "",
    pollenParent: "",
    pollinationDate: "",
    remarks: "",
  })

  function resetForm() {
    setForm({ code: "", seedParent: "", pollenParent: "", pollinationDate: "", remarks: "" })
  }

  function createCross() {
    if (!form.code.trim()) return
    run(() =>
      cross.createCross({
        code: form.code,
        seedParent: form.seedParent,
        pollenParent: form.pollenParent,
        pollinationDate: fromDateInput(form.pollinationDate),
        remarks: form.remarks,
      }),
    )
    resetForm()
    setCreating(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        title="Croisements"
        description="Chaque croisement « A » enregistre les deux parents et la date de pollinisation."
        action={
          <Button onClick={() => setCreating((v) => !v)} className="gap-1.5">
            <Plus className="size-4" /> Nouveau croisement
          </Button>
        }
      />

      {creating ? (
        <Card className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Code" htmlFor="c-code" hint="Clé stable, ex. « A ».">
              <Input
                id="c-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="A"
              />
            </Field>
            <Field label="Parent porte-graine (♀)" htmlFor="c-seed">
              <Input
                id="c-seed"
                value={form.seedParent}
                onChange={(e) => setForm({ ...form, seedParent: e.target.value })}
                placeholder="Rosa gallica"
              />
            </Field>
            <Field label="Parent pollen (♂)" htmlFor="c-pollen">
              <Input
                id="c-pollen"
                value={form.pollenParent}
                onChange={(e) => setForm({ ...form, pollenParent: e.target.value })}
                placeholder="Rosa moschata"
              />
            </Field>
            <Field label="Date de pollinisation" htmlFor="c-date">
              <Input
                id="c-date"
                type="date"
                value={form.pollinationDate}
                onChange={(e) => setForm({ ...form, pollinationDate: e.target.value })}
              />
            </Field>
            <Field label="Remarques" htmlFor="c-remarks">
              <Input
                id="c-remarks"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="Observations…"
              />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setCreating(false); resetForm() }}>
              Annuler
            </Button>
            <Button onClick={createCross} disabled={!form.code.trim()}>
              Créer
            </Button>
          </div>
        </Card>
      ) : null}

      {crosses.length === 0 ? (
        <EmptyState
          icon={<Flower2 className="size-8" />}
          title="Aucun croisement"
          description="Commencez par enregistrer un croisement entre deux rosiers parents."
        />
      ) : (
        <div className="grid gap-3">
          {crosses.map((c) =>
            editingId === c.id ? (
              <CrossEditRow key={c.id} cross={c} onDone={() => setEditingId(null)} />
            ) : (
              <Card key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 font-serif text-lg text-primary">
                    {c.code}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {c.seedParent || "?"} <span className="text-muted-foreground">×</span>{" "}
                      {c.pollenParent || "?"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pollinisé le {formatDate(c.pollinationDate)}
                    </p>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <Badge tone="primary">
                    {hipHarvests.filter((h) => h.crossId === c.id).length} récolte(s)
                  </Badge>
                  {c.remarks ? (
                    <span className="max-w-[220px] truncate text-xs text-muted-foreground" title={c.remarks}>
                      {c.remarks}
                    </span>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(c.id)} className="gap-1">
                    <Pencil className="size-3.5" /> Éditer
                  </Button>
                </div>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  )
}

function CrossEditRow({ cross: c, onDone }: { cross: Cross; onDone: () => void }) {
  const { cross, run } = useData()
  const [draft, setDraft] = useState({
    code: c.code,
    seedParent: c.seedParent,
    pollenParent: c.pollenParent,
    pollinationDate: toDateInput(c.pollinationDate),
    remarks: c.remarks,
  })

  function save() {
    run(() =>
      cross.updatePollination(c, {
        code: draft.code,
        seedParent: draft.seedParent,
        pollenParent: draft.pollenParent,
        pollinationDate: fromDateInput(draft.pollinationDate),
        remarks: draft.remarks,
      }),
    )
    onDone()
  }

  return (
    <Card className="p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Code">
          <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
        </Field>
        <Field label="Parent porte-graine (♀)">
          <Input value={draft.seedParent} onChange={(e) => setDraft({ ...draft, seedParent: e.target.value })} />
        </Field>
        <Field label="Parent pollen (♂)">
          <Input value={draft.pollenParent} onChange={(e) => setDraft({ ...draft, pollenParent: e.target.value })} />
        </Field>
        <Field label="Date de pollinisation">
          <Input
            type="date"
            value={draft.pollinationDate}
            onChange={(e) => setDraft({ ...draft, pollinationDate: e.target.value })}
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
