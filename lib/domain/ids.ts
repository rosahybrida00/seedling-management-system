// ---------------------------------------------------------------------------
// Stratégie d'ID UNIFIÉE
//
// Problème historique (Flutter) : un ID "app" distinct de l'ID "base" créait
// des orphelins lors des synchronisations (la même entité recevait deux
// identités selon la couche qui l'avait créée).
//
// Solution : un SEUL identifiant, généré côté application au moment de la
// création, réutilisé tel quel comme clé primaire de persistance. Il n'y a
// plus jamais de ré-attribution d'ID par la couche de stockage.
// ---------------------------------------------------------------------------

/**
 * Génère un identifiant unifié, stable et unique.
 * Utilise crypto.randomUUID quand disponible, avec repli déterministe.
 */
export function newId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } }
  if (g.crypto?.randomUUID) {
    return g.crypto.randomUUID()
  }
  // Repli : timestamp + aléatoire (suffisant hors contexte cryptographique).
  const rand = Math.random().toString(36).slice(2, 10)
  return `${Date.now().toString(36)}-${rand}`
}

/**
 * Normalise un code métier pour l'utiliser comme clé stable.
 * (insensible à la casse et aux espaces superflus)
 */
export function normalizeCode(code: string): string {
  return code.trim().toLowerCase()
}

/** Horodatage ISO courant, factorisé pour createdAt/updatedAt. */
export function nowIso(): string {
  return new Date().toISOString()
}
