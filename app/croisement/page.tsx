"use client"

import { useEffect, useState, useMemo } from "react"
import { Plus, Flower2, Pencil, Check, X, Cherry, Trash2, FlaskConical, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/layout/app-shell"
import { supabase } from "@/lib/supabase-client"
import { Card, Badge, Field, Input, SectionHeading, EmptyState, Select, Textarea } from "@/components/breeding/ui"
import { formatDate, fromDateInput, toDateInput } from "@/components/breeding/format"
import {
  ANTHER_QUALITY_LABELS,
  DEHISCENCE_LABELS,
  CONSERVATION_LABELS,
  FRUIT_CALIBRE_LABELS,
  MATURATION_LABELS,
  AVORTEMENT_LABELS,
  SEED_EXTRACTION_LABELS,
} from "@/lib/domain/supabase-types"

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
  fruit_calibre: string | null
  maturation: string | null
  avortement_cause: string | null
  seed_extraction: string | null
  created_at: string
  updated_at: string
}

interface PollenLot {
  id: string
  lot_number: string
  rose_name: string | null
  anther_quality: string | null
  dehiscence: string | null
  conservation_mode: string | null
  remarks: string
  created_at: string
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
  const [pollenLots, setPollenLots] = useState<PollenLot[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"crosses" | "pollen">("crosses")
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
    const [{ data: cData }, { data: hData }, { data: pData }] = await Promise.all([
      supabase.from("crosses").select("*").order("created_at", { ascending: false }),
      supabase.from("hip_harvests").select("*").order("created_at", { ascending: false }),
      supabase.from("pollen_lots").select("*").order("created_at", { ascending: false }),
    ])
    if (cData) setCrosses(cData as Cross[])
    if (hData) setHarvests(hData as HipHarvest[])
    if (pData) setPollenLots(pData as PollenLot[])
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

  async function deleteCross(id: string) {
    if (!confirm("Supprimer ce croisement et toutes ses récoltes ?")) return
    await supabase.from("crosses").delete().eq("id", id)
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

  async function updateHarvest(h: HipHarvest, changes: Partial<HipHarvest>) {
    await supabase.from("hip_harvests").update(changes).eq("id", h.id)
    fetchData()
  }

  async function deleteHarvest(id: string) {
    await supabase.from("hip_harvests").delete().eq("id", id)
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
        description="Suivi des pollinisations, nouaison, fruits (cynorrhodons) et lots de pollen."
      />

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("crosses")}
          className={
            activeTab === "crosses"
              ? "flex items-center gap-1.5 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
              : "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
          }
        >
          <Flower2 className="size-4" /> Croisements & Récoltes
        </button>
        <button
          onClick={() => setActiveTab("pollen")}
          className={
            activeTab === "pollen"
              ? "flex items-center gap-1.5 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
              : "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
          }
        >
          <FlaskConical className="size-4" /> Module Pollen
        </button>
      </div>

      {activeTab === "crosses" ? (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setCreating((v) => !v)} className="gap-1.5">
              <Plus className="size-4" /> Nouveau croisement
            </Button>
          </div>

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
                          <Button variant="destructive" size="sm" onClick={() => deleteCross(c.id)} className="gap-1">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {cHarvests.length > 0 ? (
                      <div className="mt-3 border-t border-border pt-3">
                        <div className="grid gap-3">
                          {cHarvests.map((h) => (
                            <HarvestRow key={h.id} harvest={h} onUpdate={(changes) => updateHarvest(h, changes)} onDelete={() => deleteHarvest(h.id)} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </Card>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <PollenPanel pollenLots={pollenLots} onRefresh={fetchData} />
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

function HarvestRow({
  harvest,
  onUpdate,
  onDelete,
}: {
  harvest: HipHarvest
  onUpdate: (changes: Partial<HipHarvest>) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState({
    harvest_date: toDateInput(harvest.harvest_date),
    seed_count: String(harvest.seed_count),
    fruit_calibre: harvest.fruit_calibre ?? "",
    maturation: harvest.maturation ?? "",
    avortement_cause: harvest.avortement_cause ?? "",
    seed_extraction: harvest.seed_extraction ?? "",
    remarks: harvest.remarks,
  })

  function save() {
    onUpdate({
      harvest_date: fromDateInput(draft.harvest_date),
      seed_count: Number(draft.seed_count) || 0,
      fruit_calibre: draft.fruit_calibre || null,
      maturation: draft.maturation || null,
      avortement_cause: draft.avortement_cause || null,
      seed_extraction: draft.seed_extraction || null,
      remarks: draft.remarks,
    })
    setExpanded(false)
  }

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-7 items-center justify-center rounded-md bg-accent/15 font-serif text-sm text-accent">
          {harvest.code}
        </span>
        <span className="text-xs text-muted-foreground">
          Récolté le {formatDate(harvest.harvest_date)} · {harvest.seed_count} graine(s)
        </span>
        {harvest.fruit_calibre ? <Badge tone="neutral">{FRUIT_CALIBRE_LABELS[harvest.fruit_calibre] ?? harvest.fruit_calibre}</Badge> : null}
        {harvest.seed_extraction ? <Badge tone={harvest.seed_extraction === "plein" ? "success" : "warning"}>{SEED_EXTRACTION_LABELS[harvest.seed_extraction] ?? harvest.seed_extraction}</Badge> : null}
        {harvest.avortement_cause ? <Badge tone="danger">{AVORTEMENT_LABELS[harvest.avortement_cause] ?? harvest.avortement_cause}</Badge> : null}
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)} className="gap-1">
            <Pencil className="size-3.5" /> {expanded ? "Réduire" : "Diagnostic"}
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 border-t border-border pt-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Date de récolte">
              <Input type="date" value={draft.harvest_date} onChange={(e) => setDraft({ ...draft, harvest_date: e.target.value })} />
            </Field>
            <Field label="Nombre de graines">
              <Input type="number" min={0} value={draft.seed_count} onChange={(e) => setDraft({ ...draft, seed_count: e.target.value })} />
            </Field>
            <Field label="Calibre & maturation du fruit">
              <Select value={draft.fruit_calibre} onChange={(e) => setDraft({ ...draft, fruit_calibre: e.target.value })}>
                <option value="">—</option>
                {Object.entries(FRUIT_CALIBRE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Maturation">
              <Select value={draft.maturation} onChange={(e) => setDraft({ ...draft, maturation: e.target.value })}>
                <option value="">—</option>
                {Object.entries(MATURATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Stade / Cause d'avortement">
              <Select value={draft.avortement_cause} onChange={(e) => setDraft({ ...draft, avortement_cause: e.target.value })}>
                <option value="">—</option>
                {Object.entries(AVORTEMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Diagnostic d'extraction (graines/akènes)">
              <Select value={draft.seed_extraction} onChange={(e) => setDraft({ ...draft, seed_extraction: e.target.value })}>
                <option value="">—</option>
                {Object.entries(SEED_EXTRACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Remarques">
              <Textarea value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} placeholder="Observations sur la récolte…" />
            </Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>Annuler</Button>
            <Button size="sm" onClick={save} className="gap-1">
              <Check className="size-4" /> Enregistrer
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PollenPanel({ pollenLots, onRefresh }: { pollenLots: PollenLot[]; onRefresh: () => void }) {
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    lot_number: "",
    rose_name: "",
    anther_quality: "",
    dehiscence: "",
    conservation_mode: "",
    remarks: "",
  })

  async function createLot() {
    if (!form.lot_number.trim()) return
    await supabase.from("pollen_lots").insert({
      lot_number: form.lot_number.trim(),
      rose_name: form.rose_name || null,
      anther_quality: form.anther_quality || null,
      dehiscence: form.dehiscence || null,
      conservation_mode: form.conservation_mode || null,
      remarks: form.remarks,
    })
    setForm({ lot_number: "", rose_name: "", anther_quality: "", dehiscence: "", conservation_mode: "", remarks: "" })
    setCreating(false)
    onRefresh()
  }

  async function deleteLot(id: string) {
    if (!confirm("Supprimer ce lot de pollen ?")) return
    await supabase.from("pollen_lots").delete().eq("id", id)
    onRefresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pollenLots.length} lot(s) de pollen — récolte, évaluation et congélation.
        </p>
        <Button onClick={() => setCreating((v) => !v)} className="gap-1.5">
          <Plus className="size-4" /> Nouveau lot
        </Button>
      </div>

      {creating ? (
        <Card className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="N° de lot" hint="Ex: POL-2026-ROSA-01">
              <Input value={form.lot_number} onChange={(e) => setForm({ ...form, lot_number: e.target.value })} placeholder="POL-2026-ROSA-01" />
            </Field>
            <Field label="Nom du rosier">
              <Input value={form.rose_name} onChange={(e) => setForm({ ...form, rose_name: e.target.value })} placeholder="Rosa gallica 'Officinalis'" />
            </Field>
            <Field label="Qualité des anthères">
              <Select value={form.anther_quality} onChange={(e) => setForm({ ...form, anther_quality: e.target.value })}>
                <option value="">—</option>
                {Object.entries(ANTHER_QUALITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Déhiscence & libération">
              <Select value={form.dehiscence} onChange={(e) => setForm({ ...form, dehiscence: e.target.value })}>
                <option value="">—</option>
                {Object.entries(DEHISCENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Mode de conservation">
              <Select value={form.conservation_mode} onChange={(e) => setForm({ ...form, conservation_mode: e.target.value })}>
                <option value="">—</option>
                {Object.entries(CONSERVATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Remarques">
              <Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Observations…" />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>Annuler</Button>
            <Button onClick={createLot} disabled={!form.lot_number.trim()}>Créer le lot</Button>
          </div>
        </Card>
      ) : null}

      {pollenLots.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="size-8" />}
          title="Aucun lot de pollen"
          description="Enregistrez un lot de pollen avec évaluation des anthères, déhiscence et mode de conservation."
        />
      ) : (
        <div className="grid gap-3">
          {pollenLots.map((lot) => (
            <Card key={lot.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FlaskConical className="size-4" />
                </span>
                <div>
                  <p className="font-serif text-sm text-foreground">{lot.lot_number}</p>
                  {lot.rose_name ? <p className="text-xs text-muted-foreground">{lot.rose_name}</p> : null}
                </div>
                <div className="ml-auto flex flex-wrap gap-1.5">
                  {lot.anther_quality ? <Badge tone="neutral">{ANTHER_QUALITY_LABELS[lot.anther_quality] ?? lot.anther_quality}</Badge> : null}
                  {lot.dehiscence ? <Badge tone={lot.dehiscence === "excellente" ? "success" : "warning"}>{DEHISCENCE_LABELS[lot.dehiscence] ?? lot.dehiscence}</Badge> : null}
                  {lot.conservation_mode ? <Badge tone="primary">{CONSERVATION_LABELS[lot.conservation_mode] ?? lot.conservation_mode}</Badge> : null}
                </div>
                <Button size="sm" variant="destructive" onClick={() => deleteLot(lot.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              {lot.remarks ? <p className="mt-2 text-xs text-muted-foreground">{lot.remarks}</p> : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
