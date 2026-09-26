"use client"

import { useEffect, useState, useMemo } from "react"
import { Plus, Flower2, Trash2, Cherry, FlaskConical, Shield, ArrowLeft, Sprout, Ban, CalendarClock } from "lucide-react"
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
import { generateBaseSyllable, pairKey, lotLetter, generateLotCode, generateFruitCode, lotIndexFromLetter } from "@/lib/domain/nomenclature"
import { getWeatherForDate, type DailyWeather } from "@/lib/services/weatherService"

// ---------------------------------------------------------------------------
// Architecture : Couple (parents) -> Lot (une pollinisation, table `crosses`)
// -> Fruit (une fleur pollinisée, table `cross_fruits`) -> Graine (table
// `harvested_seeds`). Navigation à 3 niveaux, en mode Focus : cliquer sur
// une carte l'isole à l'écran ; un bouton retour ramène à la liste. Plus de
// boutons Éditer/Supprimer visibles en permanence : l'édition se fait en
// cliquant directement sur un champ (Entrée pour valider), seule une
// icône de corbeille discrète reste pour supprimer.
// ---------------------------------------------------------------------------

const PHENOLOGY_STAGES = [
  "Ovaire noué",
  "Grossissement du fruit",
  "Changement de couleur",
  "Ramollissement / début de maturation",
  "Fruit à maturité",
]

// Règle globale de l'appli : cases à cocher / choix prédéfinis partout,
// pour faciliter les bilans généraux ; seule exception, un champ Remarque
// en texte libre.
const CALIBRE_STAGE_OPTIONS = ["Amorce (<5mm)", "Petit (5-10mm)", "Moyen (10-15mm)", "Gros (15-20mm)", "Très gros (>20mm)"]
const COLOR_OPTIONS = ["Jaune", "Orange", "Rouge"]
const BEHAVIOR_OPTIONS = ["Normal", "Flétrissement partiel", "Taches / lésions", "Chute imminente", "Attaque insectes/oiseaux"]

// Le pistil (organe reproducteur femelle) comprend le stigmate (capture le
// pollen), le style (relie le stigmate à l'ovaire) et l'ovaire — c'est lui
// qui, après fécondation, se transforme en fruit (d'où "ovaire noué").
const PISTIL_GROUPS: Array<{ title: string; options: Record<string, string> }> = [
  {
    title: "Le stigmate (réception du pollen et état de réceptivité)",
    options: {
      stigmate_receptif: "Réceptif / Humide (brillant, prêt à capturer le pollen)",
      stigmate_asseche: "Asséché / Bruni prématurément (compromet la germination du pollen)",
      stigmate_parasites: "Attaque de parasites / Champignons (moisissure, pourriture)",
      stigmate_absence: "Absence ou malformation",
    },
  },
  {
    title: "Le style (canal de progression du tube pollinique)",
    options: {
      style_sain: "Sain / Bien érigé",
      style_fletri: "Flétri / Cassé",
      style_necrose: "Taches nécrotiques ou lésions",
      style_insectes: "Attaque d'insectes (ex : piqûres de parasites)",
    },
  },
  {
    title: "L'ovaire (base du pistil)",
    options: {
      ovaire_sain: "Sain et bien formé (aspect turgescent, vert, sans défaut visible)",
      ovaire_malforme: "Malformé / Asymétrique (anomalie de développement de la fleur)",
      ovaire_sousdeveloppe: "Sous-développé / Trop petit (risque d'échec de la nouaison)",
      ovaire_lesions: "Présence de lésions / blessures (traces de manipulation ou de frottement)",
    },
  },
]
const PISTIL_OPTIONS: Record<string, string> = Object.fromEntries(PISTIL_GROUPS.flatMap((g) => Object.entries(g.options)))

interface Cross {
  id: string
  code: string
  seed_parent: string | null
  pollen_parent: string | null
  pollination_date: string | null
  remarks: string
  created_at: string
  base_syllable: string | null
  lot_letter: string | null
  climate_data: Record<string, unknown> | null
  flower_count: number | null
  pollen_type: string | null
  pollen_lot_id: string | null
  location: string | null
  containers: string | null
  pistil_checklist: string[]
}

