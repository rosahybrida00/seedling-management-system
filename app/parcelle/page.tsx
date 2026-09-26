"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Warehouse, Table2, Sprout, ArrowLeft, Trash2, CalendarClock, ClipboardList, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/layout/app-shell"
import { supabase } from "@/lib/supabase-client"
import { Card, Badge, Field, Input, SectionHeading, EmptyState, Select, Textarea } from "@/components/breeding/ui"
import { formatDate, fromDateInput } from "@/components/breeding/format"
import {
  DISEASE_PRESSURE_LABELS, PEST_LABELS, CLIMATE_BEHAVIOR_LABELS, FIELD_TREATMENT_LABELS,
  TREATMENT_REACTION_LABELS, SOIL_TYPE_LABELS, PROGRAM_TYPE_LABELS, PROGRAM_RESULT_LABELS,
} from "@/lib/domain/fieldLabels"
import { getWeatherForDate, type DailyWeather } from "@/lib/services/weatherService"

// ---------------------------------------------------------------------------
// Module Serres & Parcelles : où sont plantées les variétés du Catalogue
// (plants mères) ou les Semis, avec leur suivi sanitaire/phyto/fertilisation
// quotidien. Distinct de /serre, qui évalue les semis issus des graines
// (phénotype, sélection). Ici : le triptyque Variété/Semis <-> Serre ou
// Parcelle <-> Date/Météo, exigé pour chaque observation et programme.
// ---------------------------------------------------------------------------

interface Greenhouse { id: string; name: string }
interface GreenhouseTable { id: string; greenhouse_id: string; name: string }
interface Parcelle { id: string; name: string; soil_type: string[]; location: string | null }
interface VarietyOption { id: string; name: string; commercial_name: string | null; source: "catalogue" | "semis" }

interface FieldPlanting {
  id: string
  variety_id: string | null
  seedling_id: string | null
  greenhouse_table_id: string | null
  parcelle_id: string | null
  planted_at: string
  removed_at: string | null
  notes: string
  // Résolus côté client pour l'affichage :
  variety_label?: string
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
  intervention_count: number
  last_intervention_date: string | null
  result: string | null
  notes: string
}

export default function ParcellePage() {
  return (
    <AppShell>
      <ParcelleContent />
    </AppShell>
  )
}

