"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase-client"
import { Field, Input, Textarea, Select } from "@/components/breeding/ui"
import type { SeedlingCatalogRecord } from "@/app/catalogue-semis/page"

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

interface SeedlingCatalogEditModalProps {
  entry: SeedlingCatalogRecord | null
  onClose: () => void
  onSaved: (updated: SeedlingCatalogRecord) => void
  onDeleted: (id: string) => void
}

const EMPTY_FORM = {
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
  photo_url: "",
}

export function SeedlingCatalogEditModal({ entry, onClose, onSaved, onDeleted }: SeedlingCatalogEditModalProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (entry) {
      setForm({
        code: entry.code ?? "",
        name: entry.name ?? "",
        seed_parent: entry.seed_parent ?? "",
        pollen_parent: entry.pollen_parent ?? "",
        height: entry.height ?? "",
        width: entry.width ?? "",
        flower_diameter: entry.flower_diameter ?? "",
        port: entry.port ?? "",
        feuillage: entry.feuillage ?? "",
        rusticite: entry.rusticite ?? "",
        sol: entry.sol ?? "",
        adr_label: !!entry.adr_label,
        notes: entry.notes ?? "",
        photo_url: entry.photo_url ?? "",
      })
      setError(null)
    }
  }, [entry])

  if (!entry) return null

  async function handleSave() {
    if (!entry) return
    if (!form.code.trim()) {
      setError("Le code est obligatoire.")
      return
    }
    setSaving(true)
    setError(null)

    const { data, error: updateError } = await supabase
      .from("seedling_catalog")
      .update({
        code: form.code.trim(),
        name: form.name || null,
        seed_parent: form.seed_parent || null,
        pollen_parent: form.pollen_parent || null,
        height: form.height || null,
        width: form.width || null,
        flower_diameter: form.flower_diameter || null,
        port: form.port || null,
        feuillage: form.feuillage || null,
        rusticite: form.rusticite || null,
        sol: form.sol || null,
        adr_label: form.adr_label,
        notes: form.notes || null,
        photo_url: form.photo_url || null,
      })
      .eq("id", entry.id)
      .select()
      .maybeSingle()

    setSaving(false)

    if (updateError || !data) {
      setError(updateError?.message ?? "Mise à jour impossible.")
      return
    }
    onSaved(data as SeedlingCatalogRecord)
  }

  async function handleDelete() {
    if (!entry) return
    if (!confirm(`Supprimer « ${entry.code} » du catalogue des semis ?`)) return
    setSaving(true)
    setError(null)
    const { error: deleteError } = await supabase.from("seedling_catalog").delete().eq("id", entry.id)
    setSaving(false)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    onDeleted(entry.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg text-foreground">Modifier « {entry.code} »</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        {error ? (
          <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="sc-code">
            <Input id="sc-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Nom de la variété" htmlFor="sc-name">
            <Input id="sc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Parent porte-graine (♀)" htmlFor="sc-sp">
            <Input id="sc-sp" value={form.seed_parent} onChange={(e) => setForm({ ...form, seed_parent: e.target.value })} />
          </Field>
          <Field label="Parent pollen (♂)" htmlFor="sc-pp">
            <Input id="sc-pp" value={form.pollen_parent} onChange={(e) => setForm({ ...form, pollen_parent: e.target.value })} />
          </Field>
          <Field label="Hauteur" htmlFor="sc-h">
            <Input id="sc-h" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} placeholder="80 cm" />
          </Field>
          <Field label="Largeur / Envergure" htmlFor="sc-w">
            <Input id="sc-w" value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} placeholder="70 cm" />
          </Field>
          <Field label="Diamètre de la fleur" htmlFor="sc-fd">
            <Input id="sc-fd" value={form.flower_diameter} onChange={(e) => setForm({ ...form, flower_diameter: e.target.value })} placeholder="7 cm" />
          </Field>
          <Field label="Photo (URL)" htmlFor="sc-photo">
            <Input id="sc-photo" value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
          </Field>
          <Field label="Port" htmlFor="sc-port">
            <Select id="sc-port" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })}>
              <option value="">—</option>
              {TRAIT_OPTIONS.port.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Feuillage" htmlFor="sc-feu">
            <Select id="sc-feu" value={form.feuillage} onChange={(e) => setForm({ ...form, feuillage: e.target.value })}>
              <option value="">—</option>
              {TRAIT_OPTIONS.feuillage.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Rusticité" htmlFor="sc-rus">
            <Select id="sc-rus" value={form.rusticite} onChange={(e) => setForm({ ...form, rusticite: e.target.value })}>
              <option value="">—</option>
              {TRAIT_OPTIONS.rusticite.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Type de sol" htmlFor="sc-sol">
            <Select id="sc-sol" value={form.sol} onChange={(e) => setForm({ ...form, sol: e.target.value })}>
              <option value="">—</option>
              {TRAIT_OPTIONS.sol.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Notes de l'hybrideur" htmlFor="sc-notes">
            <Textarea id="sc-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.adr_label}
            onChange={(e) => setForm({ ...form, adr_label: e.target.checked })}
            className="size-4 rounded border-input accent-accent"
          />
          Label ADR
        </label>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="destructive" onClick={handleDelete} disabled={saving} className="gap-1.5">
            Supprimer
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !form.code.trim()}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