interface PollenLot {
  id: string
  lot_number: string
  rose_name: string | null
  harvest_date: string | null
  weather_data: Record<string, any> | null
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

interface HarvestedSeed {
  id: string
  fruit_id: string
  seed_name: string
  seed_number: number
  greenhouse_table_id: string | null
}

interface PhenologyObservation {
  date: string
  stages: string[]
  calibre: string
  couleur: string
  comportement: string[]
  remarque: string
}

interface CrossFruit {
  id: string
  cross_id: string
  fruit_name: string
  flower_index: number
  status: "suivi" | "récolté" | "vide" | "avorté"
  seed_count: number
  checklist: { observations?: PhenologyObservation[] } | null
  climate_data: Record<string, unknown> | null
  harvest_date: string | null
  fruit_calibre: string | null
  maturation: string | null
  seed_extraction: string | null
  failure_causes: string[]
}

interface VarietySuggestion {
  id: string
  name: string
  commercial_name: string | null
  source: "catalogue" | "semis"
}

const TREATMENT_TYPE_LABELS: Record<string, string> = {
  naturelle: "Naturel",
  biologique: "Bio",
  synthese: "Synthèse",
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
  const [fruits, setFruits] = useState<CrossFruit[]>([])
  const [seeds, setSeeds] = useState<HarvestedSeed[]>([])
  const [pollenLots, setPollenLots] = useState<PollenLot[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [greenhouses, setGreenhouses] = useState<Array<{ id: string; name: string }>>([])
  const [tables, setTables] = useState<Array<{ id: string; greenhouse_id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"crosses" | "pollen">("crosses")
  const [creating, setCreating] = useState(false)
  const [addingLotFor, setAddingLotFor] = useState<{ seedParent: string; pollenParent: string } | null>(null)
  // Mode Focus : quand focusedKey est renseigné, seule cette carte de couple
  // est affichée (toutes les autres disparaissent de l'écran).
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [focusedLot, setFocusedLot] = useState<string | null>(null)

  const [form, setForm] = useState({
    seedParent: "",
    seedParentId: "",
    pollenParent: "",
    pollenParentId: "",
    pollinationDate: new Date().toISOString().split("T")[0],
    pollinatedFlowersCount: "",
    pollenType: "frais",
    pollenLotId: "",
    freshAntherQuality: "",
    freshDehiscence: "",
    pistilChecklist: [] as string[],
  })
  const [pollinationWeather, setPollinationWeather] = useState<DailyWeather | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)

  const [seedSuggestions, setSeedSuggestions] = useState<VarietySuggestion[]>([])
  const [pollenSuggestions, setPollenSuggestions] = useState<VarietySuggestion[]>([])
  const [showSeedSugg, setShowSeedSugg] = useState(false)
  const [showPollenSugg, setShowPollenSugg] = useState(false)
  const [seedHighlight, setSeedHighlight] = useState(-1)
  const [pollenHighlight, setPollenHighlight] = useState(-1)

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
      supabase.from("seedlings").select("id, code").ilike("code", `%${escapedQuery}%`).limit(6),
    ])
    return [
      ...(varieties ?? []).map((item) => ({ ...item, source: "catalogue" as const })),
      ...(seedlings ?? []).map((item) => ({ id: item.id, name: item.code, commercial_name: "Semis", source: "semis" as const })),
    ].slice(0, 8)
  }

  useEffect(() => {
    const query = form.seedParent.trim()
    // Une variété vient d'être sélectionnée dans la liste : ne pas relancer
    // une recherche derrière (c'est ce qui obligeait à cliquer deux fois
    // pour faire disparaître la suggestion).
    if (form.seedParentId) { setShowSeedSugg(false); return }
    if (query.length < 1) { setSeedSuggestions([]); setShowSeedSugg(false); return }
    const timer = setTimeout(async () => { setSeedSuggestions(await searchParents(query)); setShowSeedSugg(true); setSeedHighlight(-1) }, 200)
    return () => clearTimeout(timer)
  }, [form.seedParent, form.seedParentId])

  useEffect(() => {
    const query = form.pollenParent.trim()
    if (form.pollenParentId) { setShowPollenSugg(false); return }
    if (query.length < 1) { setPollenSuggestions([]); setShowPollenSugg(false); return }
    const timer = setTimeout(async () => { setPollenSuggestions(await searchParents(query)); setShowPollenSugg(true); setPollenHighlight(-1) }, 200)
    return () => clearTimeout(timer)
  }, [form.pollenParent, form.pollenParentId])

  // Météo automatique du module Météo (historique quotidien de l'appli),
  // jamais interrogée en direct depuis ce formulaire.
  useEffect(() => {
    if (!form.pollinationDate) { setPollinationWeather(null); return }
    let cancelled = false
    setWeatherLoading(true)
    getWeatherForDate(form.pollinationDate).then((w) => { if (!cancelled) { setPollinationWeather(w); setWeatherLoading(false) } })
    return () => { cancelled = true }
  }, [form.pollinationDate])

  async function fetchData() {
    setLoading(true)
    const [{ data: cData }, { data: fData }, { data: sdData }, { data: pData }, { data: tData }, { data: ghData }, { data: gtData }] = await Promise.all([
      supabase.from("crosses").select("*").order("created_at", { ascending: false }),
      supabase.from("cross_fruits").select("*").order("flower_index", { ascending: true }),
      supabase.from("harvested_seeds").select("id, fruit_id, seed_name, seed_number, greenhouse_table_id").order("seed_number"),
      supabase.from("pollen_lots").select("*").order("created_at", { ascending: false }),
      supabase.from("treatments").select("*").order("applied_at", { ascending: false }),
      supabase.from("greenhouses").select("id,name").order("name"),
      supabase.from("greenhouse_tables").select("id,greenhouse_id,name").order("name"),
    ])
    if (cData) setCrosses(cData as Cross[])
    if (fData) setFruits(fData as CrossFruit[])
    if (sdData) setSeeds(sdData as HarvestedSeed[])
    if (pData) setPollenLots(pData as PollenLot[])
    if (tData) setTreatments(tData as Treatment[])
    if (ghData) setGreenhouses(ghData)
    if (gtData) setTables(gtData)
    setLoading(false)
  }

  function resetForm() {
    setForm({
      seedParent: "", seedParentId: "", pollenParent: "", pollenParentId: "",
      pollinationDate: new Date().toISOString().split("T")[0],
      pollinatedFlowersCount: "", pollenType: "frais", pollenLotId: "", freshAntherQuality: "", freshDehiscence: "",
      pistilChecklist: [],
    })
  }

  async function createLot() {
    if (!form.seedParent.trim() && !form.pollenParent.trim()) return
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) { alert("Vous devez être connecté pour enregistrer un croisement."); return }

    const seedVal = form.seedParent.trim() || "Inconnu"
    const pollenVal = form.pollenParent.trim() || "Inconnu"
    const key = pairKey(seedVal, pollenVal)
    const base = generateBaseSyllable(seedVal, pollenVal)

    const existingLots = crosses.filter((c) => pairKey(c.seed_parent ?? "", c.pollen_parent ?? "") === key)
    const nextLotIndex = existingLots.length
    const lot = lotLetter(nextLotIndex)
    const code = generateLotCode(base, nextLotIndex)

    const climateData: Record<string, unknown> = pollinationWeather
      ? { temperature: pollinationWeather.temperature, humidity: pollinationWeather.humidity, uv_index: pollinationWeather.uv_index, location: pollinationWeather.location, source: pollinationWeather.source, date: pollinationWeather.date }
      : {}

    const flowerCount = form.pollinatedFlowersCount.trim() ? Math.max(1, Number.parseInt(form.pollinatedFlowersCount, 10) || 0) : null

    const payload: Record<string, any> = {
      user_id: authData.user.id,
      code,
      seed_parent: seedVal,
      pollen_parent: pollenVal,
      pollination_date: fromDateInput(form.pollinationDate),
      remarks: "",
      base_syllable: base,
      lot_letter: lot,
      climate_data: climateData,
      status: "En cours",
      flower_count: flowerCount,
      pollen_type: form.pollenType,
      pollen_lot_id: form.pollenType === "conservé" ? form.pollenLotId || null : null,
      // Pollen frais : observation du jour (qualité des anthères, déhiscence),
      // les mêmes cases que le module Pollen, hors champs de conservation.
      pollen_quality: form.pollenType === "frais"
        ? { anther_quality: form.freshAntherQuality || null, dehiscence: form.freshDehiscence || null }
        : {},
      pistil_checklist: form.pistilChecklist,
    }

    const { data: createdLot, error } = await supabase.from("crosses").insert(payload).select("*").single()
    if (error) {
      const details = [error.message, error.details, error.hint].filter(Boolean).join(" — ")
      alert(`Erreur lors de la création du lot : ${details || "échec de l'insertion"}`)
      return
    }

    if (createdLot && flowerCount) {
      await createFruitsForLot(createdLot as Cross, flowerCount)
    }

    const missingParents = [
      !form.seedParentId && form.seedParent.trim() ? { name: seedVal, role: "seed" as const, label: "porte-graine" } : null,
      !form.pollenParentId && form.pollenParent.trim() ? { name: pollenVal, role: "pollen" as const, label: "pollen" } : null,
    ].filter(Boolean) as Array<{ name: string; role: "seed" | "pollen"; label: string }>

    if (createdLot && missingParents.length > 0) {
      await supabase.from("parent_alerts").insert(
        missingParents.map((parent) => ({
          parent_name: parent.name,
          parent_role: parent.role,
          cross_id: createdLot.id,
          message: `Ajouter le parent ${parent.label} « ${parent.name} » au catalogue.`,
        })),
      )
    }

    resetForm()
    setCreating(false)
    setAddingLotFor(null)
    setFocusedKey(key)
    fetchData()
  }

  async function createFruitsForLot(lot: Cross, count: number) {
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) return
    const lotIndex = lotIndexFromLetter(lot.lot_letter)
    const rows = Array.from({ length: count }, (_, index) => ({
      user_id: authData.user.id,
      cross_id: lot.id,
      fruit_name: generateFruitCode(lot.base_syllable ?? lot.code, lotIndex, index),
      flower_index: index + 1,
      status: "suivi",
      climate_data: lot.climate_data ?? {},
    }))
    const { error } = await supabase.from("cross_fruits").insert(rows)
    if (error) alert(`Erreur lors de la génération des fruits : ${error.message}`)
  }

  async function validateFlowerCount(lot: Cross, count: number) {
    if (!count || count < 1) return
    const { error } = await supabase.from("crosses").update({ flower_count: count }).eq("id", lot.id)
    if (error) { alert(`Erreur : ${error.message}`); return }
    await createFruitsForLot({ ...lot, flower_count: count }, count)
    fetchData()
  }

  async function patchLot(lot: Cross, changes: Partial<Cross>) {
    setCrosses((prev) => prev.map((c) => (c.id === lot.id ? { ...c, ...changes } : c)))
    const { error } = await supabase.from("crosses").update(changes).eq("id", lot.id)
    if (error) { alert(`Erreur : ${error.message}`); fetchData() }
  }

  async function deleteLot(id: string) {
    if (!confirm("Supprimer ce lot et tout son suivi (fruits, graines) ?")) return
    await supabase.from("crosses").delete().eq("id", id)
    fetchData()
  }

  async function harvestFruit(fruit: CrossFruit, values: {
    seedCount: number; harvestDate: string; fruitCalibre: string; maturation: string; seedExtraction: string
    greenhouseId: string; tableId: string
  }) {
    const { error } = await supabase.from("cross_fruits").update({
      status: values.seedCount > 0 ? "récolté" : "vide",
      seed_count: values.seedCount,
      harvest_date: fromDateInput(values.harvestDate),
      harvest_year: values.harvestDate ? new Date(values.harvestDate).getFullYear() : new Date().getFullYear(),
      fruit_calibre: values.fruitCalibre || null,
      maturation: values.maturation || null,
      seed_extraction: values.seedExtraction || null,
      greenhouse_id: values.greenhouseId || null,
      greenhouse_table_id: values.tableId || null,
      failure_causes: [],
    }).eq("id", fruit.id)
    if (error) { alert(`Erreur lors de l'enregistrement de la récolte : ${error.message}`); return }
    fetchData()
  }

  async function abortFruit(fruit: CrossFruit, causes: string[]) {
    const { error } = await supabase.from("cross_fruits").update({
      status: "avorté",
      seed_count: 0,
      failure_causes: causes,
    }).eq("id", fruit.id)
    if (error) { alert(`Erreur : ${error.message}`); return }
    fetchData()
  }

  // Ajoute une observation de nouaison (indépendante de la récolte) au
  // suivi phénologique du fruit, étalé sur 4 à 5 mois.
  async function addPhenologyObservation(fruit: CrossFruit, obs: PhenologyObservation) {
    const current = fruit.checklist?.observations ?? []
    const next = { ...(fruit.checklist ?? {}), observations: [...current, obs] }
    setFruits((prev) => prev.map((f) => (f.id === fruit.id ? { ...f, checklist: next } : f)))
    const { error } = await supabase.from("cross_fruits").update({ checklist: next }).eq("id", fruit.id)
    if (error) { alert(`Erreur : ${error.message}`); fetchData() }
  }

  const treatmentsByCross = useMemo(() => {
    const m = new Map<string, Treatment[]>()
    treatments.forEach((t) => { const arr = m.get(t.cross_id) ?? []; arr.push(t); m.set(t.cross_id, arr) })
    return m
  }, [treatments])

  const fruitsByLot = useMemo(() => {
    const m = new Map<string, CrossFruit[]>()
    fruits.forEach((f) => { const arr = m.get(f.cross_id) ?? []; arr.push(f); m.set(f.cross_id, arr) })
    return m
  }, [fruits])

  const seedsByFruit = useMemo(() => {
    const m = new Map<string, HarvestedSeed[]>()
    seeds.forEach((s) => { const arr = m.get(s.fruit_id) ?? []; arr.push(s); m.set(s.fruit_id, arr) })
    return m
  }, [seeds])

  const couples = useMemo(() => {
    const m = new Map<string, { seedParent: string; pollenParent: string; baseSyllable: string; lots: Cross[] }>()
    for (const c of crosses) {
      const key = pairKey(c.seed_parent ?? "", c.pollen_parent ?? "")
      if (!m.has(key)) m.set(key, { seedParent: c.seed_parent ?? "?", pollenParent: c.pollen_parent ?? "?", baseSyllable: c.base_syllable ?? generateBaseSyllable(c.seed_parent ?? "", c.pollen_parent ?? ""), lots: [] })
      m.get(key)!.lots.push(c)
    }
    for (const couple of m.values()) couple.lots.sort((a, b) => (a.lot_letter ?? "").localeCompare(b.lot_letter ?? ""))
    return Array.from(m.entries()).sort((a, b) => {
      const aDate = a[1].lots[0]?.created_at ?? ""
      const bDate = b[1].lots[0]?.created_at ?? ""
      return bDate.localeCompare(aDate)
    })
  }, [crosses])

  const focusedCouple = focusedKey ? couples.find(([key]) => key === focusedKey) : null

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Flower2 className="size-8 animate-pulse text-primary" /></div>
  }

  return (
    <div className="flex flex-col gap-5">
      {focusedCouple ? null : <SectionHeading title="Croisements" description="Couple de parents, lots de pollinisation, suivi des fruits et récolte des graines." />}

      {focusedCouple ? null : (
        <div className="flex gap-2">
          <button onClick={() => setActiveTab("crosses")} className={activeTab === "crosses" ? "flex items-center gap-1.5 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary" : "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"}>
            <Flower2 className="size-4" /> Croisements
          </button>
          <button onClick={() => setActiveTab("pollen")} className={activeTab === "pollen" ? "flex items-center gap-1.5 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary" : "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"}>
            <FlaskConical className="size-4" /> Module Pollen
          </button>
        </div>
      )}

      {activeTab === "crosses" ? (
        focusedCouple ? (
          <CoupleFocusView
            coupleKey={focusedCouple[0]}
            couple={focusedCouple[1]}
            focusedLot={focusedLot}
            setFocusedLot={setFocusedLot}
            fruitsByLot={fruitsByLot}
            seedsByFruit={seedsByFruit}
            treatmentsByCross={treatmentsByCross}
            greenhouses={greenhouses}
            tables={tables}
            creatingLot={creating}
            lotForm={form}
            setLotForm={setForm}
            pollenLots={pollenLots}
            pollinationWeather={pollinationWeather}
            weatherLoading={weatherLoading}
            onBack={() => { setFocusedKey(null); setFocusedLot(null); setCreating(false) }}
            onStartAddLot={() => {
              setAddingLotFor({ seedParent: focusedCouple[1].seedParent, pollenParent: focusedCouple[1].pollenParent })
              setForm((f) => ({ ...f, seedParent: focusedCouple[1].seedParent, pollenParent: focusedCouple[1].pollenParent, seedParentId: "", pollenParentId: "", pollinatedFlowersCount: "" }))
              setCreating(true)
            }}
            onCancelAddLot={() => { setCreating(false); setAddingLotFor(null) }}
            onSubmitLot={createLot}
            onPatchLot={patchLot}
            onDeleteLot={deleteLot}
            onValidateFlowerCount={validateFlowerCount}
            onHarvestFruit={harvestFruit}
            onAbortFruit={abortFruit}
            onAddPhenologyObservation={addPhenologyObservation}
          />
        ) : (
          <>
            <div className="flex justify-end">
              <Button onClick={() => { setAddingLotFor(null); resetForm(); setCreating((v) => !v) }} className="gap-1.5">
                <Plus className="size-4" /> Nouveau croisement
              </Button>
            </div>

            {creating && !addingLotFor ? (
              <LotForm
                form={form} setForm={setForm} lockParents={false}
                seedSuggestions={seedSuggestions} pollenSuggestions={pollenSuggestions}
                showSeedSugg={showSeedSugg} showPollenSugg={showPollenSugg}
                setShowSeedSugg={setShowSeedSugg} setShowPollenSugg={setShowPollenSugg}
                seedHighlight={seedHighlight} setSeedHighlight={setSeedHighlight}
                pollenHighlight={pollenHighlight} setPollenHighlight={setPollenHighlight}
                pollenLots={pollenLots} pollinationWeather={pollinationWeather} weatherLoading={weatherLoading}
                onCancel={() => setCreating(false)}
                onSubmit={createLot}
              />
            ) : null}

            {creating ? null : couples.length === 0 ? (
              <EmptyState icon={<Flower2 className="size-8" />} title="Aucun croisement" description="Commencez par enregistrer un croisement entre deux rosiers parents." />
            ) : (
              <div className="grid gap-2">
                {couples.map(([key, couple]) => (
                  <button
                    key={key}
                    onClick={() => setFocusedKey(key)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Flower2 className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{couple.seedParent} <span className="text-muted-foreground">×</span> {couple.pollenParent}</p>
                      <p className="text-xs text-muted-foreground">{couple.lots.length} lot{couple.lots.length > 1 ? "s" : ""}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )
      ) : (
        <PollenPanel pollenLots={pollenLots} onRefresh={fetchData} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Champs à édition inline : un clic affiche un input, Entrée valide.
// ---------------------------------------------------------------------------

function InlineText({ value, placeholder, onSave, textClassName }: { value: string; placeholder: string; onSave: (v: string) => void; textClassName?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft !== value) onSave(draft) }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.currentTarget.blur() }
          if (e.key === "Escape") { setDraft(value); setEditing(false) }
        }}
        className="h-7 px-2 text-xs"
      />
    )
  }
  return (
    <span onClick={(e) => { e.stopPropagation(); setEditing(true) }} className={textClassName ?? "cursor-text text-xs text-foreground hover:underline decoration-dotted"}>
      {value || <span className="italic text-muted-foreground">{placeholder}</span>}
    </span>
  )
}

function InlineDate({ value, onSave, textClassName }: { value: string | null; onSave: (v: string) => void; textClassName?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(toDateInput(value))
  useEffect(() => { if (!editing) setDraft(toDateInput(value)) }, [value, editing])

  if (editing) {
    return (
      <Input
        autoFocus type="date"
        value={draft}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onSave(fromDateInput(draft)) }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(false) }}
        className="h-7 w-36 px-2 text-xs"
      />
    )
  }
  return (
    <span onClick={(e) => { e.stopPropagation(); setEditing(true) }} className={textClassName ?? "cursor-text text-xs text-foreground hover:underline decoration-dotted"}>
      {formatDate(value)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Formulaire de lot — allégé : en ajout de lot sur un couple existant, les
// champs de parents disparaissent complètement (plus de doublon de saisie).
// ---------------------------------------------------------------------------

function LotForm({
  form, setForm, lockParents, seedSuggestions, pollenSuggestions, showSeedSugg, showPollenSugg,
  setShowSeedSugg, setShowPollenSugg, seedHighlight, setSeedHighlight, pollenHighlight, setPollenHighlight,
  pollenLots, pollinationWeather, weatherLoading, onCancel, onSubmit,
}: {
  form: any; setForm: (updater: any) => void; lockParents: boolean
  seedSuggestions: VarietySuggestion[]; pollenSuggestions: VarietySuggestion[]
  showSeedSugg: boolean; showPollenSugg: boolean
  setShowSeedSugg: (v: boolean) => void; setShowPollenSugg: (v: boolean) => void
  seedHighlight: number; setSeedHighlight: (v: number) => void
  pollenHighlight: number; setPollenHighlight: (v: number) => void
  pollenLots: PollenLot[]; pollinationWeather: DailyWeather | null; weatherLoading: boolean
  onCancel: () => void; onSubmit: () => void
}) {
  function selectSeed(s: VarietySuggestion) {
    setForm({ ...form, seedParent: s.name, seedParentId: s.id })
    setShowSeedSugg(false)
  }
  function selectPollen(s: VarietySuggestion) {
    setForm({ ...form, pollenParent: s.name, pollenParentId: s.id })
    setShowPollenSugg(false)
  }

  return (
    <Card className="p-4">
      <button onClick={onCancel} className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Retour
      </button>
      {lockParents ? (
        <p className="mb-3 text-sm font-medium text-foreground">{form.seedParent} <span className="text-muted-foreground">×</span> {form.pollenParent}</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!lockParents ? (
          <>
            <div className="relative">
              <Field label="Parent porte-graine (♀)" hint="Flèche bas puis Entrée, ou cliquez sur une suggestion">
                <Input
                  value={form.seedParent}
                  onChange={(e) => setForm({ ...form, seedParent: e.target.value, seedParentId: "" })}
                  onFocus={() => { if (seedSuggestions.length > 0) setShowSeedSugg(true) }}
                  onKeyDown={(e) => {
                    if (!showSeedSugg || seedSuggestions.length === 0) return
                    if (e.key === "ArrowDown") { e.preventDefault(); setSeedHighlight(Math.min(seedHighlight + 1, seedSuggestions.length - 1)) }
                    else if (e.key === "ArrowUp") { e.preventDefault(); setSeedHighlight(Math.max(seedHighlight - 1, 0)) }
                    else if (e.key === "Enter" && seedHighlight >= 0) { e.preventDefault(); selectSeed(seedSuggestions[seedHighlight]) }
                    else if (e.key === "Escape") { setShowSeedSugg(false) }
                  }}
                  placeholder="Ex: Grande Amore..."
                />
              </Field>
              {showSeedSugg && seedSuggestions.length > 0 ? (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                  {seedSuggestions.map((s, i) => (
                    <div
                      key={s.id}
                      className={i === seedHighlight ? "cursor-pointer bg-accent px-3 py-2 text-xs text-accent-foreground" : "cursor-pointer px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground"}
                      onMouseEnter={() => setSeedHighlight(i)}
                      onClick={() => selectSeed(s)}
                    >
                      <span className="font-medium text-foreground">{s.name}</span>
                      {s.commercial_name && s.commercial_name !== s.name ? <span className="text-muted-foreground"> ({s.commercial_name})</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="relative">
              <Field label="Parent pollen (♂)" hint="Flèche bas puis Entrée, ou cliquez sur une suggestion">
                <Input
                  value={form.pollenParent}
                  onChange={(e) => setForm({ ...form, pollenParent: e.target.value, pollenParentId: "" })}
                  onFocus={() => { if (pollenSuggestions.length > 0) setShowPollenSugg(true) }}
                  onKeyDown={(e) => {
                    if (!showPollenSugg || pollenSuggestions.length === 0) return
                    if (e.key === "ArrowDown") { e.preventDefault(); setPollenHighlight(Math.min(pollenHighlight + 1, pollenSuggestions.length - 1)) }
                    else if (e.key === "ArrowUp") { e.preventDefault(); setPollenHighlight(Math.max(pollenHighlight - 1, 0)) }
                    else if (e.key === "Enter" && pollenHighlight >= 0) { e.preventDefault(); selectPollen(pollenSuggestions[pollenHighlight]) }
                    else if (e.key === "Escape") { setShowPollenSugg(false) }
                  }}
                  placeholder="Ex: Black Baccara..."
                />
              </Field>
              {showPollenSugg && pollenSuggestions.length > 0 ? (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                  {pollenSuggestions.map((s, i) => (
                    <div
                      key={s.id}
                      className={i === pollenHighlight ? "cursor-pointer bg-accent px-3 py-2 text-xs text-accent-foreground" : "cursor-pointer px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground"}
                      onMouseEnter={() => setPollenHighlight(i)}
                      onClick={() => selectPollen(s)}
                    >
                      <span className="font-medium text-foreground">{s.name}</span>
                      {s.commercial_name && s.commercial_name !== s.name ? <span className="text-muted-foreground"> ({s.commercial_name})</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        <Field label="Date de pollinisation"><Input type="date" value={form.pollinationDate} onChange={(e) => setForm({ ...form, pollinationDate: e.target.value })} /></Field>
        <Field label="Nombre de fleurs pollinisées" hint="Laissez vide pour le renseigner plus tard"><Input type="number" min={1} value={form.pollinatedFlowersCount} onChange={(e) => setForm({ ...form, pollinatedFlowersCount: e.target.value })} /></Field>

        <Field label="Type de pollen">
          <Select value={form.pollenType} onChange={(e) => setForm({ ...form, pollenType: e.target.value })}>
            <option value="frais">Pollen frais (utilisation directe)</option>
            <option value="conservé">Lot de pollen conservé (stock)</option>
          </Select>
        </Field>
        {form.pollenType === "conservé" ? (
          <Field label="Lot de pollen conservé">
            <Select value={form.pollenLotId} onChange={(e) => setForm({ ...form, pollenLotId: e.target.value })}>
              <option value="">-- Sélectionner --</option>
              {pollenLots.map((pl) => <option key={pl.id} value={pl.id}>Lot #{pl.lot_number} ({pl.rose_name ?? "Inconnu"})</option>)}
            </Select>
          </Field>
        ) : null}
      </div>

      {form.pollenType === "conservé" && form.pollenLotId ? (() => {
        const usedLot = pollenLots.find((pl) => pl.id === form.pollenLotId)
        return usedLot ? (
          <div className="mt-3 rounded-md bg-primary/5 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lot utilisé</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge tone="primary">Lot #{usedLot.lot_number} — {usedLot.rose_name ?? "Inconnu"}</Badge>
              {usedLot.anther_quality ? <Badge tone="neutral">Anthères: {ANTHER_QUALITY_LABELS[usedLot.anther_quality] ?? usedLot.anther_quality}</Badge> : null}
              {usedLot.dehiscence ? <Badge tone="neutral">Déhiscence: {DEHISCENCE_LABELS[usedLot.dehiscence] ?? usedLot.dehiscence}</Badge> : null}
              {usedLot.conservation_mode ? <Badge tone="neutral">Stockage: {CONSERVATION_LABELS[usedLot.conservation_mode] ?? usedLot.conservation_mode}</Badge> : null}
            </div>
          </div>
        ) : null
      })() : null}

      {form.pollenType === "frais" ? (
        <div className="mt-3 grid gap-3 rounded-md bg-primary/5 p-3 sm:grid-cols-2">
          <p className="col-span-full -mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Observation du pollen frais du jour (obligatoire — mêmes cases que le module Pollen, hors stockage)
          </p>
          <Field label="Qualité des anthères">
            <Select value={form.freshAntherQuality} onChange={(e) => setForm({ ...form, freshAntherQuality: e.target.value })}>
              <option value="">-- Sélectionner --</option>
              {Object.entries(ANTHER_QUALITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Déhiscence">
            <Select value={form.freshDehiscence} onChange={(e) => setForm({ ...form, freshDehiscence: e.target.value })}>
              <option value="">-- Sélectionner --</option>
              {Object.entries(DEHISCENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">État du pistil observé</p>
        {PISTIL_GROUPS.map((group) => (
          <div key={group.title} className="grid gap-1">
            <p className="text-xs font-medium text-foreground">{group.title}</p>
            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(group.options).map(([k, v]) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={form.pistilChecklist.includes(k)} onChange={(e) => setForm({ ...form, pistilChecklist: e.target.checked ? [...form.pistilChecklist, k] : form.pistilChecklist.filter((c: string) => c !== k) })} /> {v}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-md bg-muted/20 p-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Météo du jour (module Météo, automatique)</p>
        {weatherLoading ? (
          <p className="text-xs text-muted-foreground">Récupération de la météo…</p>
        ) : pollinationWeather ? (
          <div className="flex flex-wrap gap-1.5">
            {pollinationWeather.temperature != null ? <Badge tone="neutral">{Math.round(pollinationWeather.temperature)}°C</Badge> : null}
            {pollinationWeather.humidity != null ? <Badge tone="neutral">{Math.round(pollinationWeather.humidity)}% hum.</Badge> : null}
            {pollinationWeather.uv_index != null ? <Badge tone="neutral">UV {Math.round(pollinationWeather.uv_index)}</Badge> : <Badge tone="neutral">UV indisponible pour cette date ancienne</Badge>}
            <Badge tone="neutral">{pollinationWeather.source === "live" ? "Temps réel" : "Historique"}</Badge>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Météo indisponible pour cette date (localisation manquante dans le profil).</p>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Annuler</Button>
        <Button onClick={onSubmit} disabled={!lockParents && !form.seedParent.trim() && !form.pollenParent.trim()}>
          {lockParents ? "Créer le lot" : "Créer"}
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Vue Focus d'un couple : occupe tout l'écran, retour explicite.
// ---------------------------------------------------------------------------

function CoupleFocusView({
  coupleKey, couple, focusedLot, setFocusedLot, fruitsByLot, seedsByFruit, treatmentsByCross,
  greenhouses, tables, creatingLot, lotForm, setLotForm, pollenLots, pollinationWeather, weatherLoading,
  onBack, onStartAddLot, onCancelAddLot, onSubmitLot, onPatchLot, onDeleteLot,
  onValidateFlowerCount, onHarvestFruit, onAbortFruit, onAddPhenologyObservation,
}: any) {
  const allTreatments: Treatment[] = couple.lots.flatMap((lot: Cross) => treatmentsByCross.get(lot.id) ?? [])
  const focusedLotData = focusedLot ? couple.lots.find((l: Cross) => l.id === focusedLot) : null

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Retour aux croisements
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl text-foreground">{couple.seedParent} <span className="text-muted-foreground">×</span> {couple.pollenParent}</h2>
          <p className="text-xs text-muted-foreground">{couple.lots.length} lot{couple.lots.length > 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" onClick={onStartAddLot} className="size-8 rounded-full p-0" title="Ajouter un lot">
          <Plus className="size-4" />
        </Button>
      </div>

      {allTreatments.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted/20 p-2">
          <Shield className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Suivi sanitaire (Parcelle) :</span>
          {allTreatments.slice(0, 6).map((t) => (
            <Badge key={t.id} tone="neutral">{t.product_name}{t.treatment_type ? ` · ${TREATMENT_TYPE_LABELS[t.treatment_type] ?? t.treatment_type}` : ""}</Badge>
          ))}
        </div>
      ) : null}

      {creatingLot ? (
        <LotForm
          form={lotForm} setForm={setLotForm} lockParents
          seedSuggestions={[]} pollenSuggestions={[]} showSeedSugg={false} showPollenSugg={false}
          setShowSeedSugg={() => {}} setShowPollenSugg={() => {}}
          seedHighlight={-1} setSeedHighlight={() => {}} pollenHighlight={-1} setPollenHighlight={() => {}}
          pollenLots={pollenLots} pollinationWeather={pollinationWeather} weatherLoading={weatherLoading}
          onCancel={onCancelAddLot} onSubmit={onSubmitLot}
        />
      ) : null}

      {creatingLot ? null : focusedLotData ? (
        <LotFocusView
          lot={focusedLotData}
          fruits={fruitsByLot.get(focusedLotData.id) ?? []}
          seedsByFruit={seedsByFruit}
          treatments={treatmentsByCross.get(focusedLotData.id) ?? []}
          greenhouses={greenhouses}
          tables={tables}
          pollenLots={pollenLots}
          onBack={() => setFocusedLot(null)}
          onPatch={(changes: Partial<Cross>) => onPatchLot(focusedLotData, changes)}
          onDelete={() => { onDeleteLot(focusedLotData.id); setFocusedLot(null) }}
          onValidateFlowerCount={(count: number) => onValidateFlowerCount(focusedLotData, count)}
          onHarvestFruit={onHarvestFruit}
          onAbortFruit={onAbortFruit}
          onAddPhenologyObservation={onAddPhenologyObservation}
        />
      ) : (
        <div className="grid gap-2">
          {couple.lots.map((lot: Cross) => {
            const lotFruits = fruitsByLot.get(lot.id) ?? []
            return (
              <button key={lot.id} onClick={() => setFocusedLot(lot.id)} className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:border-primary/40 hover:bg-muted/30">
                <span className="font-serif text-lg text-primary">{lot.lot_letter}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Pollinisé le {formatDate(lot.pollination_date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {lot.location ? `${lot.location} · ` : ""}
                    {lot.flower_count == null ? "Fleurs pollinisées non renseignées" : `${lot.flower_count} fruit${lot.flower_count > 1 ? "s" : ""}`}
                  </p>
                </div>
                {lot.pollen_type === "conservé" ? <Badge tone="primary">Pollen conservé</Badge> : <Badge tone="neutral">Pollen frais</Badge>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LotFocusView({
  lot, fruits, seedsByFruit, treatments, greenhouses, tables, pollenLots,
  onBack, onPatch, onDelete, onValidateFlowerCount, onHarvestFruit, onAbortFruit, onAddPhenologyObservation,
}: any) {
  const [flowerInput, setFlowerInput] = useState("")
  const [focusedFruit, setFocusedFruit] = useState<CrossFruit | null>(null)
  const climate = (lot.climate_data ?? {}) as Record<string, any>
  const pollenQuality = (lot.pollen_quality ?? {}) as Record<string, any>
  const usedPollenLot = lot.pollen_type === "conservé" ? (pollenLots as PollenLot[])?.find((pl) => pl.id === lot.pollen_lot_id) : null

  if (focusedFruit) {
    const current = fruits.find((f: CrossFruit) => f.id === focusedFruit.id) ?? focusedFruit
    return (
      <FruitFocusView
        fruit={current}
        seeds={seedsByFruit.get(current.id) ?? []}
        greenhouses={greenhouses}
        tables={tables}
        onBack={() => setFocusedFruit(null)}
        onHarvest={(values: any) => onHarvestFruit(current, values)}
        onAbort={(causes: string[]) => onAbortFruit(current, causes)}
        onAddObservation={(obs: PhenologyObservation) => onAddPhenologyObservation(current, obs)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Retour au croisement
      </button>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-serif text-lg text-primary">Lot {lot.lot_letter}</span>
          <span className="text-xs text-muted-foreground">Pollinisé le</span>
          <InlineDate value={lot.pollination_date} onSave={(v) => onPatch({ pollination_date: v })} />
          <Badge tone={lot.pollen_type === "conservé" ? "primary" : "neutral"}>{lot.pollen_type === "conservé" ? "Pollen conservé" : "Pollen frais"}</Badge>
          <button onClick={onDelete} className="ml-auto text-muted-foreground hover:text-destructive" title="Supprimer le lot">
            <Trash2 className="size-4" />
          </button>
        </div>
        <div className="mt-2">
          <InlineText value={lot.remarks ?? ""} placeholder="Remarques..." onSave={(v) => onPatch({ remarks: v })} textClassName="cursor-text text-xs text-muted-foreground italic hover:underline decoration-dotted" />
        </div>
        {Object.keys(climate).length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {climate.temperature != null ? <Badge tone="neutral">{Math.round(climate.temperature)}°C</Badge> : null}
            {climate.humidity != null ? <Badge tone="neutral">{Math.round(climate.humidity)}% hum.</Badge> : null}
            {climate.uv_index != null ? <Badge tone="neutral">UV {Math.round(climate.uv_index)}</Badge> : null}
            {climate.source ? <Badge tone="neutral">{climate.source === "live" ? "Météo temps réel" : "Météo historique"}</Badge> : null}
          </div>
        ) : null}
        {lot.pistil_checklist?.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {lot.pistil_checklist.map((k: string) => <Badge key={k} tone="neutral">{PISTIL_OPTIONS[k] ?? k}</Badge>)}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <FlaskConical className="size-3.5 text-muted-foreground" />
          {lot.pollen_type === "conservé" ? (
            usedPollenLot ? (
              <>
                <Badge tone="primary">Lot #{usedPollenLot.lot_number} — {usedPollenLot.rose_name ?? "Inconnu"}</Badge>
                {usedPollenLot.anther_quality ? <Badge tone="neutral">Anthères: {ANTHER_QUALITY_LABELS[usedPollenLot.anther_quality] ?? usedPollenLot.anther_quality}</Badge> : null}
                {usedPollenLot.dehiscence ? <Badge tone="neutral">Déhiscence: {DEHISCENCE_LABELS[usedPollenLot.dehiscence] ?? usedPollenLot.dehiscence}</Badge> : null}
              </>
            ) : <Badge tone="neutral">Pollen conservé (lot non retrouvé)</Badge>
          ) : (
            <>
              <Badge tone="neutral">Pollen frais</Badge>
              {pollenQuality.anther_quality ? <Badge tone="neutral">Anthères: {ANTHER_QUALITY_LABELS[pollenQuality.anther_quality] ?? pollenQuality.anther_quality}</Badge> : null}
              {pollenQuality.dehiscence ? <Badge tone="neutral">Déhiscence: {DEHISCENCE_LABELS[pollenQuality.dehiscence] ?? pollenQuality.dehiscence}</Badge> : null}
            </>
          )}
        </div>
      </Card>

      <Card className="p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Rappel des suivis Parcelle (sanitaire, phyto, amendements)</p>
        {treatments.length > 0 || lot.location || lot.containers ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {lot.location ? <Badge tone="neutral">{lot.location}</Badge> : null}
            {lot.containers ? <Badge tone="neutral">{lot.containers}</Badge> : null}
            {treatments.map((t: Treatment) => <Badge key={t.id} tone="neutral"><Shield className="size-3" /> {t.product_name}</Badge>)}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Aucun suivi Parcelle enregistré pour ces parents pour l'instant.</p>
        )}
      </Card>

      {lot.flower_count == null ? (
        <Card className="flex flex-wrap items-end gap-3 p-3">
          <Field label="Fleurs pollinisées" hint="Génère aussitôt les fruits a, b, c...">
            <Input className="w-36" type="number" min={1} value={flowerInput} onChange={(e) => setFlowerInput(e.target.value)} />
          </Field>
          <Button size="sm" disabled={!flowerInput.trim()} onClick={() => onValidateFlowerCount(Math.max(1, Number.parseInt(flowerInput, 10) || 0))}>
            Valider le nombre de fleurs
          </Button>
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {fruits.map((fruit: CrossFruit) => {
            const fruitSeeds = seedsByFruit.get(fruit.id) ?? []
            const tone = fruit.status === "récolté" ? "success" : fruit.status === "avorté" ? "danger" : fruit.status === "vide" ? "warning" : "neutral"
            const observationsCount = fruit.checklist?.observations?.length ?? 0
            return (
              <button key={fruit.id} onClick={() => setFocusedFruit(fruit)} className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 text-left hover:border-primary/40 hover:bg-muted/30">
                <div className="flex items-center gap-2">
                  <Cherry className="size-4 text-primary" />
                  <span className="text-sm font-medium">{fruit.fruit_name}</span>
                  <Badge tone={tone} className="ml-auto">{fruit.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fruit.status === "récolté" ? `${fruitSeeds.length} graine${fruitSeeds.length > 1 ? "s" : ""}` : observationsCount > 0 ? `${observationsCount} observation${observationsCount > 1 ? "s" : ""} de nouaison` : "Aucune observation pour l'instant"}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Carte Fruit (focus) : grille d'observation de la nouaison en premier ;
// la récolte finale et l'échec restent accessibles, mais ne sont jamais
// affichés en premier ni forcés.
// ---------------------------------------------------------------------------

function FruitFocusView({ fruit, seeds, greenhouses, tables, onBack, onHarvest, onAbort, onAddObservation }: any) {
  const [obsDate, setObsDate] = useState(new Date().toISOString().split("T")[0])
  const [obsStages, setObsStages] = useState<string[]>([])
  const [obsCalibre, setObsCalibre] = useState("")
  const [obsCouleur, setObsCouleur] = useState("")
  const [obsComportement, setObsComportement] = useState<string[]>([])
  const [obsRemarque, setObsRemarque] = useState("")
  const [closingVoie, setClosingVoie] = useState<"A" | "B" | null>(null)

  const [seedCount, setSeedCount] = useState("0")
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split("T")[0])
  const [fruitCalibre, setFruitCalibre] = useState("")
  const [maturation, setMaturation] = useState("")
  const [seedExtraction, setSeedExtraction] = useState("")
  const [greenhouseId, setGreenhouseId] = useState("")
  const [tableId, setTableId] = useState("")
  const [causes, setCauses] = useState<string[]>([])

  const closed = fruit.status !== "suivi"
  const observations: PhenologyObservation[] = fruit.checklist?.observations ?? []

  function submitObservation() {
    if (obsStages.length === 0 && !obsCalibre && !obsCouleur && obsComportement.length === 0 && !obsRemarque) return
    onAddObservation({ date: obsDate, stages: obsStages, calibre: obsCalibre, couleur: obsCouleur, comportement: obsComportement, remarque: obsRemarque })
    setObsStages([]); setObsCalibre(""); setObsCouleur(""); setObsComportement([]); setObsRemarque("")
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Retour au lot
      </button>

      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Cherry className="size-4" /></span>
        <div>
          <p className="font-serif text-lg text-foreground">{fruit.fruit_name}</p>
          <p className="text-xs text-muted-foreground">Suivi de nouaison sur 4 à 5 mois, indépendant de la récolte</p>
        </div>
      </div>

      {closed ? (
        <Card className="flex flex-wrap gap-1.5 p-3">
          {fruit.status === "récolté" || fruit.status === "vide" ? (
            <>
              <Badge tone={fruit.status === "récolté" ? "success" : "warning"}>{fruit.status === "récolté" ? "Récolté" : "Vide (0 graine)"}</Badge>
              {fruit.harvest_date ? <Badge tone="neutral">Le {formatDate(fruit.harvest_date)}</Badge> : null}
              {fruit.fruit_calibre ? <Badge tone="neutral">{FRUIT_CALIBRE_LABELS[fruit.fruit_calibre] ?? fruit.fruit_calibre}</Badge> : null}
              {fruit.maturation ? <Badge tone="neutral">{MATURATION_LABELS[fruit.maturation] ?? fruit.maturation}</Badge> : null}
              {fruit.seed_extraction ? <Badge tone="neutral">{SEED_EXTRACTION_LABELS[fruit.seed_extraction] ?? fruit.seed_extraction}</Badge> : null}
            </>
          ) : (
            <>
              <Badge tone="danger">Avorté</Badge>
              {fruit.failure_causes.map((c: string) => <Badge key={c} tone="danger">{AVORTEMENT_LABELS[c] ?? c}</Badge>)}
            </>
          )}
        </Card>
      ) : null}

      {seeds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {seeds.map((s: HarvestedSeed) => <Badge key={s.id} tone="neutral"><Sprout className="size-3" /> {s.seed_name}{s.greenhouse_table_id ? " · en serre" : " · à semer"}</Badge>)}
        </div>
      ) : null}

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Suivi de nouaison</h3>
        </div>

        {observations.length > 0 ? (
          <div className="mb-4 grid gap-2">
            {observations.map((obs, i) => (
              <div key={i} className="rounded-md border border-border bg-muted/10 p-2 text-xs">
                <p className="font-medium text-foreground">{formatDate(obs.date)}</p>
                {obs.stages.length > 0 ? <p className="text-muted-foreground">{obs.stages.join(", ")}</p> : null}
                {obs.calibre || obs.couleur ? <p className="text-muted-foreground">{[obs.calibre, obs.couleur].filter(Boolean).join(" · ")}</p> : null}
                {obs.comportement?.length > 0 ? <p className="text-muted-foreground">{obs.comportement.join(", ")}</p> : null}
                {obs.remarque ? <p className="italic text-muted-foreground">{obs.remarque}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-4 text-xs text-muted-foreground">Aucune observation enregistrée pour l'instant.</p>
        )}

        {!closed ? (
          <div className="grid gap-3 border-t border-border pt-3">
            <Field label="Date de l'observation"><Input type="date" value={obsDate} onChange={(e) => setObsDate(e.target.value)} className="w-44" /></Field>

            <div className="grid gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stades phénologiques observés</p>
              <div className="flex flex-wrap gap-3 text-xs">
                {PHENOLOGY_STAGES.map((stage) => (
                  <label key={stage} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={obsStages.includes(stage)} onChange={(e) => setObsStages((cur) => e.target.checked ? [...cur, stage] : cur.filter((s) => s !== stage))} /> {stage}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Calibre</p>
              <div className="flex flex-wrap gap-3 text-xs">
                {CALIBRE_STAGE_OPTIONS.map((opt) => (
                  <label key={opt} className="flex items-center gap-1.5">
                    <input type="radio" name="obs-calibre" checked={obsCalibre === opt} onChange={() => setObsCalibre(opt)} /> {opt}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Couleur</p>
              <div className="flex flex-wrap gap-3 text-xs">
                {COLOR_OPTIONS.map((opt) => (
                  <label key={opt} className="flex items-center gap-1.5">
                    <input type="radio" name="obs-couleur" checked={obsCouleur === opt} onChange={() => setObsCouleur(opt)} /> {opt}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Comportement du fruit</p>
              <div className="flex flex-wrap gap-3 text-xs">
                {BEHAVIOR_OPTIONS.map((opt) => (
                  <label key={opt} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={obsComportement.includes(opt)} onChange={(e) => setObsComportement((cur) => e.target.checked ? [...cur, opt] : cur.filter((c) => c !== opt))} /> {opt}
                  </label>
                ))}
              </div>
            </div>

            <Field label="Remarque" hint="Seul champ en texte libre de tout le suivi"><Textarea value={obsRemarque} onChange={(e) => setObsRemarque(e.target.value)} placeholder="Remarque optionnelle..." /></Field>

            <div className="flex justify-end">
              <Button size="sm" onClick={submitObservation}>Ajouter au suivi</Button>
            </div>
          </div>
        ) : null}
      </Card>

      {!closed ? (
        closingVoie === null ? (
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setClosingVoie("B")}><Ban className="size-3.5" /> Déclarer un échec</Button>
            <Button size="sm" className="gap-1.5" onClick={() => setClosingVoie("A")}><Cherry className="size-3.5" /> Enregistrer la récolte finale</Button>
          </div>
        ) : closingVoie === "A" ? (
          <Card className="grid gap-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Date de récolte"><Input type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} /></Field>
              <Field label="Nombre de graines"><Input type="number" min={0} value={seedCount} onChange={(e) => setSeedCount(e.target.value)} /></Field>
              <Field label="Calibre du fruit">
                <Select value={fruitCalibre} onChange={(e) => setFruitCalibre(e.target.value)}>
                  <option value="">--</option>
                  {Object.entries(FRUIT_CALIBRE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label="Maturation">
                <Select value={maturation} onChange={(e) => setMaturation(e.target.value)}>
                  <option value="">--</option>
                  {Object.entries(MATURATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(SEED_EXTRACTION_LABELS).map(([k, v]) => (
                <label key={k} className="flex items-center gap-1.5"><input type="radio" name="extraction" checked={seedExtraction === k} onChange={() => setSeedExtraction(k)} /> {v}</label>
              ))}
            </div>
            {Number.parseInt(seedCount, 10) > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Serre">
                  <Select value={greenhouseId} onChange={(e) => { setGreenhouseId(e.target.value); setTableId("") }}>
                    <option value="">--</option>
                    {greenhouses.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </Select>
                </Field>
                <Field label="Table">
                  <Select value={tableId} onChange={(e) => setTableId(e.target.value)}>
                    <option value="">--</option>
                    {tables.filter((t: any) => t.greenhouse_id === greenhouseId).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </Field>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setClosingVoie(null)}>Annuler</Button>
              <Button size="sm" onClick={() => onHarvest({ seedCount: Math.max(0, Number.parseInt(seedCount, 10) || 0), harvestDate, fruitCalibre, maturation, seedExtraction, greenhouseId, tableId })}>Enregistrer</Button>
            </div>
          </Card>
        ) : (
          <Card className="grid gap-3 p-4">
            <div className="grid gap-1.5 sm:grid-cols-2">
              {Object.entries(AVORTEMENT_LABELS).map(([k, v]) => (
                <label key={k} className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={causes.includes(k)} onChange={(e) => setCauses((cur) => e.target.checked ? [...cur, k] : cur.filter((c) => c !== k))} /> {v}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setClosingVoie(null)}>Annuler</Button>
              <Button size="sm" variant="destructive" onClick={() => onAbort(causes)}>Enregistrer l'échec</Button>
            </div>
          </Card>
        )
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Module Pollen (inchangé)
// ---------------------------------------------------------------------------

function PollenPanel({ pollenLots, onRefresh }: { pollenLots: PollenLot[]; onRefresh: () => void }) {
  const [creating, setCreating] = useState(false)
  const [lotNumber, setLotNumber] = useState("")
  const [roseName, setRoseName] = useState("")
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split("T")[0])
  const [antherQuality, setAntherQuality] = useState("")
  const [dehiscence, setDehiscence] = useState("")
  const [conservationMode, setConservationMode] = useState("")
  const [remarks, setRemarks] = useState("")
  const [harvestWeather, setHarvestWeather] = useState<DailyWeather | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)

  useEffect(() => {
    if (!creating || !harvestDate) return
    let cancelled = false
    setWeatherLoading(true)
    getWeatherForDate(harvestDate).then((w) => { if (!cancelled) { setHarvestWeather(w); setWeatherLoading(false) } })
    return () => { cancelled = true }
  }, [creating, harvestDate])

  async function createPollenLot() {
    if (!lotNumber.trim()) return
    const { error } = await supabase.from("pollen_lots").insert({
      lot_number: lotNumber.trim(),
      rose_name: roseName.trim() || null,
      harvest_date: harvestDate || null,
      weather_data: harvestWeather ?? {},
      anther_quality: antherQuality || null,
      dehiscence: dehiscence || null,
      conservation_mode: conservationMode || null,
      remarks: remarks.trim(),
    })
    if (error) { alert(`Erreur : ${error.message}`); return }
    setLotNumber(""); setRoseName(""); setHarvestDate(new Date().toISOString().split("T")[0]); setAntherQuality(""); setDehiscence(""); setConservationMode(""); setRemarks("")
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
        <Button onClick={() => setCreating((v) => !v)} className="gap-1.5"><Plus className="size-4" /> Nouveau lot de pollen</Button>
      </div>

      {creating ? (
        <Card className="p-4">
          <button onClick={() => setCreating(false)} className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Retour
          </button>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Numéro de lot"><Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder="Ex: P-2026-01" /></Field>
            <Field label="Nom du rosier (donneur)"><Input value={roseName} onChange={(e) => setRoseName(e.target.value)} placeholder="Ex: Graham Thomas" /></Field>
            <Field label="Date de récolte"><Input type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} /></Field>
            <Field label="Qualité des anthères">
              <Select value={antherQuality} onChange={(e) => setAntherQuality(e.target.value)}>
                <option value="">--</option>
                {Object.entries(ANTHER_QUALITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Déhiscence">
              <Select value={dehiscence} onChange={(e) => setDehiscence(e.target.value)}>
                <option value="">--</option>
                {Object.entries(DEHISCENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Mode de conservation">
              <Select value={conservationMode} onChange={(e) => setConservationMode(e.target.value)}>
                <option value="">--</option>
                {Object.entries(CONSERVATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Remarques"><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
          </div>
          <div className="mt-3 rounded-md bg-muted/20 p-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Météo à la récolte (module Météo, automatique)</p>
            {weatherLoading ? (
              <p className="text-xs text-muted-foreground">Récupération de la météo…</p>
            ) : harvestWeather ? (
              <div className="flex flex-wrap gap-1.5">
                {harvestWeather.temperature != null ? <Badge tone="neutral">{Math.round(harvestWeather.temperature)}°C</Badge> : null}
                {harvestWeather.humidity != null ? <Badge tone="neutral">{Math.round(harvestWeather.humidity)}% hum.</Badge> : null}
                {harvestWeather.uv_index != null ? <Badge tone="neutral">UV {Math.round(harvestWeather.uv_index)}</Badge> : <Badge tone="neutral">UV indisponible pour cette date ancienne</Badge>}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Météo indisponible pour cette date.</p>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>Annuler</Button>
            <Button onClick={createPollenLot} disabled={!lotNumber.trim()}>Enregistrer le lot</Button>
          </div>
        </Card>
      ) : null}

      {pollenLots.length === 0 ? (
        <EmptyState icon={<FlaskConical className="size-8" />} title="Aucun lot de pollen enregistré" description="Créez des lots de pollen pour pouvoir les associer ultérieurement dans vos croisements." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pollenLots.map((pl) => (
            <Card key={pl.id} className="flex flex-col justify-between gap-3 p-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-serif text-base font-semibold text-primary">Lot #{pl.lot_number}</span>
                  <button onClick={() => deletePollenLot(pl.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
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
                {pl.harvest_date ? `Récolté le ${formatDate(pl.harvest_date)}` : `Créé le ${formatDate(pl.created_at)}`}
                {pl.weather_data?.temperature != null ? ` · ${Math.round(pl.weather_data.temperature)}°C` : ""}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
