"use client"

import { useEffect, useState } from "react"
import { Settings, Save, Download, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/layout/app-shell"
import { supabase } from "@/lib/supabase-client"
import { Card, Field, Input, SectionHeading, Select, Badge } from "@/components/breeding/ui"

interface UserSettings {
  theme: string
  frost_threshold: number
  heat_threshold: number
  units: string
}

export default function ParametresPage() {
  return (
    <AppShell>
      <ParametresContent />
    </AppShell>
  )
}

function ParametresContent() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .eq("id", userData.user.id)
      .maybeSingle()
    if (data) setSettings(data as UserSettings)
    setLoading(false)
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    await supabase.from("user_settings").update({
      theme: settings.theme,
      frost_threshold: Number(settings.frost_threshold),
      heat_threshold: Number(settings.heat_threshold),
      units: settings.units,
    }).eq("id", userData.user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleExportAll() {
    const tables = ["crosses", "hip_harvests", "sowing_batches", "seedlings", "greenhouses", "greenhouse_tables", "pollen_lots", "sensors"]
    const exportData: Record<string, unknown> = {}
    for (const table of tables) {
      const { data } = await supabase.from(table).select("*")
      exportData[table] = data
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "backup-complet.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Settings className="size-8 animate-pulse text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        title="Paramètres"
        description="Préférences, seuils d'alerte météo et gestion des données."
      />

      <Card className="p-5">
        <h3 className="mb-4 font-serif text-lg text-foreground">Préférences</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Thème">
            <Select
              value={settings?.theme ?? "botanical"}
              onChange={(e) => setSettings({ ...settings!, theme: e.target.value })}
            >
              <option value="botanical">Botanique Épuré</option>
              <option value="dark">Sombre</option>
              <option value="light">Clair</option>
            </Select>
          </Field>
          <Field label="Unités">
            <Select
              value={settings?.units ?? "metric"}
              onChange={(e) => setSettings({ ...settings!, units: e.target.value })}
            >
              <option value="metric">Métrique (°C, mm)</option>
              <option value="imperial">Impérial (°F, in)</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 font-serif text-lg text-foreground">Seuils d'alerte météo</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Seuil de gel (°C)" hint="Alerte en dessous de cette température.">
            <Input
              type="number"
              value={settings?.frost_threshold ?? 2}
              onChange={(e) => setSettings({ ...settings!, frost_threshold: Number(e.target.value) })}
            />
          </Field>
          <Field label="Seuil de surchauffe serre (°C)" hint="Alerte au-dessus de cette température.">
            <Input
              type="number"
              value={settings?.heat_threshold ?? 35}
              onChange={(e) => setSettings({ ...settings!, heat_threshold: Number(e.target.value) })}
            />
          </Field>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="size-4" /> {saving ? "Enregistrement…" : "Enregistrer les paramètres"}
        </Button>
        {saved ? <Badge tone="success">Enregistré</Badge> : null}
      </div>

      <Card className="p-5">
        <h3 className="mb-4 font-serif text-lg text-foreground">Gestion des données</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExportAll} className="gap-1.5">
            <Download className="size-4" /> Exporter toutes mes données (JSON)
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Pour la suppression de votre compte (RGPD), contactez le support via la page Contact.
        </p>
      </Card>
    </div>
  )
}
