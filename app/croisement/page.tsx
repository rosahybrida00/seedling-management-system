"use client"

import { useEffect, useState } from "react"
import { Plus, Flower2, Pencil, Check, X, Cherry, Sprout } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/layout/app-shell"
import { supabase } from "@/lib/supabase-client"
import { Card, Badge, Field, Input, SectionHeading, EmptyState, Select } from "@/components/breeding/ui"
import { formatDate, fromDateInput, toDateInput } from "@/components/breeding/format"

interface Cross {
  id: string
  code: string
  seed_parent: string | null
  pollen_parent: string | null
  pollination_date: string | null
  remarks: string
  created_at: string
  updated_at: string
}

interface HipHarvest {
  id: string
  cross_id: string
  code: string
  harvest_date: string | null
  seed_count: number
  remarks: string
  created_at: string
  updated_at: string
}

export default function CroisementPage() {
  return (
    <AppShell>
      <CroisementContent />
    </AppShell>
  )
}

function CroisementContent() {
  const [crosses, setCrosses] = useState<Cross[]>([])
  const [harvests, setHarvests] = useState<HipHarvest[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    code: "",
    seedParent: "",
    pollenParent: "",
    pollinationDate: "",
    remarks: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: cData }, { data: hData }] = await Promise.all([
      supabase.from("crosses").select("*").order("created_at", { ascending: false }),
      supabase.from("hip_harvests").select("*").order("created_at", { ascending: false }),
    ])
    if (cData) setCrosses(cData as Cross[])
    if (hData) setHarvests(hData as HipHarvest[])
    setLoading(false)
  }

  async function createCross() {
    if (!form.code.trim()) return
    const { error } = await supabase.from("crosses").insert({
      code: form.code.trim(),
      seed_parent: form.seedParent || null,
      pollen_parent: form.pollenParent || null,
      pollination_date: fromDateInput(form.pollinationDate),
      remarks: form.remarks,
    })
    if (!error) {
      setForm({ code: "", seedParent: "", pollenParent: "", pollinationDate: "", remarks: "" })
      setCreating(false)
      fetchData()
    }
  }

  async function updateCross(c: Cross, changes: Partial<Cross>) {
    await supabase.from("crosses").update(changes).eq("id", c.id)
    fetchData()
  }

  async function createHarvest(crossId: string) {
    const cross = crosses.find((c) => c.id === crossId)
    if (!cross) return
    const count = harvests.filter((h) => h.cross_id === crossId).length
    const suffix = String.fromCharCode(97 + count)
    const code = `${cross.code}${suffix}`
    await supabase.from("hip_harvests").insert({
      cross_id: crossId,
      code,
      harvest_date: null,
      seed_count: 0,
      remarks: "",
    })
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Flower2 className="size-8 animate-pulse text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        title="Croisements"
        description="Suivi des pollinisations, nouaison et fruits (cynorrhodons)."
        action={
          <Button onClick={() => setCreating((v) => !v)} className="gap-1.5">
            <Plus className="size-4" /> Nouveau croisement
          </Button>
        }
      />

      {creating ? (
        <Card className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Code" hint="Clé stable, ex. « A ».">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="A" />
            </Field>
            <Field label="Parent porte-graine (♀)">
              <Input value={form.seedParent} onChange={(e) => setForm({ ...form, seedParent: e.target.value })} placeholder="Rosa gallica" />
            </Field>
            <Field label="Parent pollen (♂)">
              <Input value={form.pollenParent} onChange={(e) => setForm({ ...form, pollenParent: e.target.value })} placeholder="Rosa moschata" />
            </Field>
            <Field label="Date de pollinisation">
              <Input type="date" value={form.pollinationDate} onChange={(e) => setForm({ ...form, pollinationDate: e.target.value })} />
            </Field>
            <Field label="Remarques">
              <Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Observations…" />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>Annuler</Button>
            <Button onClick={createCross} disabled={!form.code.trim()}>Créer</Button>
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
          {crosses.map((c) => {
            const cHarvests = harvests.filter((h) => h.cross_id === c.id)
            return (
              <Card key={c.id} className="p-4">
                {editingId === c.id ? (
                  <CrossEditRow cross={c} onSave={(changes) => updateCross(c, changes)} onCancel={() => setEditingId(null)} />
                ) : (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 font-serif text-lg text-primary">
                        {c.code}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {c.seed_parent || "?"} <span className="text-muted-foreground">×</span> {c.pollen_parent || "?"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pollinisé le {formatDate(c.pollination_date)}
                        </p>
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <Badge tone="primary">{cHarvests.length} récolte(s)</Badge>
                      {c.remarks ? (
                        <span className="max-w-[220px] truncate text-xs text-muted-foreground" title={c.remarks}>
                          {c.remarks}
                        </span>
                      ) : null}
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(c.id)} className="gap-1">
                        <Pencil className="size-3.5" /> Éditer
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => createHarvest(c.id)} className="gap-1">
                        <Cherry className="size-3.5" /> Récolte
                      </Button>
                    </div>
                  </div>
                )}
                {cHarvests.length > 0 ? (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="grid gap-2">
                      {cHarvests.map((h) => (
                        <div key={h.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/20 p-2.5">
                          <span className="flex size-7 items-center justify-center rounded-md bg-accent/15 font-serif text-sm text-accent">
                            {h.code}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Récolté le {formatDate(h.harvest_date)} · {h.seed_count} graine(s)
                          </span>
                          {h.remarks ? (
                            <span className="text-xs text-muted-foreground italic">{h.remarks}</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CrossEditRow({
  cross,
  onSave,
  onCancel,
}: {
  cross: Cross
  onSave: (changes: Partial<Cross>) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState({
    code: cross.code,
    seed_parent: cross.seed_parent ?? "",
    pollen_parent: cross.pollen_parent ?? "",
    pollination_date: toDateInput(cross.pollination_date),
    remarks: cross.remarks,
  })

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Code">
          <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
        </Field>
        <Field label="Parent porte-graine (♀)">
          <Input value={draft.seed_parent} onChange={(e) => setDraft({ ...draft, seed_parent: e.target.value })} />
        </Field>
        <Field label="Parent pollen (♂)">
          <Input value={draft.pollen_parent} onChange={(e) => setDraft({ ...draft, pollen_parent: e.target.value })} />
        </Field>
        <Field label="Date de pollinisation">
          <Input type="date" value={draft.pollination_date} onChange={(e) => setDraft({ ...draft, pollination_date: e.target.value })} />
        </Field>
        <Field label="Remarques">
          <Input value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} className="gap-1">
          <X className="size-4" /> Annuler
        </Button>
        <Button
          onClick={() =>
            onSave({
              code: draft.code,
              seed_parent: draft.seed_parent || null,
              pollen_parent: draft.pollen_parent || null,
              pollination_date: fromDateInput(draft.pollination_date),
              remarks: draft.remarks,
            })
          }
          className="gap-1"
        >
          <Check className="size-4" /> Enregistrer
        </Button>
      </div>
    </div>
  )
}
