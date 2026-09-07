"use client"

import { useEffect, useState } from "react"
import { User, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/layout/app-shell"
import { supabase } from "@/lib/supabase-client"
import { Card, Field, Input, SectionHeading, Badge } from "@/components/breeding/ui"

interface Profile {
  obtenteur_name: string | null
  affixe: string | null
  siret: string | null
  city: string | null
  postal_code: string | null
  address: string | null
  avatar_url: string | null
  subscription: string
}

export default function ProfilPage() {
  return (
    <AppShell>
      <ProfilContent />
    </AppShell>
  )
}

function ProfilContent() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .maybeSingle()
    if (data) setProfile(data as Profile)
    setLoading(false)
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    await supabase.from("profiles").update({
      obtenteur_name: profile.obtenteur_name,
      affixe: profile.affixe,
      siret: profile.siret,
      city: profile.city,
      postal_code: profile.postal_code,
      address: profile.address,
      avatar_url: profile.avatar_url,
    }).eq("id", userData.user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const ext = file.name.split(".").pop()
    const path = `avatars/${userData.user.id}.${ext}`
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true })
    if (upErr) return
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path)
    setProfile({ ...profile!, avatar_url: urlData.publicUrl })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <User className="size-8 animate-pulse text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        title="Profil Utilisateur"
        description="Votre fiche d'hybrideur : identité métier, affixe et localisation."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-muted">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="Avatar" className="size-full object-cover" />
              ) : (
                <User className="size-10 text-muted-foreground" />
              )}
            </div>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <span className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <Upload className="size-4" /> Changer la photo
              </span>
            </label>
            <Badge tone={profile?.subscription === "pro" ? "success" : "neutral"}>
              {profile?.subscription === "pro" ? "Abonnement Pro" : "Compte Gratuit"}
            </Badge>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom d'obtenteur / Pseudo">
              <Input
                value={profile?.obtenteur_name ?? ""}
                onChange={(e) => setProfile({ ...profile!, obtenteur_name: e.target.value })}
                placeholder="Mon Pépinière"
              />
            </Field>
            <Field label="Affixe de pépinière">
              <Input
                value={profile?.affixe ?? ""}
                onChange={(e) => setProfile({ ...profile!, affixe: e.target.value })}
                placeholder="Les Roses du Val"
              />
            </Field>
            <Field label="SIRET (optionnel)">
              <Input
                value={profile?.siret ?? ""}
                onChange={(e) => setProfile({ ...profile!, siret: e.target.value })}
                placeholder="123 456 789 00012"
              />
            </Field>
            <Field label="Ville (fallback météo)">
              <Input
                value={profile?.city ?? ""}
                onChange={(e) => setProfile({ ...profile!, city: e.target.value })}
                placeholder="Lyon"
              />
            </Field>
            <Field label="Code postal">
              <Input
                value={profile?.postal_code ?? ""}
                onChange={(e) => setProfile({ ...profile!, postal_code: e.target.value })}
                placeholder="69000"
              />
            </Field>
            <Field label="Adresse">
              <Input
                value={profile?.address ?? ""}
                onChange={(e) => setProfile({ ...profile!, address: e.target.value })}
                placeholder="12 chemin des Roses"
              />
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              <Save className="size-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
            {saved ? <span className="text-sm text-primary">Enregistré</span> : null}
          </div>
        </Card>
      </div>
    </div>
  )
}
