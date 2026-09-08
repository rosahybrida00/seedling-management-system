"use client"

import { useEffect, useState, useMemo } from "react"
import { Search, Plus, Upload, Download, Trash2, Flower2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WeatherBanner } from "@/components/weather/weather-banner"
import { supabase } from "@/lib/supabase-client"
import type { Variety, VarietyPhoto } from "@/lib/domain/supabase-types"
import { ROSE_CATEGORY_LABELS } from "@/lib/domain/supabase-types"
import { Card, Badge, EmptyState, Field, Input, Select } from "@/components/breeding/ui"

interface VarietyWithPhotos extends Variety {
  varieties_photos?: VarietyPhoto[]
}

export default function CatalogPage() {
  const [varieties, setVarieties] = useState<VarietyWithPhotos[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)
  const [newVariety, setNewVariety] = useState({
    name: "",
    obtenteur: "",
    type: "",
    parentage: "",
    description: "",
    category: "baptisee" as const,
  })

  useEffect(() => {
    fetchVarieties()
  }, [])

  async function fetchVarieties() {
    setLoading(true)
    const { data, error } = await supabase
      .from("varieties")
      .select("*, varieties_photos(*)")
      .order("name")
    if (!error && data) {
      setVarieties(data as VarietyWithPhotos[])
    }
    setLoading(false)
  }

  const availableTypes = useMemo(() => {
    const set = new Set<string>()
    varieties.forEach((v) => { if (v.type) set.add(v.type) })
    return Array.from(set).sort()
  }, [varieties])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return varieties.filter((v) => {
      if (q) {
        const haystack = `${v.name} ${v.obtenteur ?? ""} ${v.type ?? ""} ${v.parentage ?? ""} ${v.description ?? ""}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (categoryFilter && v.category !== categoryFilter) return false
      if (typeFilter && v.type !== typeFilter) return false
      return true
    })
  }, [varieties, query, categoryFilter, typeFilter])

  async function handleAdd() {
    if (!newVariety.name.trim()) return
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from("varieties").insert({
      name: newVariety.name.trim(),
      obtenteur: newVariety.obtenteur || null,
      type: newVariety.type || null,
      parentage: newVariety.parentage || null,
      description: newVariety.description || null,
      category: newVariety.category,
      user_id: userData.user?.id ?? null,
    })
    if (!error) {
      setNewVariety({ name: "", obtenteur: "", type: "", parentage: "", description: "", category: "baptisee" })
      setShowAddForm(false)
      fetchVarieties()
    }
  }

  async function handleExport() {
    const csv = [
      "Nom,Obtenteur,Type,Parentage,Catégorie,Description",
      ...filtered.map((v) =>
        [
          `"${v.name}"`,
          `"${v.obtenteur ?? ""}"`,
          `"${v.type ?? ""}"`,
          `"${v.parentage ?? ""}"`,
          `"${ROSE_CATEGORY_LABELS[v.category]}"`,
          `"${v.description ?? ""}"`,
        ].join(","),
      ),
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "catalogue-rosiers.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDeleteAll() {
    if (!confirm("Supprimer toutes vos variétés du catalogue ?")) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    await supabase.from("varieties").delete().eq("user_id", userData.user.id)
    fetchVarieties()
  }

  return (
    <div className="min-h-svh bg-background">
      <WeatherBanner />
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl text-foreground">Catalogue des Rosiers</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {filtered.length} variété{filtered.length > 1 ? "s" : ""} — recherchez par nom, obtenteur, type ou parentage.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowAddForm((v) => !v)} size="sm" className="gap-1.5">
              <Plus className="size-4" /> Ajouter
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              <Upload className="size-4" /> Importer
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
              <Download className="size-4" /> Exporter
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteAll} className="gap-1.5">
              <Trash2 className="size-4" /> Tout supprimer
            </Button>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par nom, obtenteur, type, parentage…"
              className="pl-9"
            />
          </div>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-48"
          >
            <option value="">Toutes catégories</option>
            <option value="baptisee">Variétés baptisées</option>
            <option value="lignee">Lignées / Souches</option>
            <option value="evaluation">En évaluation</option>
          </Select>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-48"
          >
            <option value="">Tous types</option>
            {availableTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>

        {showAddForm ? (
          <Card className="mb-5 p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Nom de la variété" htmlFor="r-name">
                <Input
                  id="r-name"
                  value={newVariety.name}
                  onChange={(e) => setNewVariety({ ...newVariety, name: e.target.value })}
                  placeholder="Rosa gallica 'Officinalis'"
                />
              </Field>
              <Field label="Obtenteur" htmlFor="r-obt">
                <Input
                  id="r-obt"
                  value={newVariety.obtenteur}
                  onChange={(e) => setNewVariety({ ...newVariety, obtenteur: e.target.value })}
                  placeholder="Mme Hardy, 1832"
                />
              </Field>
              <Field label="Type" htmlFor="r-type">
                <Input
                  id="r-type"
                  value={newVariety.type}
                  onChange={(e) => setNewVariety({ ...newVariety, type: e.target.value })}
                  placeholder="Hybride de thé"
                />
              </Field>
              <Field label="Parentage" htmlFor="r-parent">
                <Input
                  id="r-parent"
                  value={newVariety.parentage}
                  onChange={(e) => setNewVariety({ ...newVariety, parentage: e.target.value })}
                  placeholder="Rosa gallica × Rosa moschata"
                />
              </Field>
              <Field label="Catégorie" htmlFor="r-cat">
                <Select
                  id="r-cat"
                  value={newVariety.category}
                  onChange={(e) => setNewVariety({ ...newVariety, category: e.target.value as typeof newVariety.category })}
                >
                  <option value="baptisee">Variété baptisée</option>
                  <option value="lignee">Lignée / Souche parentale</option>
                  <option value="evaluation">En évaluation</option>
                </Select>
              </Field>
              <Field label="Description" htmlFor="r-desc">
                <Input
                  id="r-desc"
                  value={newVariety.description}
                  onChange={(e) => setNewVariety({ ...newVariety, description: e.target.value })}
                  placeholder="Rose blanche très parfumée…"
                />
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>Annuler</Button>
              <Button onClick={handleAdd} disabled={!newVariety.name.trim()}>Ajouter au catalogue</Button>
            </div>
          </Card>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Flower2 className="size-8 animate-pulse text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Flower2 className="size-8" />}
            title="Aucun rosier trouvé"
            description="Ajoutez votre première variété au catalogue ou modifiez vos critères de recherche."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((variety) => (
              <VarietyCard key={variety.id} variety={variety} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function VarietyCard({ variety }: { variety: VarietyWithPhotos }) {
  const categoryTone: Record<string, "primary" | "accent" | "warning"> = {
    baptisee: "primary",
    lignee: "accent",
    evaluation: "warning",
  }
  const primaryPhoto = variety.varieties_photos?.find((p) => p.is_primary) ?? variety.varieties_photos?.[0]
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] bg-muted">
        {primaryPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={primaryPhoto.photo_url} alt={variety.name} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-primary/5">
            <Flower2 className="size-10 text-primary/30" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <Badge tone={categoryTone[variety.category] ?? "neutral"}>
            {ROSE_CATEGORY_LABELS[variety.category]}
          </Badge>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-serif text-base leading-tight text-foreground">{variety.name}</h3>
        {variety.obtenteur ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{variety.obtenteur}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {variety.type ? <Badge tone="neutral">{variety.type}</Badge> : null}
        </div>
        {variety.parentage ? (
          <p className="mt-2 text-xs text-muted-foreground italic">{variety.parentage}</p>
        ) : null}
        {variety.description ? (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{variety.description}</p>
        ) : null}
      </div>
    </Card>
  )
}
