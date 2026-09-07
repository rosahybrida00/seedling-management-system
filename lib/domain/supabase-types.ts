// ---------------------------------------------------------------------------
// Types métier Supabase — complètent les types existants (types.ts)
// pour le Catalogue des rosiers, le Profil, les Paramètres et les Capteurs.
// ---------------------------------------------------------------------------

/** Catégorie de rosier dans le catalogue. */
export type RoseCategory = "baptisee" | "lignee" | "evaluation"

export const ROSE_CATEGORIES: readonly RoseCategory[] = [
  "baptisee",
  "lignee",
  "evaluation",
] as const

export const ROSE_CATEGORY_LABELS: Record<RoseCategory, string> = {
  baptisee: "Variété baptisée",
  lignee: "Lignée / Souche parentale",
  evaluation: "En évaluation",
}

/** Rosier du catalogue (public en lecture, édition par le propriétaire). */
export interface Rose {
  id: string
  name: string
  obtenteur: string | null
  type: string | null
  parentage: string | null
  photoUrl: string | null
  description: string | null
  category: RoseCategory
  userId: string | null
  createdAt: string
  updatedAt: string
}

/** Profil professionnel de l'hybrideur. */
export interface Profile {
  id: string
  obtenteurName: string | null
  affixe: string | null
  siret: string | null
  city: string | null
  postalCode: string | null
  address: string | null
  avatarUrl: string | null
  subscription: "free" | "pro"
  createdAt: string
  updatedAt: string
}

/** Préférences et seuils d'alerte. */
export interface UserSettings {
  id: string
  theme: "botanical" | "dark" | "light"
  frostThreshold: number
  heatThreshold: number
  units: "metric" | "imperial"
  createdAt: string
  updatedAt: string
}

/** Capteur IoT appairé en serre. */
export interface Sensor {
  id: string
  userId: string
  greenhouseId: string | null
  name: string
  sensorType: string | null
  lastValue: number | null
  lastReadingAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Lot de pollen (récolte, évaluation, congélation). */
export interface PollenLot {
  id: string
  userId: string
  lotNumber: string
  roseName: string | null
  antherQuality: string | null
  dehiscence: string | null
  conservationMode: string | null
  remarks: string
  createdAt: string
  updatedAt: string
}

/** Message de support B2B. */
export interface SupportMessage {
  id: string
  userId: string | null
  subject: string | null
  category: "technical" | "billing" | "dho" | "partnership"
  message: string
  attachmentUrl: string | null
  status: "open" | "in_progress" | "resolved"
  createdAt: string
}

/** Données météo affichées dans le bandeau. */
export interface WeatherData {
  temperature: number | null
  humidity: number | null
  uvIndex: number | null
  cloudCover: number | null
  location: string
  source: "gps" | "profile" | "manual"
}
