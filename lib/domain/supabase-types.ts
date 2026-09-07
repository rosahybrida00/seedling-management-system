// ---------------------------------------------------------------------------
// Types métier Supabase — complètent les types existants (types.ts)
// pour le Catalogue des rosiers, le Profil, les Paramètres et les Capteurs.
// Les noms de champs correspondent exactement aux colonnes SQL (snake_case).
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
  photo_url: string | null
  description: string | null
  category: RoseCategory
  user_id: string | null
  created_at: string
  updated_at: string
}

/** Profil professionnel de l'hybrideur. */
export interface Profile {
  id: string
  obtenteur_name: string | null
  affixe: string | null
  siret: string | null
  city: string | null
  postal_code: string | null
  address: string | null
  avatar_url: string | null
  subscription: "free" | "pro"
  created_at: string
  updated_at: string
}

/** Préférences et seuils d'alerte. */
export interface UserSettings {
  id: string
  theme: "botanical" | "dark" | "light"
  frost_threshold: number
  heat_threshold: number
  units: "metric" | "imperial"
  created_at: string
  updated_at: string
}

/** Capteur IoT appairé en serre. */
export interface Sensor {
  id: string
  user_id: string
  greenhouse_id: string | null
  name: string
  sensor_type: string | null
  last_value: number | null
  last_reading_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Lot de pollen (récolte, évaluation, congélation). */
export interface PollenLot {
  id: string
  user_id: string
  lot_number: string
  rose_name: string | null
  anther_quality: string | null
  dehiscence: string | null
  conservation_mode: string | null
  remarks: string
  created_at: string
  updated_at: string
}

/** Message de support B2B. */
export interface SupportMessage {
  id: string
  user_id: string | null
  subject: string | null
  category: "technical" | "billing" | "dho" | "partnership"
  message: string
  attachment_url: string | null
  status: "open" | "in_progress" | "resolved"
  created_at: string
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
