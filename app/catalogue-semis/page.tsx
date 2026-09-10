"use client"

import { useEffect, useState, useMemo } from "react"
import { Search, Plus, Trash2, Sprout, Pencil, Leaf } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/layout/app-shell"
import { supabase } from "@/lib/supabase-client"
import { Card, Badge, EmptyState, Field, Input, Textarea, SectionHeading, Select } from "@/components/breeding/ui"
import { formatDate } from "@/components/breeding/format"
import { SeedlingCatalogEditModal } from "@/components/breeding/seedling-catalog-edit-modal"

export interface SeedlingCatalogRecord {
  id: string
  code: string
  name: string | null
  obtenteur: string | null
  seed_parent: string | null
  pollen_parent: string | null
  height: string | null
  width: string | null
  flower_diameter: string | null
  port: string | null
  feuillage: string | null
  rusticite: string | null
  sol: string | null
  adr_label: boolean | null
  notes: string | null
  photo_url: string | null
  created_at?: string
}

const TRAIT_OPTIONS = {
  port: [
    { value: "port_erige", label: "Port érigé" },
    { value: "port_etale", label: "Port étalé" },
    { value: "port_retombant", label: "Port retombant" },
    { value: "port_compact", label: "Port compact" },
    { value: "grimpant", label: "Grimpant" },
    { value: "couvre_sol", label: "Couvre-sol" },
  ],
  feuillage: [
    { value: "feuillage_brillant", label: "Feuillage brillant" },
    { value: "feuillage_luisant", label: "Feuillage luisant" },
    { value: "feuillage_vert_fonce", label: "Feuillage vert foncé" },
    { value: "feuillage_resistant", label: "Feuillage résistant aux maladies" },
    { value: "feuillage_persistant", label: "Feuillage persistant" },
    { value: "feuillage_caduc", label: "Feuillage caduc" },
  ],
  rusticite: [
    { value: "tres_rustique", label: "Très rustique" },
    { value: "rustique", label: "Rustique" },
    { value: "peu_rustique", label: "Peu rustique" },
  ],
  sol: [
    { value: "sol_calcaire", label: "Sol calcaire" },
    { value: "sol_argileux", label: "Sol argileux" },
    { value: "sol_sableux", label: "Sol sableux" },
    { value: "sol_humifere", label: "Sol humifère" },
    { value: "sol_draine", label: "Sol drainé" },
  ],
}

const TRAIT_LABELS: Record<string, string> = {
  ...Object.fromEntries(TRAIT_OPTIONS.port.map((t) => [t.value, t.label])),
  ...Object.fromEntries(TRAIT_OPTIONS.feuillage.map((t) => [t.value, t.label])),
  ...Object.fromEntries(TRAIT_OPTIONS.rusticite.map((t) => [t.value, t.label])),
  ...Object.fromEntries(TRAIT_OPTIONS.sol.map((t) => [t.value, t.label])),
}

export default function CatalogueSemisPage() {
  return (
    <AppShell>
      <CatalogueSemisContent />
    </AppShell>
  )
}

