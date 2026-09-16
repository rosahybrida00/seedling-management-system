"use client"

import { useEffect, useState, useMemo } from "react"
import { Plus, Flower2, Pencil, Check, X, Cherry, Trash2, FlaskConical, FileText, Shield } from "lucide-react"
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
import { generateBaseSyllable, lotLetter, flowerLetter, generateFruitCode, generateSeedlingCode, lotIndexFromLetter, flowerIndexFromLetter } from "@/lib/domain/nomenclature"

interface Cross {
  id: string
  code: string
  seed_parent: string | null
  pollen_parent: string | null
  pollination_date: string | null
  remarks: string
  created_at: string
  updated_at: string
  base_syllable: string | null
  lot_letter: string | null
  flower_letter: string | null
  climate_data: Record<string, unknown> | null
  status: string | null
  abort_cause: string | null
  harvest_data: Record<string, unknown> | null
  total_seeds: number | null
  germinated_seeds: number | null
  failed_seeds: number | null
  failure_attribution: string | null
  automatic_synthesis: string | null
  free_notes: string | null
  pollinated_flowers_count?: number | null
  pollen_type?: string | null
  pollen_lot_id?: string | null
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

interface Treatment {
  id: string
  cross_id: string
  product_name: string
  treatment_type: string | null
  repetition_count: number
  applied_at: string
  notes: string | null
}

interface CrossFruit {
  id: string
  cross_id: string
  fruit_name: string
  flower_index: number
  status: string
  seed_count: number
  checklist: Record<string, boolean>
}

interface VarietySuggestion {
  id: string
  name: string
  commercial_name: string | null
  source: "catalogue" | "semis"
}

const CROSS_STATUS_LABELS: Record<string, string> = {
  "En cours": "En cours",
  "Récolté": "Récolté",
  "Avorté": "Avorté",
}

const CROSS_STATUS_TONES: Record<string, "neutral" | "primary" | "warning" | "danger" | "success"> = {
  "En cours": "warning",
  "Récolté": "success",
  "Avorté": "danger",
}

const FAILURE_ATTRIBUTION_LABELS: Record<string, string> = {
  Pollen: "Pollen (Père)",
  Mère: "Mère",
  Climat: "Climat",
  Incompatibilité: "Incompatibilité",
  "Non déterminé": "Non déterminé",
}

const TREATMENT_TYPE_LABELS: Record<string, string> = {
  naturelle: "Naturel",
  biologique: "Bio",
  synthese: "Synthèse",
}

function generateCrossSynthesis(cross: Partial<Cross>): string {
  const parts: string[] = []
  const base = cross.base_syllable ?? ""
  const lot = cross.lot_letter ?? ""
  const flower = cross.flower_letter ?? ""
  if (base) parts.push(`Racine phonétique: ${base}.`)
  if (lot || flower) parts.push(`Code fruit: ${base}${lot}${flower}.`)
  if (cross.seed_parent || cross.pollen_parent) {
    parts.push(`Croisement ${cross.seed_parent ?? "?"} × ${cross.pollen_parent ?? "?"}.`)
  }
  if (cross.status === "Avorté" && cross.abort_cause) {
    parts.push(`Croisement avorté — cause: ${cross.abort_cause}.`)
  }
  if (cross.status === "Récolté") {
    const total = cross.total_seeds ?? 0
    const germ = cross.germinated_seeds ?? 0
    const failed = cross.failed_seeds ?? 0
    parts.push(`Récolte: ${total} graines totales, ${germ} germées, ${failed} non-levées.`)
    if (total > 0) {
      const rate = ((germ / total) * 100).toFixed(1)
      parts.push(`Taux de levée: ${rate}%.`)
    }
  }
  if (cross.failure_attribution) {
    parts.push(`Imputabilité échec: ${FAILURE_ATTRIBUTION_LABELS[cross.failure_attribution] ?? cross.failure_attribution}.`)
  }
  return parts.join(" ")
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
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"crosses" | "pollen" | "fruits">("crosses")
  const [fruits, setFruits] = useState<CrossFruit[]>([])
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    code: "",
    seedParent: "",
    seedParentId: "",
    pollenParent: "",
    pollenParentId: "",
    pollinationDate: new Date().toISOString().split("T")[0],
    remarks: "",
    tempStress: "",
    humidity: "",
    stressNotes: "",
    pollinatedFlowersCount: "1",
    pollenType: "frais",
    pollenLotId: "",
  })

  const [seedSuggestions, setSeedSuggestions] = useState<VarietySuggestion[]>([])
  const [pollenSuggestions, setPollenSuggestions] = useState<VarietySuggestion[]>([])
  const [showSeedSugg, setShowSeedSugg] = useState(false)
  const [showPollenSugg, setShowPollenSugg] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function searchParents(query: string) {
    const escapedQuery = query.replace(/[%,()]/g, " ").trim()
    const [{ data: varieties }, { data: seedlings }] = await Promise.all([
      supabase
        .from("varieties")
        .select("id, name, commercial_name")
        .or(`name.ilike.%${escapedQuery}%,commercial_name.ilike.%${escapedQuery}%`)
        .limit(6),
      supabase
        .from("seedlings")
        .select("id, code")
        .ilike("code", `%${escapedQuery}%`)
        .limit(6),
    ])

    return [
      ...(varieties ?? []).map((item) => ({ ...item, source: "catalogue" as const })),
      ...(seedlings ?? []).map((item) => ({
        id: item.id,
        name: item.code,
        commercial_name: "Semis",
        source: "semis" as const,
      })),
    ].slice(0, 8)
  }

  useEffect(() => {
    const query = form.seedParent.trim()
    if (query.length < 1) {
      setSeedSuggestions([])
      setShowSeedSugg(false)
      return
    }

    const timer = setTimeout(async () => {
      const data = await searchParents(query)
      setSeedSuggestions(data)
      setShowSeedSugg(true)
    }, 200)

    return () => clearTimeout(timer)
  }, [form.seedParent])

  useEffect(() => {
    const query = form.pollenParent.trim()
    if (query.length < 1) {
      setPollenSuggestions([])
      setShowPollenSugg(false)
      return
    }

    const timer = setTimeout(async () => {
      const data = await searchParents(query)
      setPollenSuggestions(data)
      setShowPollenSugg(true)
    }, 200)

    return () => clearTimeout(timer)
  }, [form.pollenParent])

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0]
    if (form.pollinationDate === todayStr) {
      setForm((prev) => ({
        ...prev,
        tempStress: prev.tempStress || "22",
        humidity: prev.humidity || "65",
      }))
    }
  }, [form.pollinationDate])

  async function fetchData() {
    setLoading(true)
    const [{ data: cData }, { data: hData }, { data: pData }, { data: tData }, { data: fData }] = await Promise.all([
      supabase.from("crosses").select("*").order("created_at", { ascending: false }),
      supabase.from("hip_harvests").select("*").order("created_at", { ascending: false }),
      supabase.from("pollen_lots").select("*").order("created_at", { ascending: false }),
      supabase.from("treatments").select("*").order("applied_at", { ascending: false }),
      supabase.from("cross_fruits").select("*").order("created_at", { ascending: false }),
    ])
    if (cData) setCrosses(cData as Cross[])
    if (hData) setHarvests(hData as HipHarvest[])
    if (pData) setPollenLots(pData as PollenLot[])
    if (tData) setTreatments(tData as Treatment[])
    if (fData) setFruits(fData as CrossFruit[])
    setLoading(false)
  }

  async function fetchHistoricalWeather(date: string): Promise<Record<string, unknown>> {
    const fallback: Record<string, unknown> = {}
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return fallback
      const { data: profile } = await supabase
        .from("profiles")
        .select("city, postal_code")
        .eq("id", authData.user.id)
        .maybeSingle()
      const city = profile?.city || profile?.postal_code
      if (!city) return fallback
      const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`)
      const geoData = await geoResponse.json()
      const geo = geoData?.results?.[0]
      if (!geo) return fallback
      const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${geo.latitude}&longitude=${geo.longitude}&start_date=${date}&end_date=${date}&daily=temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum&timezone=auto`)
      if (!response.ok) return fallback
      const data = await response.json()
      return {
        ...fallback,
        historical_date: date,
        location: geo.name,
        temperature_mean: data?.daily?.temperature_2m_mean?.[0] ?? null,
        humidity_mean: data?.daily?.relative_humidity_2m_mean?.[0] ?? null,
        precipitation_sum: data?.daily?.precipitation_sum?.[0] ?? null,
        source: "open-meteo-archive",
      }
    } catch {
      return fallback
    }
  }

  async function createCross() {
    if (!form.seedParent.trim() && !form.pollenParent.trim()) return

    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      alert("Vous devez être connecté pour enregistrer un croisement.")
      return
    }

    const seedVal = form.seedParent.trim() ? form.seedParent.trim() : "Inconnu"
    const pollenVal = form.pollenParent.trim() ? form.pollenParent.trim() : "Inconnu"

    const base = generateBaseSyllable(seedVal, pollenVal)

    const { count } = await supabase
      .from("crosses")
      .select("*", { count: "exact", head: true })
      .eq("base_syllable", base)

    const lotIdx = count ?? 0
    const flowerIdx = 0
    const lot = lotLetter(lotIdx)
    const flower = flowerLetter(flowerIdx)
    const fruitCode = generateFruitCode(base, lotIdx, flowerIdx)

    const climateData: Record<string, unknown> = await fetchHistoricalWeather(form.pollinationDate)
    if (form.tempStress) climateData.temperature_observed = form.tempStress
    if (form.humidity) climateData.humidity_observed = form.humidity
    if (form.stressNotes) climateData.stress_notes = form.stressNotes

    const payload: Record<string, any> = {
      user_id: authData.user.id,
      code: fruitCode,
      seed_parent: seedVal,
      pollen_parent: pollenVal,
      pollination_date: fromDateInput(form.pollinationDate),
      remarks: form.remarks || "",
      base_syllable: base,
      lot_letter: lot,
      flower_letter: flower,
      climate_data: climateData,
      status: "En cours",
      flower_count: Number.parseInt(form.pollinatedFlowersCount, 10) || 1,
      pollen_type: form.pollenType,
      pollen_lot_id: form.pollenType === "conservé" ? form.pollenLotId || null : null,
      // The connected local schema still references the legacy rose_varieties table.
      // Keep the exact selected parent names until that legacy FK is aligned with varieties.
      // This prevents valid catalogue selections from failing on insert.
    }

    const { data: createdCross, error } = await supabase.from("crosses").insert(payload).select("id").single()
    if (error) {
      const details = [error.message, error.details, error.hint, error.code].filter(Boolean).join(" — ")
      console.error("[v0] Erreur lors de la création du croisement :", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        payload,
      })
      alert(`Erreur lors de la création du croisement : ${details || "échec de l’insertion"}`)
      return
    }

    if (createdCross) {
      const flowerCount = Number.parseInt(form.pollinatedFlowersCount, 10) || 1
      const fruitsToCreate = Array.from({ length: flowerCount }, (_, index) => ({
        user_id: authData.user.id,
        cross_id: createdCross.id,
        fruit_name: `${base}${lot}-${flowerLetter(index)}`,
        flower_index: index + 1,
        climate_data: climateData,
      }))
      await supabase.from("cross_fruits").insert(fruitsToCreate)
    }

    const missingParents = [
      !form.seedParentId && form.seedParent.trim()
        ? { name: seedVal, role: "seed" as const, label: "porte-graine" }
        : null,
      !form.pollenParentId && form.pollenParent.trim()
        ? { name: pollenVal, role: "pollen" as const, label: "pollen" }
        : null,
    ].filter(Boolean) as Array<{ name: string; role: "seed" | "pollen"; label: string }>

    if (createdCross && missingParents.length > 0) {
      await supabase.from("parent_alerts").insert(
        missingParents.map((parent) => ({
          parent_name: parent.name,
          parent_role: parent.role,
          cross_id: createdCross.id,
          message: `Ajouter le parent ${parent.label} « ${parent.name} » au catalogue.`,
        })),
      )
      alert(`Croisement créé. Parent à ajouter au catalogue : ${missingParents.map((parent) => parent.name).join(", ")}.`)
    }

    setForm({
      code: "",
      seedParent: "",
      seedParentId: "",
      pollenParent: "",
      pollenParentId: "",
      pollinationDate: new Date().toISOString().split("T")[0],
      remarks: "",
      tempStress: "",
      humidity: "",
      stressNotes: "",
      pollinatedFlowersCount: "1",
      pollenType: "frais",
      pollenLotId: "",
    })
    setCreating(false)
    fetchData()
  }

  async function updateCross(c: Cross, changes: Partial<Cross>) {
    const synthesis = generateCrossSynthesis({ ...c, ...changes })
    const { error } = await supabase.from("crosses").update({ ...changes, automatic_synthesis: synthesis }).eq("id", c.id)
    if (error) console.error("Erreur update croisement:", error)

    const previousGerminated = c.germinated_seeds ?? 0
    const nextGerminated = changes.germinated_seeds ?? previousGerminated
    const newlyGerminated = nextGerminated - previousGerminated
    if (!error && newlyGerminated > 0) {
      await injectGerminatedSeedlings({ ...c, ...changes }, newlyGerminated)
    }

    fetchData()
  }

  async function injectGerminatedSeedlings(cross: Cross, count: number) {
    let harvest = harvests.find((h) => h.cross_id === cross.id)
    if (!harvest) {
      const { data, error } = await supabase
        .from("hip_harvests")
        .insert({ cross_id: cross.id, code: cross.code, harvest_date: null, seed_count: cross.total_seeds ?? 0, remarks: "" })
        .select()
        .maybeSingle()
      if (error || !data) {
        console.error("Erreur création récolte automatique :", error)
        return
      }
      harvest = data as HipHarvest
    }

    const { data: existingBatches } = await supabase
      .from("sowing_batches")
      .select("id, code")
      .eq("hip_harvest_id", harvest.id)
      .limit(1)

    let batch = existingBatches?.[0] as { id: string; code: string } | undefined
    if (!batch) {
      const { data, error } = await supabase
        .from("sowing_batches")
        .insert({
          hip_harvest_id: harvest.id,
          code: harvest.code,
          sowing_date: new Date().toISOString(),
          seed_count: cross.total_seeds ?? 0,
          remarks: "",
        })
        .select("id, code")
        .maybeSingle()
      if (error || !data) {
        console.error("Erreur création lot de semis automatique :", error)
        return
      }
      batch = data as { id: string; code: string }
    }

    const { count: existingCount } = await supabase
      .from("seedlings")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batch.id)

    const lotIdx = lotIndexFromLetter(cross.lot_letter)
    const flowerIdx = flowerIndexFromLetter(cross.flower_letter)
    const startIndex = (existingCount ?? 0) + 1

    const rows = Array.from({ length: count }, (_, i) => {
      const seedlingIndex = startIndex + i
      return {
        batch_id: batch!.id,
        code: `${cross.code}${seedlingIndex}`,
        index: seedlingIndex,
        status: "observing",
        remarks: "",
        seedling_code: generateSeedlingCode(cross.base_syllable ?? cross.code, lotIdx, flowerIdx, seedlingIndex),
        evaluation_status: "Évaluation",
        is_promoted_to_variety: false,
      }
    })

    const { error: seedlingError } = await supabase.from("seedlings").insert(rows)
    if (seedlingError) {
      console.error("Erreur injection semis automatique :", seedlingError)
    }
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

  const treatmentsByCross = useMemo(() => {
    const m = new Map<string, Treatment[]>()
    treatments.forEach((t) => {
      const arr = m.get(t.cross_id) ?? []
      arr.push(t)
      m.set(t.cross_id, arr)
    })
    return m
  }, [treatments])

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
        description="Suivi des pollinisations, nouaison, fruits, lots de pollen, traitements phytosanitaires et imputabilité."
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
          onClick={() => setActiveTab("fruits")}
          className={
            activeTab === "fruits"
              ? "flex items-center gap-1.5 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
              : "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
          }
        >
          <Cherry className="size-4" /> Module Fruits
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
                <div className="relative">
                  <Field label="Parent porte-graine (♀)" hint="Catalogue et tous vos semis">
                    <Input
                      value={form.seedParent}
                      onChange={(e) => setForm({ ...form, seedParent: e.target.value, seedParentId: "" })}
                      onFocus={() => { if (seedSuggestions.length > 0) setShowSeedSugg(true) }}
                      placeholder="Ex: Grande Amore..."
                    />
                  </Field>
                  {showSeedSugg && seedSuggestions.length > 0 ? (
                    <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                      {seedSuggestions.map((s) => (
                        <div
                          key={s.id}
                          className="cursor-pointer px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setForm({ ...form, seedParent: s.name, seedParentId: s.id })
                            setShowSeedSugg(false)
                          }}
                        >
                          <span className="font-medium text-foreground">{s.name}</span>
                          {s.commercial_name && s.commercial_name !== s.name ? (
                            <span className="text-muted-foreground"> ({s.commercial_name})</span>
                          ) : null}
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-primary/70">{s.source}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="relative">
                  <Field label="Parent pollen (♂)" hint="Catalogue et tous vos semis">
                    <Input
                      value={form.pollenParent}
                      onChange={(e) => setForm({ ...form, pollenParent: e.target.value, pollenParentId: "" })}
                      onFocus={() => { if (pollenSuggestions.length > 0) setShowPollenSugg(true) }}
                      placeholder="Ex: Black Baccara..."
                    />
                  </Field>
                  {showPollenSugg && pollenSuggestions.length > 0 ? (
                    <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                      {pollenSuggestions.map((s) => (
                        <div
                          key={s.id}
                          className="cursor-pointer px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setForm({ ...form, pollenParent: s.name, pollenParentId: s.id })
                            setShowPollenSugg(false)
                          }}
                        >
                          <span className="font-medium text-foreground">{s.name}</span>
                          {s.commercial_name && s.commercial_name !== s.name ? (
                            <span className="text-muted-foreground"> ({s.commercial_name})</span>
                          ) : null}
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-primary/70">{s.source}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <Field label="Date de pollinisation">
                  <Input type="date" value={form.pollinationDate} onChange={(e) => setForm({ ...form, pollinationDate: e.target.value })} />
                </Field>

                <Field label="Nombre de fleurs pollinisées" hint="Quantité de fleurs de ce lot">
                  <Input type="number" min={1} value={form.pollinatedFlowersCount} onChange={(e) => setForm({ ...form, pollinatedFlowersCount: e.target.value })} />
                </Field>

                <Field label="Type de pollen" hint="Sélectionnez l'origine du pollen">
                  <Select value={form.pollenType} onChange={(e) => setForm({ ...form, pollenType: e.target.value })}>
                    <option value="frais">Pollen frais (Utilisation directe)</option>
                    <option value="conservé">Lot de pollen conservé (Stock)</option>
                  </Select>
                </Field>

                {form.pollenType === "conservé" ? (
                  <Field label="Lot de pollen conservé" hint="Choisir dans le module pollen">
                    <Select value={form.pollenLotId} onChange={(e) => setForm({ ...form, pollenLotId: e.target.value })}>
                      <option value="">-- Sélectionner un lot --</option>
                      {pollenLots.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          Lot #{pl.lot_number} ({pl.rose_name ?? "Inconnu"})
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}

                <Field label="Température (°C)" hint="Donnée climatique pour l'imputabilité">
                  <Input type="number" value={form.tempStress} onChange={(e) => setForm({ ...form, tempStress: e.target.value })} placeholder="22" />
                </Field>
                <Field label="Humidité (%)" hint="Donnée climatique pour l'imputabilité">
                  <Input type="number" value={form.humidity} onChange={(e) => setForm({ ...form, humidity: e.target.value })} placeholder="65" />
                </Field>
                <Field label="Notes de stress thermique" hint="Stress climatique constaté">
                  <Input value={form.stressNotes} onChange={(e) => setForm({ ...form, stressNotes: e.target.value })} placeholder="Canicule, gel..." />
                </Field>
              </div>

              <div className="mt-3">
                <Field label="Remarques">
                  <Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Observations..." />
                </Field>
              </div>

              <div className="mt-3 rounded-md bg-primary/5 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  <strong>Code auto-généré :</strong> {form.seedParent && form.pollenParent
                    ? generateFruitCode(generateBaseSyllable(form.seedParent, form.pollenParent), 0, 0)
                    : "— (renseignez les parents)"}
                </p>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCreating(false)}>Annuler</Button>
                <Button onClick={createCross} disabled={!form.seedParent.trim() && !form.pollenParent.trim()}>Créer</Button>
              </div>
            </Card>
          ) : null}

          {crosses.length === 0 ? (
            <EmptyState
              icon={<Flower2 className="size-8" />}
              title="Aucun croisement"
              description="Commencez par enregistrer un croisement entre deux rosiers parents. Le code phonétique est généré automatiquement."
            />
          ) : (
            <div className="grid gap-3">
              {crosses.map((c) => {
                const cHarvests = harvests.filter((h) => h.cross_id === c.id)
                const cTreatments = treatmentsByCross.get(c.id) ?? []
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
                              Pollinisé le {formatDate(c.pollination_date)} {c.pollinated_flowers_count ? `• ${c.pollinated_flowers_count} fleur(s)` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="ml-auto flex items-center gap-3">
                          {c.base_syllable ? <Badge tone="accent">Racine: {c.base_syllable}</Badge> : null}
                          {c.status ? <Badge tone={CROSS_STATUS_TONES[c.status] ?? "neutral"}>{CROSS_STATUS_LABELS[c.status] ?? c.status}</Badge> : null}
                          <Badge tone="primary">{cHarvests.length} récolte(s)</Badge>
                          {cTreatments.length > 0 ? <Badge tone="neutral"><Shield className="size-3" /> {cTreatments.length} trait.</Badge> : null}
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

                    {c.automatic_synthesis ? (
                      <div className="mt-3 rounded-md bg-muted/30 px-3 py-2">
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <FileText className="mt-0.5 size-3 shrink-0" />
                          <span>{c.automatic_synthesis}</span>
                        </p>
                      </div>
                    ) : null}
                    {c.free_notes ? (
                      <div className="mt-1 px-3">
                        <p className="text-xs text-muted-foreground italic">Notes: {c.free_notes}</p>
                      </div>
                    ) : null}

                    {cTreatments.length > 0 ? (
                      <div className="mt-2 border-t border-border pt-2">
                        <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <Shield className="size-3" /> Traitements phytosanitaires
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {cTreatments.map((t) => (
                            <Badge key={t.id} tone="neutral">
                              {t.product_name}
                              {t.treatment_type ? ` (${TREATMENT_TYPE_LABELS[t.treatment_type] ?? t.treatment_type})` : ""}
                              {t.repetition_count > 1 ? ` ×${t.repetition_count}` : ""}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}

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
      ) : activeTab === "pollen" ? (
        <PollenPanel pollenLots={pollenLots} onRefresh={fetchData} />
      ) : (
        <FruitsPanel fruits={fruits} crosses={crosses} onRefresh={fetchData} />
      )}
    </div>
  )
}
function CrossEditRow({ cross, onSave, onCancel }: { cross: Cross; onSave: (changes: Partial<Cross>) => void; onCancel: () => void }) {
  const [seedParent, setSeedParent] = useState(cross.seed_parent ?? "")
  const [pollenParent, setPollenParent] = useState(cross.pollen_parent ?? "")
  const [pollinationDate, setPollinationDate] = useState(toDateInput(cross.pollination_date))
  const [remarks, setRemarks] = useState(cross.remarks ?? "")
  const [status, setStatus] = useState(cross.status ?? "En cours")
  const [abortCause, setAbortCause] = useState(cross.abort_cause ?? "")
  const [totalSeeds, setTotalSeeds] = useState(String(cross.total_seeds ?? 0))
  const [germinatedSeeds, setGerminatedSeeds] = useState(String(cross.germinated_seeds ?? 0))
  const [failedSeeds, setFailedSeeds] = useState(String(cross.failed_seeds ?? 0))
  const [failureAttribution, setFailureAttribution] = useState(cross.failure_attribution ?? "")
  const [freeNotes, setFreeNotes] = useState(cross.free_notes ?? "")
  const [pollinatedFlowersCount, setPollinatedFlowersCount] = useState(String(cross.pollinated_flowers_count ?? 1))

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Parent porte-graine (♀)">
          <Input value={seedParent} onChange={(e) => setSeedParent(e.target.value)} />
        </Field>
        <Field label="Parent pollen (♂)">
          <Input value={pollenParent} onChange={(e) => setPollenParent(e.target.value)} />
        </Field>
        <Field label="Date de pollinisation">
          <Input type="date" value={pollinationDate} onChange={(e) => setPollinationDate(e.target.value)} />
        </Field>
        <Field label="Statut">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="En cours">En cours</option>
            <option value="Récolté">Récolté</option>
            <option value="Avorté">Avorté</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Fleurs pollinisées">
          <Input type="number" min={1} value={pollinatedFlowersCount} onChange={(e) => setPollinatedFlowersCount(e.target.value)} />
        </Field>
        {status === "Avorté" ? (
          <Field label="Cause d'avortement">
            <Input value={abortCause} onChange={(e) => setAbortCause(e.target.value)} placeholder="Ex: Coulure, gel..." />
          </Field>
        ) : null}
        {status === "Récolté" ? (
          <>
            <Field label="Graines totales">
              <Input type="number" value={totalSeeds} onChange={(e) => setTotalSeeds(e.target.value)} />
            </Field>
            <Field label="Graines germées (Levée)">
              <Input type="number" value={germinatedSeeds} onChange={(e) => setGerminatedSeeds(e.target.value)} />
            </Field>
            <Field label="Graines non-levées">
              <Input type="number" value={failedSeeds} onChange={(e) => setFailedSeeds(e.target.value)} />
            </Field>
            <Field label="Imputabilité échec">
              <Select value={failureAttribution} onChange={(e) => setFailureAttribution(e.target.value)}>
                <option value="">-- Non défini --</option>
                <option value="Pollen">Pollen (Père)</option>
                <option value="Mère">Mère</option>
                <option value="Climat">Climat</option>
                <option value="Incompatibilité">Incompatibilité</option>
                <option value="Non déterminé">Non déterminé</option>
              </Select>
            </Field>
          </>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Remarques techniques">
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
        <Field label="Notes libres / Observations">
          <Input value={freeNotes} onChange={(e) => setFreeNotes(e.target.value)} />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1">
          <X className="size-3.5" /> Annuler
        </Button>
        <Button
          size="sm"
          onClick={() =>
            onSave({
              seed_parent: seedParent,
              pollen_parent: pollenParent,
              pollination_date: fromDateInput(pollinationDate),
              remarks,
              status,
              abort_cause: status === "Avorté" ? abortCause : null,
              total_seeds: status === "Récolté" ? parseInt(totalSeeds, 10) || 0 : null,
              germinated_seeds: status === "Récolté" ? parseInt(germinatedSeeds, 10) || 0 : null,
              failed_seeds: status === "Récolté" ? parseInt(failedSeeds, 10) || 0 : null,
              failure_attribution: status === "Récolté" ? failureAttribution || null : null,
              free_notes: freeNotes,
              pollinated_flowers_count: parseInt(pollinatedFlowersCount, 10) || 1,
            })
          }
          className="gap-1"
        >
          <Check className="size-3.5" /> Enregistrer
        </Button>
      </div>
    </div>
  )
}

function HarvestRow({ harvest, onUpdate, onDelete }: { harvest: HipHarvest; onUpdate: (changes: Partial<HipHarvest>) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false)
  const [seedCount, setSeedCount] = useState(String(harvest.seed_count ?? 0))
  const [harvestDate, setHarvestDate] = useState(toDateInput(harvest.harvest_date))
  const [fruitCalibre, setFruitCalibre] = useState(harvest.fruit_calibre ?? "")
  const [maturation, setMaturation] = useState(harvest.maturation ?? "")
  const [avortementCause, setAvortementCause] = useState(harvest.avortement_cause ?? "")
  const [seedExtraction, setSeedExtraction] = useState(harvest.seed_extraction ?? "")
  const [remarks, setRemarks] = useState(harvest.remarks ?? "")

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/20 px-3 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-medium text-foreground">Récolte {harvest.code}</span>
          <span className="text-muted-foreground">Date: {formatDate(harvest.harvest_date)}</span>
          <span className="text-muted-foreground">• Graines: {harvest.seed_count}</span>
          {harvest.fruit_calibre ? <Badge tone="neutral">Calibre: {FRUIT_CALIBRE_LABELS[harvest.fruit_calibre] ?? harvest.fruit_calibre}</Badge> : null}
          {harvest.maturation ? <Badge tone="neutral">Maturation: {MATURATION_LABELS[harvest.maturation] ?? harvest.maturation}</Badge> : null}
          {harvest.seed_extraction ? <Badge tone="neutral">Extraction: {SEED_EXTRACTION_LABELS[harvest.seed_extraction] ?? harvest.seed_extraction}</Badge> : null}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-7 text-xs">Éditer</Button>
          <Button variant="destructive" size="sm" onClick={onDelete} className="h-7 px-2"><Trash2 className="size-3" /></Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3 rounded-md border border-border bg-background p-3 text-xs">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Date de récolte">
          <Input type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} />
        </Field>
        <Field label="Nombre de graines">
          <Input type="number" value={seedCount} onChange={(e) => setSeedCount(e.target.value)} />
        </Field>
        <Field label="Calibre du fruit">
          <Select value={fruitCalibre} onChange={(e) => setFruitCalibre(e.target.value)}>
            <option value="">-- Sélectionner --</option>
            {Object.entries(FRUIT_CALIBRE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Niveau de maturation">
          <Select value={maturation} onChange={(e) => setMaturation(e.target.value)}>
            <option value="">-- Sélectionner --</option>
            {Object.entries(MATURATION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Cause d'avortement (interne)">
          <Select value={avortementCause} onChange={(e) => setAvortementCause(e.target.value)}>
            <option value="">-- Sélectionner --</option>
            {Object.entries(AVORTEMENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Extraction des graines">
          <Select value={seedExtraction} onChange={(e) => setSeedExtraction(e.target.value)}>
            <option value="">-- Sélectionner --</option>
            {Object.entries(SEED_EXTRACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Remarques récolte">
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Annuler</Button>
        <Button
          size="sm"
          onClick={() => {
            onUpdate({
              harvest_date: fromDateInput(harvestDate),
              seed_count: parseInt(seedCount, 10) || 0,
              fruit_calibre: fruitCalibre || null,
              maturation: maturation || null,
              avortement_cause: avortementCause || null,
              seed_extraction: seedExtraction || null,
              remarks,
            })
            setEditing(false)
          }}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  )
}

function FruitsPanel({ fruits, crosses, onRefresh }: { fruits: CrossFruit[]; crosses: Cross[]; onRefresh: () => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [seedCount, setSeedCount] = useState("0")
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})

  async function saveFruit(fruit: CrossFruit) {
    const count = Math.max(0, Number.parseInt(seedCount, 10) || 0)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { error } = await supabase.from("cross_fruits").update({
      seed_count: count,
      checklist,
      status: count > 0 ? "récolté" : fruit.status,
    }).eq("id", fruit.id)
    if (error) {
      alert(`Erreur : ${error.message}`)
      return
    }
    if (count > 0) {
      const year = new Date().getFullYear()
      await supabase.from("harvested_seeds").upsert(
        Array.from({ length: count }, (_, index) => ({
          user_id: userData.user.id,
          fruit_id: fruit.id,
          seed_name: `${fruit.fruit_name}-${index + 1}-${year}`,
          seed_number: index + 1,
          harvest_year: year,
        })),
        { onConflict: "fruit_id,seed_number" },
      )
    }
    setEditing(null)
    onRefresh()
  }

  return (
    <Card className="p-4">
      <SectionHeading title="Suivi des fruits" description="Chaque fleur crée automatiquement un fruit. Les graines reçoivent leur nom complet et leur numéro." />
      {fruits.length === 0 ? <EmptyState icon={<Cherry className="size-8" />} title="Aucun fruit" description="Les fruits apparaîtront automatiquement après la création d’un croisement." /> : (
        <div className="mt-4 grid gap-2">
          {fruits.map((fruit) => {
            const cross = crosses.find((item) => item.id === fruit.cross_id)
            const isEditing = editing === fruit.id
            return <div key={fruit.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3 text-sm">
              <Cherry className="size-4 text-primary" />
              <span className="font-medium">{fruit.fruit_name}</span>
              <span className="text-xs text-muted-foreground">{cross?.seed_parent ?? "?"} × {cross?.pollen_parent ?? "?"}</span>
              <Badge tone={fruit.status === "récolté" ? "success" : "warning"}>{fruit.status}</Badge>
              <span className="text-xs text-muted-foreground">{fruit.seed_count} graine(s)</span>
              <div className="ml-auto flex items-center gap-2">
                {isEditing ? <>
                  <Input className="w-24" type="number" min={0} value={seedCount} onChange={(event) => setSeedCount(event.target.value)} aria-label={`Nombre de graines pour ${fruit.fruit_name}`} />
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={Boolean(checklist.mature)} onChange={(event) => setChecklist({ ...checklist, mature: event.target.checked })} /> mûr</label>
                  <Button size="sm" onClick={() => saveFruit(fruit)}>Enregistrer</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
                </> : <Button size="sm" variant="outline" onClick={() => { setEditing(fruit.id); setSeedCount(String(fruit.seed_count)); setChecklist(fruit.checklist ?? {}) }}>Suivre / graines</Button>}
              </div>
            </div>
          })}
        </div>
      )}
    </Card>
  )
}

function PollenPanel({ pollenLots, onRefresh }: { pollenLots: PollenLot[]; onRefresh: () => void }) {
  const [creating, setCreating] = useState(false)
  const [lotNumber, setLotNumber] = useState("")
  const [roseName, setRoseName] = useState("")
  const [antherQuality, setAntherQuality] = useState("")
  const [dehiscence, setDehiscence] = useState("")
  const [conservationMode, setConservationMode] = useState("")
  const [remarks, setRemarks] = useState("")

  async function createPollenLot() {
    if (!lotNumber.trim()) return
    const { error } = await supabase.from("pollen_lots").insert({
      lot_number: lotNumber.trim(),
      rose_name: roseName.trim() || null,
      anther_quality: antherQuality || null,
      dehiscence: dehiscence || null,
      conservation_mode: conservationMode || null,
      remarks: remarks.trim(),
    })
    if (error) {
      alert(`Erreur : ${error.message}`)
      return
    }
    setLotNumber("")
    setRoseName("")
    setAntherQuality("")
    setDehiscence("")
    setConservationMode("")
    setRemarks("")
    setCreating(false)
    onRefresh()
  }

  async function deletePollenLot(id: string) {
    if (!confirm("Supprimer ce lot de pollen ?")) return
    await supabase.from("pollen_lots").delete().eq("id", id)
    onRefresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Gestion des stocks de pollen conservé</h3>
          <p className="text-xs text-muted-foreground">Récolte, qualité des anthères, déhiscence et modes de conservation longue durée.</p>
        </div>
        <Button onClick={() => setCreating((v) => !v)} className="gap-1.5">
          <Plus className="size-4" /> Nouveau lot de pollen
        </Button>
      </div>

      {creating ? (
        <Card className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Numéro de lot" hint="Identifiant unique du lot">
              <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder="Ex: P-2026-01" />
            </Field>
            <Field label="Nom du rosier (donneur)">
              <Input value={roseName} onChange={(e) => setRoseName(e.target.value)} placeholder="Ex: Graham Thomas" />
            </Field>
            <Field label="Qualité des anthères">
              <Select value={antherQuality} onChange={(e) => setAntherQuality(e.target.value)}>
                <option value="">-- Sélectionner --</option>
                {Object.entries(ANTHER_QUALITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            <Field label="Déhiscence">
              <Select value={dehiscence} onChange={(e) => setDehiscence(e.target.value)}>
                <option value="">-- Sélectionner --</option>
                {Object.entries(DEHISCENCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            <Field label="Mode de conservation">
              <Select value={conservationMode} onChange={(e) => setConservationMode(e.target.value)}>
                <option value="">-- Sélectionner --</option>
                {Object.entries(CONSERVATION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            <Field label="Remarques">
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Observations..." />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>Annuler</Button>
            <Button onClick={createPollenLot} disabled={!lotNumber.trim()}>Enregistrer le lot</Button>
          </div>
        </Card>
      ) : null}

      {pollenLots.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="size-8" />}
          title="Aucun lot de pollen enregistré"
          description="Créez des lots de pollen pour pouvoir les associer ultérieurement dans vos croisements."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pollenLots.map((pl) => (
            <Card key={pl.id} className="p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-serif text-base font-semibold text-primary">Lot #{pl.lot_number}</span>
                  <Button variant="destructive" size="sm" onClick={() => deletePollenLot(pl.id)} className="size-7 p-0">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">{pl.rose_name ?? "Rosier inconnu"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pl.anther_quality ? <Badge tone="neutral">Anthères: {ANTHER_QUALITY_LABELS[pl.anther_quality] ?? pl.anther_quality}</Badge> : null}
                  {pl.dehiscence ? <Badge tone="neutral">Déhiscence: {DEHISCENCE_LABELS[pl.dehiscence] ?? pl.dehiscence}</Badge> : null}
                  {pl.conservation_mode ? <Badge tone="primary">Stockage: {CONSERVATION_LABELS[pl.conservation_mode] ?? pl.conservation_mode}</Badge> : null}
                </div>
                {pl.remarks ? <p className="mt-2 text-xs text-muted-foreground italic">{pl.remarks}</p> : null}
              </div>
              <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
                Créé le {formatDate(pl.created_at)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
