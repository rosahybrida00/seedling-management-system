"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, Warehouse, Table2, Sprout, ArrowLeft, Trash2, CalendarClock, ClipboardList, MapPin,
  Zap, Check, Circle, Flower2, Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/layout/app-shell"
import { supabase } from "@/lib/supabase-client"
import { Card, Badge, Field, Input, SectionHeading, EmptyState, Select, Textarea } from "@/components/breeding/ui"
import { formatDate } from "@/components/breeding/format"
import {
  DISEASE_PRESSURE_LABELS, PEST_LABELS, CLIMATE_BEHAVIOR_LABELS, FIELD_TREATMENT_LABELS,
  TREATMENT_REACTION_LABELS, SOIL_TYPE_LABELS, PROGRAM_TYPE_LABELS, PROGRAM_RESULT_LABELS,
} from "@/lib/domain/fieldLabels"
import { getWeatherForDate, type DailyWeather } from "@/lib/services/weatherService"

// ---------------------------------------------------------------------------
// Module Serres & Parcelles : tableau de bord des zones (Serre ou Parcelle),
// avec un statut de couleur (vert/orange/rouge), un agenda réel par plant
// (fini le compteur de passages rigide — chaque intervention est une ligne
// datée), une Watchlist, un bouton Flash pour l'action terrain en un tap,
// et le pont vers Croisement ("Utiliser comme parent"). Distinct de /serre,
// qui évalue les semis issus des graines (phénotype, sélection).
// ---------------------------------------------------------------------------

interface Greenhouse { id: string; name: string }
interface GreenhouseTable { id: string; greenhouse_id: string; name: string }
interface Parcelle { id: string; name: string; soil_type: string[]; location: string | null }
interface VarietyOption { id: string; name: string; source: "catalogue" | "semis" }

interface FieldPlanting {
  id: string
  variety_id: string | null
  seedling_id: string | null
  greenhouse_table_id: string | null
  parcelle_id: string | null
  planted_at: string
  notes: string
}

interface FieldObservation {
  id: string
  planting_id: string
  observation_date: string
  intervention_date: string | null
  disease_pressure: string[]
  pests: string[]
  climate_behavior: string[]
  treatment_applied: string[]
  treatment_reaction: string[]
  remarque: string
}

interface FieldProgram {
  id: string
  planting_id: string | null
  greenhouse_id: string | null
  parcelle_id: string | null
  program_type: "curatif" | "preventif" | "fertilisation"
  product_name: string
  start_date: string
  result: string | null
  notes: string
}

interface FieldIntervention {
  id: string
  program_id: string
  due_date: string | null
  done: boolean
  done_date: string | null
  result: string | null
  notes: string
}

type Zone = { kind: "serre"; greenhouse: Greenhouse } | { kind: "parcelle"; parcelle: Parcelle }
type ZoneStatus = "vert" | "orange" | "rouge"

export default function ParcellePage() {
  return (
    <AppShell>
      <ParcelleContent />
    </AppShell>
  )
}