function CatalogueSemisContent() {
  const [entries, setEntries] = useState<SeedlingCatalogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [editingEntry, setEditingEntry] = useState<SeedlingCatalogRecord | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEntry, setNewEntry] = useState({
    code: "",
    name: "",
    seed_parent: "",
    pollen_parent: "",
    height: "",
    width: "",
    flower_diameter: "",
    port: "",
    feuillage: "",
    rusticite: "",
    sol: "",
    adr_label: false,
    notes: "",
  })

  useEffect(() => {
    fetchEntries()
  }, [])

  async function fetchEntries() {
    setLoading(true)
    const { data, error } = await supabase
      .from("seedling_catalog")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) {
      console.error("Erreur lors du chargement du catalogue des semis :", error)
    }
    setEntries((data ?? []) as SeedlingCatalogRecord[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => {
      const haystack = `${e.code ?? ""} ${e.name ?? ""} ${e.obtenteur ?? ""} ${e.seed_parent ?? ""} ${e.pollen_parent ?? ""} ${e.notes ?? ""}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [entries, query])

  async function handleAdd() {
    if (!newEntry.code.trim()) return
    const { data: userData } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from("profiles")
      .select("obtenteur_name")
      .eq("id", userData.user?.id ?? "")
      .maybeSingle()

    const { error } = await supabase.from("seedling_catalog").insert({
      code: newEntry.code.trim(),
      name: newEntry.name || null,
      obtenteur: profile?.obtenteur_name ?? null,
      seed_parent: newEntry.seed_parent || null,
      pollen_parent: newEntry.pollen_parent || null,
      height: newEntry.height || null,
      width: newEntry.width || null,
      flower_diameter: newEntry.flower_diameter || null,
      port: newEntry.port || null,
      feuillage: newEntry.feuillage || null,
      rusticite: newEntry.rusticite || null,
      sol: newEntry.sol || null,
      adr_label: newEntry.adr_label,
      notes: newEntry.notes || null,
    })
    if (!error) {
      setNewEntry({
        code: "", name: "", seed_parent: "", pollen_parent: "",
        height: "", width: "", flower_diameter: "",
        port: "", feuillage: "", rusticite: "", sol: "",
        adr_label: false, notes: "",
      })
      setShowAddForm(false)
      fetchEntries()
    } else {
      console.error("Erreur lors de l'ajout :", error)
      alert(`Erreur : ${error.message}`)
    }
  }

  async function handleDeleteOne(entry: SeedlingCatalogRecord) {
    if (!confirm(`Supprimer « ${entry.code} » du catalogue des semis ?`)) return
    const { error } = await supabase.from("seedling_catalog").delete().eq("id", entry.id)
    if (error) {
      alert(`Suppression impossible : ${error.message}`)
      return
    }
    setEntries((prev) => prev.filter((e) => e.id !== entry.id))
  }

  async function handleDeleteAll() {
    if (!confirm("Supprimer toutes les fiches du catalogue des semis ?")) return
    await supabase.from("seedling_catalog").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    fetchEntries()
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        title="Catalogue des Semis"
        description="Second catalogue dédié aux semis nés en serre. Indépendant du Catalogue Général."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowAddForm((v) => !v)} size="sm" className="gap-1.5">
              <Plus className="size-4" /> Ajouter
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteAll} className="gap-1.5">
              <Trash2 className="size-4" /> Tout supprimer
            </Button>
          </div>
        }
      />

      <div className="flex gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (code, nom, parentage...)"
            className="pl-9"
          />
        </div>
      </div>

      {showAddForm ? (
        <Card className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Code auto" hint="Généré automatiquement (ex: blagra-A-b-12-2026)">
              <Input
                value={newEntry.code}
                onChange={(e) => setNewEntry({ ...newEntry, code: e.target.value })}
                placeholder="blagra-A-b-12-2026"
              />
            </Field>
            <Field label="Nom de la variété">
              <Input
                value={newEntry.name}
                onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                placeholder="Nom du semis"
              />
            </Field>
            <Field label="Parent porte-graine (♀)">
              <Input
                value={newEntry.seed_parent}
                onChange={(e) => setNewEntry({ ...newEntry, seed_parent: e.target.value })}
                placeholder="Rosa gallica"
              />
            </Field>
            <Field label="Parent pollen (♂)">
              <Input
                value={newEntry.pollen_parent}
                onChange={(e) => setNewEntry({ ...newEntry, pollen_parent: e.target.value })}
                placeholder="Rosa moschata"
              />
            </Field>
            <Field label="Hauteur">
              <Input
                value={newEntry.height}
                onChange={(e) => setNewEntry({ ...newEntry, height: e.target.value })}
                placeholder="80 cm"
              />
            </Field>
            <Field label="Largeur / Envergure">
              <Input
                value={newEntry.width}
                onChange={(e) => setNewEntry({ ...newEntry, width: e.target.value })}
                placeholder="70 cm"
              />
            </Field>
            <Field label="Diamètre de la fleur">
              <Input
                value={newEntry.flower_diameter}
                onChange={(e) => setNewEntry({ ...newEntry, flower_diameter: e.target.value })}
                placeholder="7 cm"
              />
            </Field>
            <Field label="Port">
              <Select value={newEntry.port} onChange={(e) => setNewEntry({ ...newEntry, port: e.target.value })}>
                <option value="">—</option>
                {TRAIT_OPTIONS.port.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Feuillage">
              <Select value={newEntry.feuillage} onChange={(e) => setNewEntry({ ...newEntry, feuillage: e.target.value })}>
                <option value="">—</option>
                {TRAIT_OPTIONS.feuillage.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Rusticité">
              <Select value={newEntry.rusticite} onChange={(e) => setNewEntry({ ...newEntry, rusticite: e.target.value })}>
                <option value="">—</option>
                {TRAIT_OPTIONS.rusticite.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Type de sol">
              <Select value={newEntry.sol} onChange={(e) => setNewEntry({ ...newEntry, sol: e.target.value })}>
                <option value="">—</option>
                {TRAIT_OPTIONS.sol.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Notes de l'hybrideur">
              <Textarea
                value={newEntry.notes}
                onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                placeholder="Observations, contexte de sélection..."
              />
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={newEntry.adr_label}
              onChange={(e) => setNewEntry({ ...newEntry, adr_label: e.target.checked })}
              className="size-4 rounded border-input accent-accent"
            />
            Label ADR
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAddForm(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={!newEntry.code.trim()}>Ajouter au catalogue</Button>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Sprout className="size-8 animate-pulse text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Sprout className="size-8" />}
          title="Aucun semis dans le catalogue"
          description="Les semis déclarés comme « levés » en serre apparaissent ici automatiquement. Vous pouvez aussi ajouter une fiche manuellement."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((entry) => (
            <SeedlingCatalogCard
              key={entry.id}
              entry={entry}
              onEdit={setEditingEntry}
              onDelete={handleDeleteOne}
            />
          ))}
        </div>
      )}

      <SeedlingCatalogEditModal
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSaved={(updated) => {
          setEntries((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)))
          setEditingEntry(null)
        }}
        onDeleted={(id) => {
          setEntries((prev) => prev.filter((e) => e.id !== id))
          setEditingEntry(null)
        }}
      />
    </div>
  )
}

function SeedlingCatalogCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: SeedlingCatalogRecord
  onEdit: (entry: SeedlingCatalogRecord) => void
  onDelete: (entry: SeedlingCatalogRecord) => void
}) {
  return (
    <div className="group relative">
      <Card className="overflow-hidden transition-shadow hover:shadow-md cursor-pointer">
        <div className="relative aspect-[4/3] bg-muted">
          {entry.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.photo_url} alt={entry.code} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center bg-primary/5">
              <Sprout className="size-10 text-primary/30" />
            </div>
          )}
          {entry.adr_label ? (
            <div className="absolute top-2 right-2">
              <Badge tone="accent">ADR</Badge>
            </div>
          ) : null}
        </div>
        <div className="p-3">
          <h3 className="font-serif text-base leading-tight text-foreground">{entry.code}</h3>
          {entry.name && entry.name !== entry.code ? (
            <p className="text-xs text-muted-foreground font-medium">{entry.name}</p>
          ) : null}
          {entry.obtenteur ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{entry.obtenteur}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entry.seed_parent || entry.pollen_parent ? (
              <Badge tone="neutral">
                {entry.seed_parent ?? "?"} × {entry.pollen_parent ?? "?"}
              </Badge>
            ) : null}
            {entry.height ? <Badge tone="primary">H: {entry.height}</Badge> : null}
            {entry.width ? <Badge tone="primary">L: {entry.width}</Badge> : null}
            {entry.flower_diameter ? <Badge tone="primary">Ø {entry.flower_diameter}</Badge> : null}
            {entry.port ? <Badge tone="neutral">{TRAIT_LABELS[entry.port] ?? entry.port}</Badge> : null}
            {entry.feuillage ? <Badge tone="neutral">{TRAIT_LABELS[entry.feuillage] ?? entry.feuillage}</Badge> : null}
            {entry.rusticite ? <Badge tone="warning">{TRAIT_LABELS[entry.rusticite] ?? entry.rusticite}</Badge> : null}
            {entry.sol ? <Badge tone="neutral">{TRAIT_LABELS[entry.sol] ?? entry.sol}</Badge> : null}
          </div>
          {entry.notes ? (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{entry.notes}</p>
          ) : null}
          {entry.created_at ? (
            <p className="mt-2 text-xs text-muted-foreground">Ajouté le {formatDate(entry.created_at)}</p>
          ) : null}
        </div>
      </Card>

      <div className="absolute left-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(entry) }}
          aria-label={`Modifier ${entry.code}`}
          className="flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(entry) }}
          aria-label={`Supprimer ${entry.code}`}
          className="flex size-7 items-center justify-center rounded-full bg-background/90 text-destructive shadow-sm hover:bg-background"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
