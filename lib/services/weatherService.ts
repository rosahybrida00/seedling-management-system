import { supabase } from "@/lib/supabase-client"

// ---------------------------------------------------------------------------
// Point d'entrée météo unique de l'application. Personne ne doit appeler
// open-meteo directement ailleurs : on lit d'abord l'historique enregistré
// (weather_daily, un relevé par utilisateur et par jour), et seulement s'il
// manque, on va le chercher (temps réel pour aujourd'hui, archive pour le
// passé) puis on l'enregistre pour la prochaine fois. La zone géographique
// vient automatiquement du profil (latitude/longitude, sinon ville) — ce
// n'est jamais un champ que l'utilisateur remplit dans un formulaire.
// ---------------------------------------------------------------------------

export interface DailyWeather {
  date: string
  temperature: number | null
  humidity: number | null
  uv_index: number | null
  location: string | null
  source: "live" | "archive"
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]
}

// Résolue une seule fois par session (le navigateur ne redemande pas la
// permission à chaque appel) : la même position sert pour toute la
// journée de navigation, comme le fait déjà le bandeau météo de l'appli.
let cachedPosition: { lat: number; lon: number } | null = null

function getBrowserPosition(): Promise<{ lat: number; lon: number } | null> {
  if (cachedPosition) return Promise.resolve(cachedPosition)
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedPosition = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        resolve(cachedPosition)
      },
      () => resolve(null),
      { timeout: 5000 },
    )
  })
}

async function resolveLocation(): Promise<{ lat: number; lon: number; name: string | null } | null> {
  // 1. Position GPS du navigateur — la même source que le bandeau météo
  //    affiché sur toutes les pages de l'appli, en priorité.
  const gps = await getBrowserPosition()
  if (gps) return { lat: gps.lat, lon: gps.lon, name: "Position GPS" }

  // 2. Repli : ville/code postal renseignés dans le profil.
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("city, postal_code")
    .eq("id", authData.user.id)
    .maybeSingle()
  const p = profile as { city?: string | null; postal_code?: string | null } | null
  const city = p?.city || p?.postal_code
  if (!city) return null
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`)
    const data = await res.json()
    const geo = data?.results?.[0]
    if (!geo) return null
    return { lat: geo.latitude, lon: geo.longitude, name: geo.name }
  } catch {
    return null
  }
}

/**
 * Retourne la météo (température, humidité, UV) d'une date donnée, en
 * consultant d'abord l'historique de l'application (weather_daily). Si
 * elle n'y est pas encore, elle est interrogée puis mise en cache pour
 * les prochains enregistrements de croisement, de lot ou de lot de
 * pollen sur la même date.
 *
 * Important : pour une date passée, il ne s'agit jamais d'une valeur
 * inventée. Open-Meteo republie de vraies mesures/réanalyses météo
 * (stations + satellites) pour n'importe quelle date passée, y compris
 * bien avant la création de ce projet — exactement comme n'importe quel
 * site météo qui affiche "le temps qu'il faisait à Paris le 12 juin
 * 2019". "Enregistrer" ici ne veut dire que "mettre en cache ce relevé
 * réel" pour ne pas le redemander à chaque fois.
 *
 * Limite connue : l'indice UV n'est fourni par Open-Meteo que pour
 * aujourd'hui et les ~3 derniers mois (API prévision/récente). Au-delà,
 * seule l'archive historique complète est disponible, et elle ne fournit
 * pas d'indice UV. Dans ce cas, uv_index reste `null` volontairement,
 * plutôt que d'être deviné.
 */
export async function getWeatherForDate(date: string): Promise<DailyWeather | null> {
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return null

  const { data: cached } = await supabase
    .from("weather_daily")
    .select("date, temperature, humidity, uv_index, location, source")
    .eq("user_id", authData.user.id)
    .eq("date", date)
    .maybeSingle()
  if (cached) return cached as DailyWeather

  const place = await resolveLocation()
  if (!place) return null

  const isToday = date === todayStr()
  const daysAgo = Math.floor((Date.parse(todayStr()) - Date.parse(date)) / 86400000)
  // L'API prévision d'Open-Meteo republie aussi les ~92 derniers jours,
  // UV inclus ; au-delà, seule l'archive historique complète (sans UV)
  // est disponible.
  const withinRecentRange = daysAgo >= 0 && daysAgo <= 90

  try {
    let temperature: number | null = null
    let humidity: number | null = null
    let uv: number | null = null
    let source: "live" | "archive" = "archive"

    if (isToday) {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,relative_humidity_2m,uv_index`,
      )
      const data = await res.json()
      temperature = data?.current?.temperature_2m ?? null
      humidity = data?.current?.relative_humidity_2m ?? null
      uv = data?.current?.uv_index ?? null
      source = "live"
    } else if (withinRecentRange) {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&start_date=${date}&end_date=${date}&daily=temperature_2m_mean,relative_humidity_2m_mean,uv_index_max&timezone=auto`,
      )
      const data = await res.json()
      temperature = data?.daily?.temperature_2m_mean?.[0] ?? null
      humidity = data?.daily?.relative_humidity_2m_mean?.[0] ?? null
      uv = data?.daily?.uv_index_max?.[0] ?? null
      source = "archive"
    } else {
      const res = await fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${place.lat}&longitude=${place.lon}&start_date=${date}&end_date=${date}&daily=temperature_2m_mean,relative_humidity_2m_mean&timezone=auto`,
      )
      const data = await res.json()
      temperature = data?.daily?.temperature_2m_mean?.[0] ?? null
      humidity = data?.daily?.relative_humidity_2m_mean?.[0] ?? null
      uv = null // Non fourni par l'archive historique complète.
      source = "archive"
    }

    const record: DailyWeather = { date, temperature, humidity, uv_index: uv, location: place.name, source }

    await supabase.from("weather_daily").upsert(
      { user_id: authData.user.id, date, temperature, humidity, uv_index: uv, location: place.name, source },
      { onConflict: "user_id,date" },
    )

    return record
  } catch {
    return null
  }
}
