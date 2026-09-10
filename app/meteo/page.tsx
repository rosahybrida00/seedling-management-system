"use client"

import { useEffect, useState } from "react"
import { CloudSun, Thermometer, Droplets, Sun, Cloud, MapPin, Plus, Trash2, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/layout/app-shell"
import { supabase } from "@/lib/supabase-client"
import { Card, Badge, Field, Input, SectionHeading, EmptyState, Select } from "@/components/breeding/ui"

interface Sensor {
  id: string
  greenhouse_id: string | null
  name: string
  sensor_type: string | null
  last_value: number | null
  last_reading_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Greenhouse {
  id: string
  name: string
}

interface WeatherData {
  temperature: number | null
  humidity: number | null
  uvIndex: number | null
  cloudCover: number | null
  location: string
}

export default function MeteoPage() {
  return (
    <AppShell>
      <MeteoContent />
    </AppShell>
  )
}

function MeteoContent() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [greenhouses, setGreenhouses] = useState<Greenhouse[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddSensor, setShowAddSensor] = useState(false)
  const [newSensor, setNewSensor] = useState({ name: "", greenhouseId: "", sensorType: "temperature" })

  useEffect(() => {
    fetchWeather()
    fetchData()
  }, [])

  async function fetchWeather() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current=temperature_2m,relative_humidity_2m,uv_index,cloud_cover`,
          )
          const data = await res.json()
          setWeather({
            temperature: data?.current?.temperature_2m ?? null,
            humidity: data?.current?.relative_humidity_2m ?? null,
            uvIndex: data?.current?.uv_index ?? null,
            cloudCover: data?.current?.cloud_cover ?? null,
            location: "Position GPS",
          })
        },
        () => setWeather(null),
        { timeout: 5000 },
      )
    }
  }

  async function fetchData() {
    setLoading(true)
    const [s, gh] = await Promise.all([
      supabase.from("sensors").select("*").order("created_at", { ascending: false }),
      supabase.from("greenhouses").select("id, name").order("name"),
    ])
    if (s.data) setSensors(s.data as Sensor[])
    if (gh.data) setGreenhouses(gh.data as Greenhouse[])
    setLoading(false)
  }

  async function addSensor() {
    if (!newSensor.name.trim()) return
    await supabase.from("sensors").insert({
      name: newSensor.name.trim(),
      greenhouse_id: newSensor.greenhouseId || null,
      sensor_type: newSensor.sensorType,
    })
    setNewSensor({ name: "", greenhouseId: "", sensorType: "temperature" })
    setShowAddSensor(false)
    fetchData()
  }

  async function deleteSensor(id: string) {
    await supabase.from("sensors").delete().eq("id", id)
    fetchData()
  }

  async function toggleSensor(id: string, current: boolean) {
    await supabase.from("sensors").update({ is_active: !current }).eq("id", id)
    fetchData()
  }

  const sensorTypeLabels: Record<string, string> = {
    temperature: "Température",
    soil_moisture: "Hygrométrie du sol",
    surface_probe: "Sonde de surface",
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        title="Météo & Capteurs"
        description="Conditions extérieures en temps réel et capteurs connectés en serre."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-serif text-lg text-foreground">
            <CloudSun className="size-5 text-primary" /> Météo extérieure
          </h3>
          {weather ? (
            <div className="grid grid-cols-2 gap-4">
              <WeatherStat icon={<Thermometer className="size-5" />} label="Température" value={weather.temperature != null ? `${Math.round(weather.temperature)}°C` : "—"} />
              <WeatherStat icon={<Droplets className="size-5" />} label="Humidité" value={weather.humidity != null ? `${Math.round(weather.humidity)}%` : "—"} />
              <WeatherStat icon={<Sun className="size-5" />} label="Indice UV" value={weather.uvIndex != null ? String(Math.round(weather.uvIndex)) : "—"} />
              <WeatherStat icon={<Cloud className="size-5" />} label="Couverture" value={weather.cloudCover != null ? `${Math.round(weather.cloudCover)}%` : "—"} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Géolocalisation indisponible. Renseignez votre ville dans le profil pour le fallback.
            </p>
          )}
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3" /> {weather?.location ?? "—"}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-serif text-lg text-foreground">
              <Radio className="size-5 text-primary" /> Capteurs connectés
            </h3>
            <Button size="sm" onClick={() => setShowAddSensor((v) => !v)} className="gap-1.5">
              <Plus className="size-4" /> Appairer
            </Button>
          </div>

          {showAddSensor ? (
            <div className="mb-3 rounded-md border border-border bg-muted/20 p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Nom du capteur">
                  <Input value={newSensor.name} onChange={(e) => setNewSensor({ ...newSensor, name: e.target.value })} placeholder="Sonde A1" />
                </Field>
                <Field label="Serre">
                  <Select value={newSensor.greenhouseId} onChange={(e) => setNewSensor({ ...newSensor, greenhouseId: e.target.value })}>
                    <option value="">— Aucune —</option>
                    {greenhouses.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Type de capteur">
                  <Select value={newSensor.sensorType} onChange={(e) => setNewSensor({ ...newSensor, sensorType: e.target.value })}>
                    <option value="temperature">Température</option>
                    <option value="soil_moisture">Hygrométrie du sol</option>
                    <option value="surface_probe">Sonde de surface</option>
                  </Select>
                </Field>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowAddSensor(false)}>Annuler</Button>
                <Button size="sm" onClick={addSensor} disabled={!newSensor.name.trim()}>Ajouter</Button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : sensors.length === 0 ? (
            <EmptyState title="Aucun capteur appairé" description="Appairez vos capteurs IoT de serre pour suivre les conditions en temps réel." />
          ) : (
            <div className="grid gap-2">
              {sensors.map((s) => {
                const gh = greenhouses.find((g) => g.id === s.greenhouse_id)
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
                    <span className={`flex size-8 items-center justify-center rounded-md ${s.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Radio className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sensorTypeLabels[s.sensor_type ?? ""] ?? s.sensor_type}
                        {gh ? ` · ${gh.name}` : ""}
                        {s.last_value != null ? ` · ${s.last_value}` : ""}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Badge tone={s.is_active ? "success" : "neutral"}>
                        {s.is_active ? "Actif" : "Inactif"}
                      </Badge>
                      <Button size="sm" variant="ghost" onClick={() => toggleSensor(s.id, s.is_active)}>
                        {s.is_active ? "Désactiver" : "Activer"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteSensor(s.id)} className="gap-1">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function WeatherStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-primary">{icon}</span>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-lg font-medium text-foreground">{value}</span>
    </div>
  )
}