function ParcelleContent() {
  const [tab, setTab] = useState<"serres" | "parcelles" | "plantations">("plantations")
  const [greenhouses, setGreenhouses] = useState<Greenhouse[]>([])
  const [tables, setTables] = useState<GreenhouseTable[]>([])
  const [parcelles, setParcelles] = useState<Parcelle[]>([])
  const [plantings, setPlantings] = useState<FieldPlanting[]>([])
  const [varieties, setVarieties] = useState<Map<string, string>>(new Map())
  const [seedlings, setSeedlings] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [focusedPlanting, setFocusedPlanting] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [gh, gt, pc, fp, vr, sl] = await Promise.all([
      supabase.from("greenhouses").select("id,name").order("name"),
      supabase.from("greenhouse_tables").select("id,greenhouse_id,name").order("name"),
      supabase.from("parcelles").select("id,name,soil_type,location").order("name"),
      supabase.from("field_plantings").select("*").order("created_at", { ascending: false }),
      supabase.from("varieties").select("id,name,commercial_name"),
      supabase.from("seedlings").select("id,code,seedling_code"),
    ])
    if (gh.data) setGreenhouses(gh.data)
    if (gt.data) setTables(gt.data)
    if (pc.data) setParcelles(pc.data as Parcelle[])
    if (fp.data) setPlantings(fp.data as FieldPlanting[])
    if (vr.data) setVarieties(new Map(vr.data.map((v: any) => [v.id, v.commercial_name || v.name])))
    if (sl.data) setSeedlings(new Map(sl.data.map((s: any) => [s.id, s.seedling_code || s.code])))
    setLoading(false)
  }

  const greenhouseMap = useMemo(() => new Map(greenhouses.map((g) => [g.id, g])), [greenhouses])
  const tableMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables])
  const parcelleMap = useMemo(() => new Map(parcelles.map((p) => [p.id, p])), [parcelles])

  function plantingLabel(p: FieldPlanting): string {
    return p.variety_id ? (varieties.get(p.variety_id) ?? "Variété inconnue") : (seedlings.get(p.seedling_id ?? "") ?? "Semis inconnu")
  }
  function plantingLocationLabel(p: FieldPlanting): string {
    if (p.greenhouse_table_id) {
      const t = tableMap.get(p.greenhouse_table_id)
      const g = t ? greenhouseMap.get(t.greenhouse_id) : null
      return t ? `${g?.name ?? "Serre"} · ${t.name}` : "Table de serre inconnue"
    }
    if (p.parcelle_id) return parcelleMap.get(p.parcelle_id)?.name ?? "Parcelle inconnue"
    return "—"
  }

  const focused = focusedPlanting ? plantings.find((p) => p.id === focusedPlanting) ?? null : null

  if (loading) return <div className="flex items-center justify-center py-20"><Sprout className="size-8 animate-pulse text-primary" /></div>

  return (
    <div className="flex flex-col gap-5">
      {focused ? null : <SectionHeading title="Serres & Parcelles" description="Emplacements, variétés en place, suivi sanitaire/phyto et programmes de fond." />}

      {focused ? (
        <PlantingFocusView
          planting={focused}
          label={plantingLabel(focused)}
          locationLabel={plantingLocationLabel(focused)}
          greenhouseId={focused.greenhouse_table_id ? tableMap.get(focused.greenhouse_table_id)?.greenhouse_id ?? null : null}
          onBack={() => setFocusedPlanting(null)}
          onRefresh={fetchData}
        />
      ) : (
        <>
          <div className="flex gap-2">
            {(["plantations", "serres", "parcelles"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={tab === t ? "flex items-center gap-1.5 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary" : "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"}>
                {t === "plantations" ? <><Sprout className="size-4" /> Plantations</> : t === "serres" ? <><Warehouse className="size-4" /> Serres</> : <><MapPin className="size-4" /> Parcelles</>}
              </button>
            ))}
          </div>

          {tab === "serres" ? <GreenhousesPanel greenhouses={greenhouses} tables={tables} onRefresh={fetchData} /> : null}
          {tab === "parcelles" ? <ParcellesPanel parcelles={parcelles} onRefresh={fetchData} /> : null}
          {tab === "plantations" ? (
            <PlantingsPanel
              plantings={plantings} greenhouses={greenhouses} tables={tables} parcelles={parcelles}
              plantingLabel={plantingLabel} plantingLocationLabel={plantingLocationLabel}
              onOpen={(id) => setFocusedPlanting(id)} onRefresh={fetchData}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Serres (structure) : gérées ici faute d'écran existant ailleurs dans
// l'appli — nécessaire pour pouvoir choisir une Serre au même titre
// qu'une Parcelle lors d'une plantation.
// ---------------------------------------------------------------------------

function GreenhousesPanel({ greenhouses, tables, onRefresh }: { greenhouses: Greenhouse[]; tables: GreenhouseTable[]; onRefresh: () => void }) {
  const [newGreenhouse, setNewGreenhouse] = useState("")
  const [newTableName, setNewTableName] = useState<Record<string, string>>({})

  async function createGreenhouse() {
    if (!newGreenhouse.trim()) return
    const { error } = await supabase.from("greenhouses").insert({ name: newGreenhouse.trim() })
    if (error) { alert(`Erreur : ${error.message}`); return }
    setNewGreenhouse("")
    onRefresh()
  }
  async function createTable(greenhouseId: string) {
    const name = (newTableName[greenhouseId] ?? "").trim()
    if (!name) return
    const { error } = await supabase.from("greenhouse_tables").insert({ greenhouse_id: greenhouseId, name })
    if (error) { alert(`Erreur : ${error.message}`); return }
    setNewTableName((cur) => ({ ...cur, [greenhouseId]: "" }))
    onRefresh()
  }
  async function deleteGreenhouse(id: string) {
    if (!confirm("Supprimer cette serre et toutes ses tables ?")) return
    await supabase.from("greenhouses").delete().eq("id", id)
    onRefresh()
  }
  async function deleteTable(id: string) {
    if (!confirm("Supprimer cette table ?")) return
    await supabase.from("greenhouse_tables").delete().eq("id", id)
    onRefresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex items-end gap-3 p-3">
        <Field label="Nouvelle serre"><Input value={newGreenhouse} onChange={(e) => setNewGreenhouse(e.target.value)} placeholder="Ex: Serre froide" /></Field>
        <Button size="sm" onClick={createGreenhouse} disabled={!newGreenhouse.trim()} className="gap-1"><Plus className="size-3.5" /> Ajouter</Button>
      </Card>

      {greenhouses.length === 0 ? (
        <EmptyState icon={<Warehouse className="size-8" />} title="Aucune serre" description="Créez une serre pour pouvoir y placer des plantations." />
      ) : (
        greenhouses.map((g) => (
          <Card key={g.id} className="p-3">
            <div className="flex items-center gap-2">
              <Warehouse className="size-4 text-primary" />
              <span className="text-sm font-medium">{g.name}</span>
              <button onClick={() => deleteGreenhouse(g.id)} className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tables.filter((t) => t.greenhouse_id === g.id).map((t) => (
                <Badge key={t.id} tone="neutral"><Table2 className="size-3" /> {t.name} <button onClick={() => deleteTable(t.id)} className="ml-1 hover:text-destructive">×</button></Badge>
              ))}
            </div>
            <div className="mt-2 flex items-end gap-2">
              <Field label="Nouvelle table"><Input className="h-8 w-40" value={newTableName[g.id] ?? ""} onChange={(e) => setNewTableName((cur) => ({ ...cur, [g.id]: e.target.value }))} placeholder="Ex: Table 1" /></Field>
              <Button size="sm" variant="outline" onClick={() => createTable(g.id)}><Plus className="size-3.5" /></Button>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Parcelles
// ---------------------------------------------------------------------------

function ParcellesPanel({ parcelles, onRefresh }: { parcelles: Parcelle[]; onRefresh: () => void }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [soilType, setSoilType] = useState<string[]>([])

  async function createParcelle() {
    if (!name.trim()) return
    const { error } = await supabase.from("parcelles").insert({ name: name.trim(), location: location.trim() || null, soil_type: soilType })
    if (error) { alert(`Erreur : ${error.message}`); return }
    setName(""); setLocation(""); setSoilType([]); setCreating(false)
    onRefresh()
  }
  async function deleteParcelle(id: string) {
    if (!confirm("Supprimer cette parcelle ?")) return
    await supabase.from("parcelles").delete().eq("id", id)
    onRefresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating((v) => !v)} className="gap-1.5"><Plus className="size-4" /> Nouvelle parcelle</Button>
      </div>

      {creating ? (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Parcelle Sud" /></Field>
            <Field label="Localisation" hint="Ville, secteur..."><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
          </div>
          <div className="mt-3 grid gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type de sol</p>
            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(SOIL_TYPE_LABELS).map(([k, v]) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={soilType.includes(k)} onChange={(e) => setSoilType((cur) => e.target.checked ? [...cur, k] : cur.filter((c) => c !== k))} /> {v}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Annuler</Button>
            <Button size="sm" onClick={createParcelle} disabled={!name.trim()}>Créer</Button>
          </div>
        </Card>
      ) : null}

      {parcelles.length === 0 ? (
        <EmptyState icon={<MapPin className="size-8" />} title="Aucune parcelle" description="Créez une parcelle pour y rattacher des plantations en plein air." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {parcelles.map((p) => (
            <Card key={p.id} className="p-3">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                <span className="text-sm font-medium">{p.name}</span>
                <button onClick={() => deleteParcelle(p.id)} className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
              </div>
              {p.location ? <p className="mt-1 text-xs text-muted-foreground">{p.location}</p> : null}
              {p.soil_type?.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {p.soil_type.map((s) => <Badge key={s} tone="neutral">{SOIL_TYPE_LABELS[s] ?? s}</Badge>)}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plantations : quelle variété/semis, où (Serre ou Parcelle).
// ---------------------------------------------------------------------------

function PlantingsPanel({
  plantings, greenhouses, tables, parcelles, plantingLabel, plantingLocationLabel, onOpen, onRefresh,
}: {
  plantings: FieldPlanting[]; greenhouses: Greenhouse[]; tables: GreenhouseTable[]; parcelles: Parcelle[]
  plantingLabel: (p: FieldPlanting) => string; plantingLocationLabel: (p: FieldPlanting) => string
  onOpen: (id: string) => void; onRefresh: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<VarietyOption | null>(null)
  const [suggestions, setSuggestions] = useState<VarietyOption[]>([])
  const [showSugg, setShowSugg] = useState(false)
  const [locationType, setLocationType] = useState<"serre" | "parcelle">("parcelle")
  const [greenhouseTableId, setGreenhouseTableId] = useState("")
  const [parcelleId, setParcelleId] = useState("")

  useEffect(() => {
    if (selected) { setShowSugg(false); return }
    const q = query.trim()
    if (q.length < 1) { setSuggestions([]); setShowSugg(false); return }
    const timer = setTimeout(async () => {
      const escaped = q.replace(/[%,()]/g, " ")
      const [{ data: varieties }, { data: seedlingsData }] = await Promise.all([
        supabase.from("varieties").select("id,name,commercial_name").or(`name.ilike.%${escaped}%,commercial_name.ilike.%${escaped}%`).limit(6),
        supabase.from("seedlings").select("id,code,seedling_code").ilike("code", `%${escaped}%`).limit(6),
      ])
      setSuggestions([
        ...(varieties ?? []).map((v: any) => ({ id: v.id, name: v.commercial_name || v.name, commercial_name: v.commercial_name, source: "catalogue" as const })),
        ...(seedlingsData ?? []).map((s: any) => ({ id: s.id, name: s.seedling_code || s.code, commercial_name: null, source: "semis" as const })),
      ])
      setShowSugg(true)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, selected])

  async function createPlanting() {
    if (!selected) return
    if (locationType === "serre" && !greenhouseTableId) return
    if (locationType === "parcelle" && !parcelleId) return
    const payload = {
      variety_id: selected.source === "catalogue" ? selected.id : null,
      seedling_id: selected.source === "semis" ? selected.id : null,
      greenhouse_table_id: locationType === "serre" ? greenhouseTableId : null,
      parcelle_id: locationType === "parcelle" ? parcelleId : null,
    }
    const { error } = await supabase.from("field_plantings").insert(payload)
    if (error) { alert(`Erreur : ${error.message}`); return }
    setQuery(""); setSelected(null); setGreenhouseTableId(""); setParcelleId(""); setCreating(false)
    onRefresh()
  }

  async function removePlanting(id: string) {
    if (!confirm("Retirer cette plantation (et son historique d'observations/programmes) ?")) return
    await supabase.from("field_plantings").delete().eq("id", id)
    onRefresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating((v) => !v)} className="gap-1.5"><Plus className="size-4" /> Nouvelle plantation</Button>
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
            <Field label="Type d'emplacement">
              <Select value={locationType} onChange={(e) => setLocationType(e.target.value as "serre" | "parcelle")}>
                <option value="parcelle">Parcelle</option>
                <option value="serre">Serre</option>
              </Select>
            </Field>
            {locationType === "serre" ? (
              <Field label="Table de serre">
                <Select value={greenhouseTableId} onChange={(e) => setGreenhouseTableId(e.target.value)}>
                  <option value="">-- Sélectionner --</option>
                  {tables.map((t) => <option key={t.id} value={t.id}>{greenhouses.find((g) => g.id === t.greenhouse_id)?.name ?? "Serre"} · {t.name}</option>)}
                </Select>
              </Field>
            ) : (
              <Field label="Parcelle">
                <Select value={parcelleId} onChange={(e) => setParcelleId(e.target.value)}>
                  <option value="">-- Sélectionner --</option>
                  {parcelles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Annuler</Button>
            <Button size="sm" onClick={createPlanting} disabled={!selected || (locationType === "serre" ? !greenhouseTableId : !parcelleId)}>Créer</Button>
          </div>
        </Card>
      ) : null}

      {plantings.length === 0 ? (
        <EmptyState icon={<Sprout className="size-8" />} title="Aucune plantation" description="Rattachez une variété du Catalogue ou un Semis à une Serre ou une Parcelle." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {plantings.map((p) => (
            <button key={p.id} onClick={() => onOpen(p.id)} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-left hover:border-primary/40 hover:bg-muted/30">
              <div className="flex items-center gap-2">
                <Sprout className="size-4 text-primary" />
                <span className="text-sm font-medium">{plantingLabel(p)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{plantingLocationLabel(p)}</p>
              <p className="text-xs text-muted-foreground">Planté le {formatDate(p.planted_at)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Détail d'une plantation : observations quotidiennes + programmes.
// ---------------------------------------------------------------------------

function PlantingFocusView({ planting, label, locationLabel, greenhouseId, onBack, onRefresh }: {
  planting: FieldPlanting; label: string; locationLabel: string; greenhouseId: string | null
  onBack: () => void; onRefresh: () => void
}) {
  const [observations, setObservations] = useState<FieldObservation[]>([])
  const [programs, setPrograms] = useState<FieldProgram[]>([])
  const [section, setSection] = useState<"observations" | "programmes">("observations")

  useEffect(() => { fetchDetail() }, [planting.id])

  async function fetchDetail() {
    const [obs, progs] = await Promise.all([
      supabase.from("field_observations").select("*").eq("planting_id", planting.id).order("observation_date", { ascending: false }),
      supabase.from("field_programs").select("*").eq("planting_id", planting.id).order("start_date", { ascending: false }),
    ])
    if (obs.data) setObservations(obs.data as FieldObservation[])
    if (progs.data) setPrograms(progs.data as FieldProgram[])
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Retour aux plantations
      </button>

      <div>
        <h2 className="font-serif text-xl text-foreground">{label}</h2>
        <p className="text-xs text-muted-foreground">{locationLabel} · planté le {formatDate(planting.planted_at)}</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setSection("observations")} className={section === "observations" ? "flex items-center gap-1.5 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary" : "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"}>
          <CalendarClock className="size-4" /> Observations
        </button>
        <button onClick={() => setSection("programmes")} className={section === "programmes" ? "flex items-center gap-1.5 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary" : "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"}>
          <ClipboardList className="size-4" /> Programmes
        </button>
      </div>

      {section === "observations" ? (
        <ObservationsSection plantingId={planting.id} observations={observations} onRefresh={fetchDetail} />
      ) : (
        <ProgramsSection plantingId={planting.id} greenhouseId={greenhouseId} parcelleId={planting.parcelle_id} programs={programs} onRefresh={fetchDetail} />
      )}
    </div>
  )
}

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

  useEffect(() => {
    if (!creating) return
    getWeatherForDate(observationDate).then(setWeather)
  }, [creating, observationDate])

  function toggle(setter: (fn: (cur: string[]) => string[]) => void, key: string) {
    setter((cur) => (cur.includes(key) ? cur.filter((c) => c !== key) : [...cur, key]))
  }

  async function submit() {
    const { error } = await supabase.from("field_observations").insert({
      planting_id: plantingId,
      observation_date: observationDate,
      intervention_date: interventionDate || null,
      disease_pressure: disease, pests, climate_behavior: climate, treatment_applied: treatment, treatment_reaction: reaction,
      remarque,
    })
    if (error) { alert(`Erreur : ${error.message}`); return }
    setDisease([]); setPests([]); setClimate([]); setTreatment([]); setReaction([]); setRemarque(""); setInterventionDate("")
    setCreating(false)
    onRefresh()
  }

  const groups: Array<{ title: string; labels: Record<string, string>; value: string[]; set: (fn: (cur: string[]) => string[]) => void }> = [
    { title: "Maladie / Pression sanitaire", labels: DISEASE_PRESSURE_LABELS, value: disease, set: setDisease },
    { title: "Insectes / Ravageurs", labels: PEST_LABELS, value: pests, set: setPests },
    { title: "Comportement face au climat", labels: CLIMATE_BEHAVIOR_LABELS, value: climate, set: setClimate },
    { title: "Type de traitement appliqué", labels: FIELD_TREATMENT_LABELS, value: treatment, set: setTreatment },
    { title: "Réaction face au traitement", labels: TREATMENT_REACTION_LABELS, value: reaction, set: setReaction },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating((v) => !v)} className="gap-1.5"><Plus className="size-4" /> Nouvelle observation</Button>
      </div>

      {creating ? (
        <Card className="p-4">
          <button onClick={() => setCreating(false)} className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Retour</button>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date de l'observation"><Input type="date" value={observationDate} onChange={(e) => setObservationDate(e.target.value)} /></Field>
            <Field label="Date d'intervention" hint="Si un traitement a été appliqué"><Input type="date" value={interventionDate} onChange={(e) => setInterventionDate(e.target.value)} /></Field>
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
                  <label key={k} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={g.value.includes(k)} onChange={() => toggle(g.set, k)} /> {v}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-3"><Field label="Remarque"><Textarea value={remarque} onChange={(e) => setRemarque(e.target.value)} placeholder="Seul champ en texte libre..." /></Field></div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Annuler</Button>
            <Button size="sm" onClick={submit}>Enregistrer</Button>
          </div>
        </Card>
      ) : null}

      {observations.length === 0 ? (
        <EmptyState icon={<CalendarClock className="size-8" />} title="Aucune observation" description="Enregistrez le premier relevé sanitaire/phyto de cette plantation." />
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

function ProgramsSection({ plantingId, greenhouseId, parcelleId, programs, onRefresh }: {
  plantingId: string; greenhouseId: string | null; parcelleId: string | null; programs: FieldProgram[]; onRefresh: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [programType, setProgramType] = useState<"curatif" | "preventif" | "fertilisation">("preventif")
  const [productName, setProductName] = useState("")
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
  const [interventionCount, setInterventionCount] = useState("1")
  const [lastInterventionDate, setLastInterventionDate] = useState("")
  const [result, setResult] = useState("")
  const [notes, setNotes] = useState("")

  async function submit() {
    if (!productName.trim()) return
    const { error } = await supabase.from("field_programs").insert({
      planting_id: plantingId, program_type: programType, product_name: productName.trim(),
      start_date: startDate, intervention_count: Math.max(1, Number.parseInt(interventionCount, 10) || 1),
      last_intervention_date: lastInterventionDate || null, result: result || null, notes,
    })
    if (error) { alert(`Erreur : ${error.message}`); return }
    setProductName(""); setInterventionCount("1"); setLastInterventionDate(""); setResult(""); setNotes(""); setCreating(false)
    onRefresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating((v) => !v)} className="gap-1.5"><Plus className="size-4" /> Nouveau programme</Button>
      </div>

      {creating ? (
        <Card className="p-4">
          <button onClick={() => setCreating(false)} className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Retour</button>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Type de programme">
              <Select value={programType} onChange={(e) => setProgramType(e.target.value as any)}>
                {Object.entries(PROGRAM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Produit"><Input value={productName} onChange={(e) => setProductName(e.target.value)} /></Field>
            <Field label="Date de début"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="Nombre de passages"><Input type="number" min={1} value={interventionCount} onChange={(e) => setInterventionCount(e.target.value)} /></Field>
            <Field label="Dernière intervention"><Input type="date" value={lastInterventionDate} onChange={(e) => setLastInterventionDate(e.target.value)} /></Field>
            <Field label="Résultat">
              <Select value={result} onChange={(e) => setResult(e.target.value)}>
                <option value="">--</option>
                {Object.entries(PROGRAM_RESULT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-3"><Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Annuler</Button>
            <Button size="sm" onClick={submit} disabled={!productName.trim()}>Enregistrer</Button>
          </div>
        </Card>
      ) : null}

      {programs.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-8" />} title="Aucun programme" description="Enregistrez un programme collectif, curatif ou un plan de fertilisation de fond." />
      ) : (
        <div className="grid gap-2">
          {programs.map((p) => (
            <Card key={p.id} className="p-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="primary">{PROGRAM_TYPE_LABELS[p.program_type]}</Badge>
                <span className="font-medium text-foreground">{p.product_name}</span>
                <span className="text-muted-foreground">depuis le {formatDate(p.start_date)} · {p.intervention_count} passage{p.intervention_count > 1 ? "s" : ""}</span>
                {p.result ? <Badge tone={p.result === "amelioration" ? "success" : p.result === "echec" ? "danger" : "warning"} className="ml-auto">{PROGRAM_RESULT_LABELS[p.result] ?? p.result}</Badge> : null}
              </div>
              {p.notes ? <p className="mt-1 italic text-muted-foreground">{p.notes}</p> : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
