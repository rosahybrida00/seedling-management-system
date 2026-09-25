"use client"

import { useEffect, useMemo, useState } from "react"
import { ClipboardCheck, CloudSun, Leaf, MapPin, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, Field, Input, Select, SectionHeading } from "./ui"
import { supabase } from "@/lib/supabase-client"

const CHECKLISTS = {
  "Maladie / Pression sanitaire": ["Oïdium", "Mildiou", "Marsonia (Taches noires)", "Rouille", "Botrytis", "Autre"],
  "Insectes / Ravageurs": ["Pucerons", "Cochenilles", "Thrips", "Araignées rouges", "Altises", "Autre"],
  "Comportement face au climat": ["Brûlures foliaires (soleil)", "Stress hydrique (sécheresse)", "Sensibilité humidité/asphyxie", "Rétention/Chlorose", "Résistance avérée"],
  "Type de traitement appliqué": ["Soude caustique", "Soufre", "Bouillie bordelaise", "Insecticide biologique", "Fongicide biologique", "Produit chimique de synthèse", "Autre"],
  "Réaction / Comportement face au traitement": ["Tolérance parfaite", "Phytotoxicité légère (jaunissement)", "Phytotoxicité forte (brûlure)", "Efficacité rapide", "Aucune efficacité"],
} as const

type Option = { id: string; label: string }
type Weather = { id: string; date: string; location: string | null }

export function FieldObservatory() {
  const [varieties, setVarieties] = useState<Option[]>([])
  const [locations, setLocations] = useState<Option[]>([])
  const [weather, setWeather] = useState<Weather[]>([])
  const [varietyId, setVarietyId] = useState("")
  const [locationId, setLocationId] = useState("")
  const [locationKind, setLocationKind] = useState<"greenhouse" | "parcelle">("greenhouse")
  const [observationDate, setObservationDate] = useState(new Date().toISOString().slice(0, 10))
  const [interventionDate, setInterventionDate] = useState(new Date().toISOString().slice(0, 10))
  const [weatherId, setWeatherId] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [passages, setPassages] = useState("1")
  const [result, setResult] = useState("Amélioration")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const [seedlings, catalog, greenhouses, parcels, days] = await Promise.all([
        supabase.from("seedlings").select("id, code").order("code"),
        supabase.from("varieties").select("id, name").order("name"),
        supabase.from("greenhouses").select("id, name").order("name"),
        supabase.from("parcelles").select("id, name").order("name"),
        supabase.from("weather_daily").select("id, date, location").order("date", { ascending: false }).limit(120),
      ])
      setVarieties([
        ...(catalog.data ?? []).map((v) => ({ id: `variety:${v.id}`, label: `${v.name} · Catalogue` })),
        ...(seedlings.data ?? []).map((s) => ({ id: `seedling:${s.id}`, label: `${s.code} · Semis` })),
      ])
      setLocations([
        ...(greenhouses.data ?? []).map((g) => ({ id: g.id, label: `${g.name} · Serre` })),
        ...(parcels.data ?? []).map((p) => ({ id: p.id, label: `${p.name} · Parcelle` })),
      ])
      setWeather((days.data ?? []) as Weather[])
    }
    load()
  }, [])

  const weatherForDate = useMemo(() => weather.filter((day) => day.date === observationDate), [weather, observationDate])
  const toggle = (value: string) => setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])

  async function save() {
    if (!varietyId || !locationId || !weatherId) return
    const [entityType, entityId] = varietyId.split(":")
    const { error } = await supabase.from("field_observations").insert({
      [entityType === "seedling" ? "seedling_id" : "variety_id"]: entityId,
      [locationKind === "parcelle" ? "parcelle_id" : "greenhouse_id"]: locationId,
      observation_date: observationDate,
      intervention_date: interventionDate,
      weather_daily_id: weatherId,
      observations: selected,
      notes,
      intervention_passes: Number(passages),
      intervention_result: result,
    })
    if (!error) { setSaved(true); setNotes(""); setSelected([]); window.setTimeout(() => setSaved(false), 2400) }
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading title="Observatoire terrain" description="Saisissez un relevé rapide, toujours relié à une variété, un emplacement et la météo historique du jour." />
      <Card className="border-primary/20 bg-card p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-4">
          <Field label="Variété / semis" htmlFor="field-variety">
            <Select id="field-variety" value={varietyId} onChange={(event) => setVarietyId(event.target.value)}>
              <option value="">Sélectionner…</option>
              {varieties.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </Field>
          <Field label="Type d'emplacement" htmlFor="field-kind">
            <Select id="field-kind" value={locationKind} onChange={(event) => setLocationKind(event.target.value as typeof locationKind)}>
              <option value="greenhouse">Serre</option><option value="parcelle">Parcelle</option>
            </Select>
          </Field>
          <Field label="Serre / parcelle" htmlFor="field-location">
            <Select id="field-location" value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Sélectionner…</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
          </Field>
          <Field label="Date d'observation" htmlFor="field-date"><Input id="field-date" type="date" value={observationDate} onChange={(event) => { setObservationDate(event.target.value); setWeatherId("") }} /></Field>
        </div>

        <div className="mt-5 grid gap-4 border-t border-border pt-5 lg:grid-cols-[1fr_280px]">
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(CHECKLISTS).map(([group, items]) => <fieldset key={group} className="rounded-md border border-border bg-muted/20 p-3"><legend className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group}</legend><div className="mt-2 grid gap-2">{items.map((item) => <label key={item} className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={selected.includes(item)} onChange={() => toggle(item)} className="size-4 accent-primary" />{item}</label>)}</div></fieldset>)}
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-md bg-primary/5 p-3"><div className="flex items-center gap-2 text-sm font-medium"><CloudSun className="size-4 text-primary" />Météo historique</div><p className="mt-1 text-xs text-muted-foreground">Seuls les relevés du {observationDate} sont proposés.</p><Select className="mt-3" value={weatherId} onChange={(event) => setWeatherId(event.target.value)}><option value="">Choisir le relevé…</option>{weatherForDate.map((day) => <option key={day.id} value={day.id}>{day.location || "Station"}</option>)}</Select></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Date d'intervention" htmlFor="intervention-date"><Input id="intervention-date" type="date" value={interventionDate} onChange={(event) => setInterventionDate(event.target.value)} /></Field><Field label="Passages" htmlFor="passes"><Input id="passes" type="number" min="1" value={passages} onChange={(event) => setPassages(event.target.value)} /></Field></div>
            <Field label="Résultat de l'intervention" htmlFor="result"><Select id="result" value={result} onChange={(event) => setResult(event.target.value)}><option>Amélioration</option><option>Stationnaire</option><option>Échec</option></Select></Field>
            <Field label="Notes de terrain" htmlFor="field-notes"><textarea id="field-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contexte, dosage, intensité…" className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" /></Field>
            <Button onClick={save} disabled={!varietyId || !locationId || !weatherId} className="gap-2"><Save data-icon="inline-start" />{saved ? "Relevé enregistré" : "Enregistrer le relevé"}</Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Leaf className="size-3.5" />Chaînage variété / semis</span><span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />Emplacement stable</span><span className="inline-flex items-center gap-1"><ClipboardCheck className="size-3.5" />Observation + intervention datées</span></div>
      </Card>
    </div>
  )
}