function ParcelleContent() {
  const [greenhouses, setGreenhouses] = useState<Greenhouse[]>([])
  const [tables, setTables] = useState<GreenhouseTable[]>([])
  const [parcelles, setParcelles] = useState<Parcelle[]>([])
  const [plantings, setPlantings] = useState<FieldPlanting[]>([])
  const [observations, setObservations] = useState<FieldObservation[]>([])
  const [programs, setPrograms] = useState<FieldProgram[]>([])
  const [interventions, setInterventions] = useState<FieldIntervention[]>([])
  const [varieties, setVarieties] = useState<Map<string, string>>(new Map())
  const [seedlings, setSeedlings] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState<"dashboard" | "zone" | "plant" | "manage">("dashboard")
  const [watchlistOnly, setWatchlistOnly] = useState(false)
  const [zoneKey, setZoneKey] = useState<string | null>(null)
  const [plantingId, setPlantingId] = useState<string | null>(null)
  const [flashOpen, setFlashOpen] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [gh, gt, pc, fp, ob, pr, iv, vr, sl] = await Promise.all([
      supabase.from("greenhouses").select("id,name").order("name"),
      supabase.from("greenhouse_tables").select("id,greenhouse_id,name").order("name"),
      supabase.from("parcelles").select("id,name,soil_type,location").order("name"),
      supabase.from("field_plantings").select("*").order("created_at", { ascending: false }),
      supabase.from("field_observations").select("*").order("observation_date", { ascending: false }),
      supabase.from("field_programs").select("*").order("start_date", { ascending: false }),
      supabase.from("field_interventions").select("*").order("due_date", { ascending: true }),
      supabase.from("varieties").select("id,name,commercial_name"),
      supabase.from("seedlings").select("id,code,seedling_code"),
    ])
    if (gh.data) setGreenhouses(gh.data)
    if (gt.data) setTables(gt.data)
    if (pc.data) setParcelles(pc.data as Parcelle[])
    if (fp.data) setPlantings(fp.data as FieldPlanting[])
    if (ob.data) setObservations(ob.data as FieldObservation[])
    if (pr.data) setPrograms(pr.data as FieldProgram[])
    if (iv.data) setInterventions(iv.data as FieldIntervention[])
    if (vr.data) setVarieties(new Map(vr.data.map((v: any) => [v.id, v.commercial_name || v.name])))
    if (sl.data) setSeedlings(new Map(sl.data.map((s: any) => [s.id, s.seedling_code || s.code])))
    setLoading(false)
  }

  const tableMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables])
  const programsByPlanting = useMemo(() => { const m = new Map<string, FieldProgram[]>(); programs.forEach((p) => { if (p.planting_id) { const a = m.get(p.planting_id) ?? []; a.push(p); m.set(p.planting_id, a) } }); return m }, [programs])
  const interventionsByProgram = useMemo(() => { const m = new Map<string, FieldIntervention[]>(); interventions.forEach((i) => { const a = m.get(i.program_id) ?? []; a.push(i); m.set(i.program_id, a) }); return m }, [interventions])
  const observationsByPlanting = useMemo(() => { const m = new Map<string, FieldObservation[]>(); observations.forEach((o) => { const a = m.get(o.planting_id) ?? []; a.push(o); m.set(o.planting_id, a) }); return m }, [observations])

  function plantingLabel(p: FieldPlanting): string {
    return p.variety_id ? (varieties.get(p.variety_id) ?? "Variété inconnue") : (seedlings.get(p.seedling_id ?? "") ?? "Semis inconnu")
  }
  function plantingsOfZone(zone: Zone): FieldPlanting[] {
    if (zone.kind === "serre") {
      const tableIds = new Set(tables.filter((t) => t.greenhouse_id === zone.greenhouse.id).map((t) => t.id))
      return plantings.filter((p) => p.greenhouse_table_id && tableIds.has(p.greenhouse_table_id))
    }
    return plantings.filter((p) => p.parcelle_id === zone.parcelle.id)
  }

  // Statut de couleur : rouge si une observation récente signale maladie/
  // ravageur pour un plant de la zone ; orange s'il y a une intervention
  // prévue en retard (due_date <= aujourd'hui, non faite) ; vert sinon.
  function zoneStatus(zone: Zone): ZoneStatus {
    const zonePlantings = plantingsOfZone(zone)
    const plantingIds = new Set(zonePlantings.map((p) => p.id))
    const hasAlert = observations.some((o) => plantingIds.has(o.planting_id) && (o.disease_pressure.length > 0 || o.pests.length > 0))
    if (hasAlert) return "rouge"
    const today = new Date().toISOString().split("T")[0]
    const relevantPrograms = programs.filter((p) => p.parcelle_id === (zone.kind === "parcelle" ? zone.parcelle.id : "__none__") || p.greenhouse_id === (zone.kind === "serre" ? zone.greenhouse.id : "__none__") || (p.planting_id && plantingIds.has(p.planting_id)))
    const hasDue = relevantPrograms.some((p) => (interventionsByProgram.get(p.id) ?? []).some((iv) => !iv.done && iv.due_date && iv.due_date <= today))
    return hasDue ? "orange" : "vert"
  }

  const zones: Array<{ key: string; zone: Zone }> = useMemo(() => [
    ...greenhouses.map((g) => ({ key: `serre:${g.id}`, zone: { kind: "serre" as const, greenhouse: g } })),
    ...parcelles.map((p) => ({ key: `parcelle:${p.id}`, zone: { kind: "parcelle" as const, parcelle: p } })),
  ], [greenhouses, parcelles])

  const visibleZones = watchlistOnly ? zones.filter((z) => zoneStatus(z.zone) !== "vert") : zones
  const currentZone = zoneKey ? zones.find((z) => z.key === zoneKey)?.zone ?? null : null
  const currentPlanting = plantingId ? plantings.find((p) => p.id === plantingId) ?? null : null

  if (loading) return <div className="flex items-center justify-center py-20"><Sprout className="size-8 animate-pulse text-primary" /></div>

  return (
    <div className="relative flex flex-col gap-5 pb-16">
      {view === "dashboard" ? (
        <>
          <SectionHeading
            title="Serres & Parcelles"
            description="Vue d'ensemble de vos zones : vert = tout va bien, orange = rappel en attente, rouge = alerte sanitaire."
            action={
              <div className="flex gap-2">
                <Button variant={watchlistOnly ? "default" : "outline"} size="sm" onClick={() => setWatchlistOnly((v) => !v)}>Watchlist</Button>
                <Button variant="outline" size="sm" onClick={() => setView("manage")} className="gap-1.5"><Settings className="size-3.5" /> Gérer</Button>
              </div>
            }
          />
          {visibleZones.length === 0 ? (
            <EmptyState icon={<MapPin className="size-8" />} title={watchlistOnly ? "Rien à surveiller" : "Aucune zone"} description={watchlistOnly ? "Aucune zone n'a d'alerte ou de rappel en attente." : "Créez une serre ou une parcelle dans « Gérer »."} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleZones.map(({ key, zone }) => {
                const status = zoneStatus(zone)
                const count = plantingsOfZone(zone).length
                const name = zone.kind === "serre" ? zone.greenhouse.name : zone.parcelle.name
                return (
                  <button key={key} onClick={() => { setZoneKey(key); setView("zone") }} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left hover:border-primary/40 hover:bg-muted/30">
                    <span className={status === "rouge" ? "size-3 rounded-full bg-destructive" : status === "orange" ? "size-3 rounded-full bg-chart-3" : "size-3 rounded-full bg-primary"} />
                    {zone.kind === "serre" ? <Warehouse className="size-5 text-muted-foreground" /> : <MapPin className="size-5 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{name}</p>
                      <p className="text-xs text-muted-foreground">{count} plant{count > 1 ? "s" : ""}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </>
      ) : null}

      {view === "zone" && currentZone ? (
        <ZoneView
          zone={currentZone} plantings={plantingsOfZone(currentZone)} greenhouses={greenhouses} tables={tables} parcelles={parcelles}
          plantingLabel={plantingLabel} programsByPlanting={programsByPlanting} interventionsByProgram={interventionsByProgram}
          observationsByPlanting={observationsByPlanting}
          onBack={() => { setView("dashboard"); setZoneKey(null) }}
          onOpenPlant={(id) => { setPlantingId(id); setView("plant") }}
          onRefresh={fetchData}
        />
      ) : null}

      {view === "plant" && currentPlanting ? (
        <PlantView
          planting={currentPlanting} label={plantingLabel(currentPlanting)}
          observations={observationsByPlanting.get(currentPlanting.id) ?? []}
          programs={programsByPlanting.get(currentPlanting.id) ?? []}
          interventionsByProgram={interventionsByProgram}
          onBack={() => { setView("zone"); setPlantingId(null) }}
          onRefresh={fetchData}
        />
      ) : null}

      {view === "manage" ? (
        <ManageView greenhouses={greenhouses} tables={tables} parcelles={parcelles} onBack={() => setView("dashboard")} onRefresh={fetchData} />
      ) : null}

      {view === "dashboard" ? (
        <>
          <button onClick={() => setFlashOpen(true)} className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90">
            <Zap className="size-6" />
          </button>
          {flashOpen ? (
            <FlashSheet
              plantings={plantings} plantingLabel={plantingLabel} interventions={interventions} programs={programs}
              onClose={() => setFlashOpen(false)} onRefresh={fetchData}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bouton Flash : valider une intervention en un tap, ou ajouter une
// observation rapide, sans naviguer dans les menus.
// ---------------------------------------------------------------------------

function FlashSheet({ plantings, plantingLabel, interventions, programs, onClose, onRefresh }: {
  plantings: FieldPlanting[]; plantingLabel: (p: FieldPlanting) => string
  interventions: FieldIntervention[]; programs: FieldProgram[]
  onClose: () => void; onRefresh: () => void
}) {
  const [mode, setMode] = useState<"choix" | "intervention" | "observation">("choix")
  const [plantingId, setPlantingId] = useState("")
  const [disease, setDisease] = useState<string[]>([])
  const [pests, setPests] = useState<string[]>([])

  const programById = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs])
  const due = interventions.filter((i) => !i.done)

  async function markDone(intervention: FieldIntervention) {
    await supabase.from("field_interventions").update({ done: true, done_date: new Date().toISOString().split("T")[0] }).eq("id", intervention.id)
    onRefresh()
  }

  async function submitObservation() {
    if (!plantingId) return
    await supabase.from("field_observations").insert({
      planting_id: plantingId, observation_date: new Date().toISOString().split("T")[0],
      disease_pressure: disease, pests, climate_behavior: [], treatment_applied: [], treatment_reaction: [], remarque: "",
    })
    onRefresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 sm:items-center" onClick={onClose}>
      <Card className="w-full max-w-md p-4 sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        {mode === "choix" ? (
          <div className="grid gap-2">
            <p className="mb-1 text-sm font-medium text-foreground">Action rapide</p>
            <Button className="justify-start gap-2" onClick={() => setMode("intervention")}><Check className="size-4" /> Valider une intervention</Button>
            <Button variant="outline" className="justify-start gap-2" onClick={() => setMode("observation")}><Circle className="size-4" /> Observation rapide</Button>
            <Button variant="ghost" onClick={onClose}>Fermer</Button>
          </div>
        ) : mode === "intervention" ? (
          <div className="grid gap-2">
            <button onClick={() => setMode("choix")} className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Retour</button>
            {due.length === 0 ? <p className="text-sm text-muted-foreground">Aucune intervention en attente.</p> : due.map((iv) => {
              const prog = programById.get(iv.program_id)
              return (
                <div key={iv.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                  <span className="flex-1">{prog?.product_name ?? "Intervention"} {iv.due_date ? `· ${formatDate(iv.due_date)}` : ""}</span>
                  <Button size="sm" onClick={() => markDone(iv)} className="gap-1"><Check className="size-3.5" /> Fait</Button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid gap-2">
            <button onClick={() => setMode("choix")} className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Retour</button>
            <Field label="Plant">
              <Select value={plantingId} onChange={(e) => setPlantingId(e.target.value)}>
                <option value="">-- Sélectionner --</option>
                {plantings.map((p) => <option key={p.id} value={p.id}>{plantingLabel(p)}</option>)}
              </Select>
            </Field>
            <div className="grid gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Maladie</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(DISEASE_PRESSURE_LABELS).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={disease.includes(k)} onChange={(e) => setDisease((c) => e.target.checked ? [...c, k] : c.filter((x) => x !== k))} /> {v}</label>
                ))}
              </div>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ravageurs</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(PEST_LABELS).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={pests.includes(k)} onChange={(e) => setPests((c) => e.target.checked ? [...c, k] : c.filter((x) => x !== k))} /> {v}</label>
                ))}
              </div>
            </div>
            <Button size="sm" onClick={submitObservation} disabled={!plantingId}>Enregistrer</Button>
          </div>
        )}
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vue d'une zone : ses plants, agenda groupé, ajout de plantation.
// ---------------------------------------------------------------------------

function ZoneView({ zone, plantings, greenhouses, tables, parcelles, plantingLabel, programsByPlanting, interventionsByProgram, observationsByPlanting, onBack, onOpenPlant, onRefresh }: {
  zone: Zone; plantings: FieldPlanting[]; greenhouses: Greenhouse[]; tables: GreenhouseTable[]; parcelles: Parcelle[]
  plantingLabel: (p: FieldPlanting) => string
  programsByPlanting: Map<string, FieldProgram[]>; interventionsByProgram: Map<string, FieldIntervention[]>
  observationsByPlanting: Map<string, FieldObservation[]>
  onBack: () => void; onOpenPlant: (id: string) => void; onRefresh: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<VarietyOption | null>(null)
  const [suggestions, setSuggestions] = useState<VarietyOption[]>([])
  const [showSugg, setShowSugg] = useState(false)
  const [tableId, setTableId] = useState("")

  const name = zone.kind === "serre" ? zone.greenhouse.name : zone.parcelle.name
  const zoneTables = zone.kind === "serre" ? tables.filter((t) => t.greenhouse_id === zone.greenhouse.id) : []

  useEffect(() => {
    if (selected) { setShowSugg(false); return }
    const q = query.trim()
    if (q.length < 1) { setSuggestions([]); setShowSugg(false); return }
    const timer = setTimeout(async () => {
      const escaped = q.replace(/[%,()]/g, " ")
      const [{ data: v }, { data: s }] = await Promise.all([
        supabase.from("varieties").select("id,name,commercial_name").or(`name.ilike.%${escaped}%,commercial_name.ilike.%${escaped}%`).limit(6),
        supabase.from("seedlings").select("id,code,seedling_code").ilike("code", `%${escaped}%`).limit(6),
      ])
      setSuggestions([
        ...(v ?? []).map((x: any) => ({ id: x.id, name: x.commercial_name || x.name, source: "catalogue" as const })),
        ...(s ?? []).map((x: any) => ({ id: x.id, name: x.seedling_code || x.code, source: "semis" as const })),
      ])
      setShowSugg(true)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, selected])

  async function createPlanting() {
    if (!selected) return
    if (zone.kind === "serre" && !tableId) return
    await supabase.from("field_plantings").insert({
      variety_id: selected.source === "catalogue" ? selected.id : null,
      seedling_id: selected.source === "semis" ? selected.id : null,
      greenhouse_table_id: zone.kind === "serre" ? tableId : null,
      parcelle_id: zone.kind === "parcelle" ? zone.parcelle.id : null,
    })
    setQuery(""); setSelected(null); setTableId(""); setCreating(false)
    onRefresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Retour</button>
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-foreground">{name}</h2>
        <Button size="sm" onClick={() => setCreating((v) => !v)} className="gap-1.5"><Plus className="size-4" /> Plant</Button>
      </div>

      {creating ? (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <Field label="Variété (Catalogue ou Semis)">
                <Input value={selected ? selected.name : query} onChange={(e) => { setQuery(e.target.value); setSelected(null) }} placeholder="Tapez pour rechercher..." />
              </Field>
              {showSugg && suggestions.length > 0 ? (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                  {suggestions.map((s) => (
                    <div key={s.id} className="cursor-pointer px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground" onClick={() => { setSelected(s); setShowSugg(false) }}>
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-primary/70">{s.source}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            {zone.kind === "serre" ? (
              <Field label="Table">
                <Select value={tableId} onChange={(e) => setTableId(e.target.value)}>
                  <option value="">-- Sélectionner --</option>
                  {zoneTables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
            ) : null}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Annuler</Button>
            <Button size="sm" onClick={createPlanting} disabled={!selected || (zone.kind === "serre" && !tableId)}>Créer</Button>
          </div>
        </Card>
      ) : null}

      {plantings.length === 0 ? (
        <EmptyState icon={<Sprout className="size-8" />} title="Aucun plant" description="Ajoutez une variété du Catalogue ou un Semis à cette zone." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {plantings.map((p) => {
            const lastObs = (observationsByPlanting.get(p.id) ?? [])[0]
            const alert = lastObs && (lastObs.disease_pressure.length > 0 || lastObs.pests.length > 0)
            return (
              <button key={p.id} onClick={() => onOpenPlant(p.id)} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-left hover:border-primary/40 hover:bg-muted/30">
                <div className="flex items-center gap-2">
                  {alert ? <span className="size-2 rounded-full bg-destructive" /> : null}
                  <Sprout className="size-4 text-primary" />
                  <span className="text-sm font-medium">{plantingLabel(p)}</span>
                </div>
                <p className="text-xs text-muted-foreground">Planté le {formatDate(p.planted_at)}</p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Carte du plant : 3 onglets — Historique, Agenda individuel, Croisement.
// ---------------------------------------------------------------------------

function PlantView({ planting, label, observations, programs, interventionsByProgram, onBack, onRefresh }: {
  planting: FieldPlanting; label: string; observations: FieldObservation[]; programs: FieldProgram[]
  interventionsByProgram: Map<string, FieldIntervention[]>
  onBack: () => void; onRefresh: () => void
}) {
  const [tab, setTab] = useState<"historique" | "agenda" | "croisement">("historique")

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Retour</button>
      <h2 className="font-serif text-xl text-foreground">{label}</h2>

      <div className="flex gap-2">
        <button onClick={() => setTab("historique")} className={tab === "historique" ? "flex items-center gap-1.5 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary" : "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"}><CalendarClock className="size-4" /> Historique</button>
        <button onClick={() => setTab("agenda")} className={tab === "agenda" ? "flex items-center gap-1.5 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary" : "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"}><ClipboardList className="size-4" /> Agenda</button>
        <button onClick={() => setTab("croisement")} className={tab === "croisement" ? "flex items-center gap-1.5 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary" : "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"}><Flower2 className="size-4" /> Croisement</button>
      </div>

      {tab === "historique" ? <ObservationsSection plantingId={planting.id} observations={observations} onRefresh={onRefresh} /> : null}
      {tab === "agenda" ? <AgendaSection plantingId={planting.id} programs={programs} interventionsByProgram={interventionsByProgram} onRefresh={onRefresh} /> : null}
      {tab === "croisement" ? <CroisementBridge planting={planting} label={label} /> : null}
    </div>
  )
}

function CroisementBridge({ planting, label }: { planting: FieldPlanting; label: string }) {
  const router = useRouter()
  function useAsParent(role: "seed" | "pollen") {
    sessionStorage.setItem("pendingCrossParent", JSON.stringify({
      role, name: label,
      id: planting.variety_id ?? planting.seedling_id,
      source: planting.variety_id ? "catalogue" : "semis",
    }))
    router.push("/croisement")
  }
  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-sm text-muted-foreground">Utiliser <strong className="text-foreground">{label}</strong> comme parent d'un nouveau croisement. La création se remplit automatiquement sur la page Croisement.</p>
      <div className="flex gap-2">
        <Button onClick={() => useAsParent("seed")} className="gap-1.5">Utiliser comme Mère (porte-graine)</Button>
        <Button variant="outline" onClick={() => useAsParent("pollen")} className="gap-1.5">Utiliser comme Père (pollen)</Button>
      </div>
    </Card>
  )
}

function AgendaSection({ plantingId, programs, interventionsByProgram, onRefresh }: {
  plantingId: string; programs: FieldProgram[]; interventionsByProgram: Map<string, FieldIntervention[]>; onRefresh: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [programType, setProgramType] = useState<"curatif" | "preventif" | "fertilisation">("preventif")
  const [productName, setProductName] = useState("")
  const [firstDueDate, setFirstDueDate] = useState(new Date().toISOString().split("T")[0])

  async function createProgram() {
    if (!productName.trim()) return
    const { data, error } = await supabase.from("field_programs").insert({
      planting_id: plantingId, program_type: programType, product_name: productName.trim(), start_date: firstDueDate,
    }).select("id").single()
    if (error) { alert(`Erreur : ${error.message}`); return }
    await supabase.from("field_interventions").insert({ program_id: data.id, due_date: firstDueDate })
    setProductName(""); setCreating(false)
    onRefresh()
  }

  async function addNextIntervention(programId: string, dueDate: string) {
    if (!dueDate) return
    await supabase.from("field_interventions").insert({ program_id: programId, due_date: dueDate })
    onRefresh()
  }

  async function markDone(intervention: FieldIntervention, result: string) {
    await supabase.from("field_interventions").update({ done: true, done_date: new Date().toISOString().split("T")[0], result: result || null }).eq("id", intervention.id)
    onRefresh()
  }

  const rows = programs.flatMap((p) => (interventionsByProgram.get(p.id) ?? []).map((iv) => ({ program: p, iv })))
    .sort((a, b) => (b.iv.due_date ?? "").localeCompare(a.iv.due_date ?? ""))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating((v) => !v)} className="gap-1.5"><Plus className="size-4" /> Nouveau programme</Button>
      </div>

      {creating ? (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type"><Select value={programType} onChange={(e) => setProgramType(e.target.value as any)}>{Object.entries(PROGRAM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Produit"><Input value={productName} onChange={(e) => setProductName(e.target.value)} /></Field>
            <Field label="Prochaine intervention"><Input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} /></Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Annuler</Button>
            <Button size="sm" onClick={createProgram} disabled={!productName.trim()}>Créer</Button>
          </div>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-8" />} title="Aucun programme" description="Créez un programme pour planifier fertilisation ou traitements sur ce plant." />
      ) : (
        <div className="grid gap-2">
          {rows.map(({ program, iv }) => (
            <AgendaRow key={iv.id} program={program} intervention={iv} onDone={(result) => markDone(iv, result)} onScheduleNext={(date) => addNextIntervention(program.id, date)} />
          ))}
        </div>
      )}
    </div>
  )
}

function AgendaRow({ program, intervention, onDone, onScheduleNext }: {
  program: FieldProgram; intervention: FieldIntervention; onDone: (result: string) => void; onScheduleNext: (date: string) => void
}) {
  const [choosingResult, setChoosingResult] = useState(false)
  const [nextDate, setNextDate] = useState("")
  const overdue = !intervention.done && intervention.due_date != null && intervention.due_date <= new Date().toISOString().split("T")[0]

  return (
    <Card className="flex flex-wrap items-center gap-2 p-3 text-sm">
      <Badge tone="primary">{PROGRAM_TYPE_LABELS[program.program_type]}</Badge>
      <span className="font-medium text-foreground">{program.product_name}</span>
      <span className="text-xs text-muted-foreground">{intervention.due_date ? formatDate(intervention.due_date) : "sans date"}</span>
      {intervention.done ? (
        <Badge tone={intervention.result === "amelioration" ? "success" : intervention.result === "echec" ? "danger" : "warning"} className="ml-auto">
          Fait{intervention.result ? ` · ${PROGRAM_RESULT_LABELS[intervention.result]}` : ""}
        </Badge>
      ) : choosingResult ? (
        <div className="ml-auto flex flex-wrap gap-1.5">
          {Object.entries(PROGRAM_RESULT_LABELS).map(([k, v]) => <Button key={k} size="sm" variant="outline" onClick={() => onDone(k)}>{v}</Button>)}
        </div>
      ) : (
        <div className="ml-auto flex items-center gap-1.5">
          {overdue ? <Badge tone="danger">En retard</Badge> : null}
          <Button size="sm" onClick={() => setChoosingResult(true)} className="gap-1"><Check className="size-3.5" /> Fait</Button>
        </div>
      )}
      {intervention.done ? (
        <div className="flex w-full items-center gap-1.5 border-t border-border pt-2">
          <Input type="date" className="h-7 w-36" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          <Button size="sm" variant="ghost" onClick={() => nextDate && onScheduleNext(nextDate)} disabled={!nextDate}>Planifier la suite</Button>
        </div>
      ) : null}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Historique sanitaire & climatique (grille quotidienne à cocher).
// ---------------------------------------------------------------------------

function ObservationsSection({ plantingId, observations, onRefresh }: { plantingId: string; observations: FieldObservation[]; onRefresh: () => void }) {
  const [creating, setCreating] = useState(false)
  const [observationDate, setObservationDate] = useState(new Date().toISOString().split("T")[0])
  const [interventionDate, setInterventionDate] = useState("")
  const [disease, setDisease] = useState<string[]>([])
  const [pests, setPests] = useState<string[]>([])
  const [climate, setClimate] = useState<string[]>([])
  const [treatment, setTreatment] = useState<string[]>([])
  const [reaction, setReaction] = useState<string[]>([])
  const [remarque, setRemarque] = useState("")
  const [weather, setWeather] = useState<DailyWeather | null>(null)

  useEffect(() => { if (creating) getWeatherForDate(observationDate).then(setWeather) }, [creating, observationDate])

  function toggle(setter: (fn: (cur: string[]) => string[]) => void, key: string) {
    setter((cur) => (cur.includes(key) ? cur.filter((c) => c !== key) : [...cur, key]))
  }

  async function submit() {
    const { error } = await supabase.from("field_observations").insert({
      planting_id: plantingId, observation_date: observationDate, intervention_date: interventionDate || null,
      disease_pressure: disease, pests, climate_behavior: climate, treatment_applied: treatment, treatment_reaction: reaction, remarque,
    })
    if (error) { alert(`Erreur : ${error.message}`); return }
    setDisease([]); setPests([]); setClimate([]); setTreatment([]); setReaction([]); setRemarque(""); setInterventionDate(""); setCreating(false)
    onRefresh()
  }

  const groups = [
    { title: "Maladie / Pression sanitaire", labels: DISEASE_PRESSURE_LABELS, value: disease, set: setDisease },
    { title: "Insectes / Ravageurs", labels: PEST_LABELS, value: pests, set: setPests },
    { title: "Comportement face au climat", labels: CLIMATE_BEHAVIOR_LABELS, value: climate, set: setClimate },
    { title: "Type de traitement appliqué", labels: FIELD_TREATMENT_LABELS, value: treatment, set: setTreatment },
    { title: "Réaction face au traitement", labels: TREATMENT_REACTION_LABELS, value: reaction, set: setReaction },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setCreating((v) => !v)} className="gap-1.5"><Plus className="size-4" /> Nouvelle observation</Button></div>

      {creating ? (
        <Card className="p-4">
          <button onClick={() => setCreating(false)} className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Retour</button>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date de l'observation"><Input type="date" value={observationDate} onChange={(e) => setObservationDate(e.target.value)} /></Field>
            <Field label="Date d'intervention"><Input type="date" value={interventionDate} onChange={(e) => setInterventionDate(e.target.value)} /></Field>
          </div>
          {weather ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {weather.temperature != null ? <Badge tone="neutral">{Math.round(weather.temperature)}°C</Badge> : null}
              {weather.humidity != null ? <Badge tone="neutral">{Math.round(weather.humidity)}% hum.</Badge> : null}
              {weather.uv_index != null ? <Badge tone="neutral">UV {Math.round(weather.uv_index)}</Badge> : null}
            </div>
          ) : null}
          {groups.map((g) => (
            <div key={g.title} className="mt-3 grid gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.title}</p>
              <div className="flex flex-wrap gap-3 text-xs">
                {Object.entries(g.labels).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={g.value.includes(k)} onChange={() => toggle(g.set, k)} /> {v}</label>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-3"><Field label="Remarque"><Textarea value={remarque} onChange={(e) => setRemarque(e.target.value)} /></Field></div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Annuler</Button><Button size="sm" onClick={submit}>Enregistrer</Button></div>
        </Card>
      ) : null}

      {observations.length === 0 ? (
        <EmptyState icon={<CalendarClock className="size-8" />} title="Aucune observation" description="Enregistrez le premier relevé sanitaire/phyto de ce plant." />
      ) : (
        <div className="grid gap-2">
          {observations.map((o) => (
            <Card key={o.id} className="p-3 text-xs">
              <p className="font-medium text-foreground">{formatDate(o.observation_date)}{o.intervention_date ? ` · intervention le ${formatDate(o.intervention_date)}` : ""}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {o.disease_pressure.map((k) => <Badge key={k} tone="danger">{DISEASE_PRESSURE_LABELS[k] ?? k}</Badge>)}
                {o.pests.map((k) => <Badge key={k} tone="danger">{PEST_LABELS[k] ?? k}</Badge>)}
                {o.climate_behavior.map((k) => <Badge key={k} tone="warning">{CLIMATE_BEHAVIOR_LABELS[k] ?? k}</Badge>)}
                {o.treatment_applied.map((k) => <Badge key={k} tone="primary">{FIELD_TREATMENT_LABELS[k] ?? k}</Badge>)}
                {o.treatment_reaction.map((k) => <Badge key={k} tone="neutral">{TREATMENT_REACTION_LABELS[k] ?? k}</Badge>)}
              </div>
              {o.remarque ? <p className="mt-1 italic text-muted-foreground">{o.remarque}</p> : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gestion des emplacements (Serres/Tables, Parcelles) — CRUD de structure.
// ---------------------------------------------------------------------------

function ManageView({ greenhouses, tables, parcelles, onBack, onRefresh }: {
  greenhouses: Greenhouse[]; tables: GreenhouseTable[]; parcelles: Parcelle[]; onBack: () => void; onRefresh: () => void
}) {
  const [subTab, setSubTab] = useState<"serres" | "parcelles">("serres")
  const [newGreenhouse, setNewGreenhouse] = useState("")
  const [newTableName, setNewTableName] = useState<Record<string, string>>({})
  const [creatingParcelle, setCreatingParcelle] = useState(false)
  const [pName, setPName] = useState("")
  const [pLocation, setPLocation] = useState("")
  const [pSoil, setPSoil] = useState<string[]>([])

  async function createGreenhouse() {
    if (!newGreenhouse.trim()) return
    await supabase.from("greenhouses").insert({ name: newGreenhouse.trim() })
    setNewGreenhouse(""); onRefresh()
  }
  async function createTable(greenhouseId: string) {
    const name = (newTableName[greenhouseId] ?? "").trim()
    if (!name) return
    await supabase.from("greenhouse_tables").insert({ greenhouse_id: greenhouseId, name })
    setNewTableName((c) => ({ ...c, [greenhouseId]: "" })); onRefresh()
  }
  async function deleteGreenhouse(id: string) { if (confirm("Supprimer cette serre et ses tables ?")) { await supabase.from("greenhouses").delete().eq("id", id); onRefresh() } }
  async function deleteTable(id: string) { if (confirm("Supprimer cette table ?")) { await supabase.from("greenhouse_tables").delete().eq("id", id); onRefresh() } }
  async function createParcelle() {
    if (!pName.trim()) return
    await supabase.from("parcelles").insert({ name: pName.trim(), location: pLocation.trim() || null, soil_type: pSoil })
    setPName(""); setPLocation(""); setPSoil([]); setCreatingParcelle(false); onRefresh()
  }
  async function deleteParcelle(id: string) { if (confirm("Supprimer cette parcelle ?")) { await supabase.from("parcelles").delete().eq("id", id); onRefresh() } }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Retour au tableau de bord</button>
      <div className="flex gap-2">
        <button onClick={() => setSubTab("serres")} className={subTab === "serres" ? "flex items-center gap-1.5 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary" : "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"}><Warehouse className="size-4" /> Serres</button>
        <button onClick={() => setSubTab("parcelles")} className={subTab === "parcelles" ? "flex items-center gap-1.5 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary" : "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"}><MapPin className="size-4" /> Parcelles</button>
      </div>

      {subTab === "serres" ? (
        <div className="flex flex-col gap-3">
          <Card className="flex items-end gap-3 p-3">
            <Field label="Nouvelle serre"><Input value={newGreenhouse} onChange={(e) => setNewGreenhouse(e.target.value)} placeholder="Ex: Serre froide" /></Field>
            <Button size="sm" onClick={createGreenhouse} disabled={!newGreenhouse.trim()} className="gap-1"><Plus className="size-3.5" /> Ajouter</Button>
          </Card>
          {greenhouses.map((g) => (
            <Card key={g.id} className="p-3">
              <div className="flex items-center gap-2">
                <Warehouse className="size-4 text-primary" /><span className="text-sm font-medium">{g.name}</span>
                <button onClick={() => deleteGreenhouse(g.id)} className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tables.filter((t) => t.greenhouse_id === g.id).map((t) => (
                  <Badge key={t.id} tone="neutral"><Table2 className="size-3" /> {t.name} <button onClick={() => deleteTable(t.id)} className="ml-1 hover:text-destructive">×</button></Badge>
                ))}
              </div>
              <div className="mt-2 flex items-end gap-2">
                <Field label="Nouvelle table"><Input className="h-8 w-40" value={newTableName[g.id] ?? ""} onChange={(e) => setNewTableName((c) => ({ ...c, [g.id]: e.target.value }))} /></Field>
                <Button size="sm" variant="outline" onClick={() => createTable(g.id)}><Plus className="size-3.5" /></Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end"><Button size="sm" onClick={() => setCreatingParcelle((v) => !v)} className="gap-1.5"><Plus className="size-4" /> Nouvelle parcelle</Button></div>
          {creatingParcelle ? (
            <Card className="p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nom"><Input value={pName} onChange={(e) => setPName(e.target.value)} /></Field>
                <Field label="Localisation"><Input value={pLocation} onChange={(e) => setPLocation(e.target.value)} /></Field>
              </div>
              <div className="mt-3 grid gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type de sol</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  {Object.entries(SOIL_TYPE_LABELS).map(([k, v]) => (
                    <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={pSoil.includes(k)} onChange={(e) => setPSoil((c) => e.target.checked ? [...c, k] : c.filter((x) => x !== k))} /> {v}</label>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setCreatingParcelle(false)}>Annuler</Button><Button size="sm" onClick={createParcelle} disabled={!pName.trim()}>Créer</Button></div>
            </Card>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {parcelles.map((p) => (
              <Card key={p.id} className="p-3">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" /><span className="text-sm font-medium">{p.name}</span>
                  <button onClick={() => deleteParcelle(p.id)} className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                </div>
                {p.location ? <p className="mt-1 text-xs text-muted-foreground">{p.location}</p> : null}
                {p.soil_type?.length > 0 ? <div className="mt-1.5 flex flex-wrap gap-1">{p.soil_type.map((s) => <Badge key={s} tone="neutral">{SOIL_TYPE_LABELS[s] ?? s}</Badge>)}</div> : null}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
