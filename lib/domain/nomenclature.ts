// ---------------------------------------------------------------------------
// nomenclature — génération automatique du code de traçabilité des semis.
//
// Schéma : [SyllabesParents]-[LotMAJ]-[FleursMin]-[Graines]-[Année]
// Exemple : "blagra-A-b-12-2026"
//
// Les syllabes sont extraites dynamiquement des noms des parents.
// ---------------------------------------------------------------------------

function extractSyllables(name: string): string {
  if (!name) return "xx"
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
  if (!cleaned) return "xx"

  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length === 0) return "xx"

  const firstWord = words[0]
  if (firstWord.length >= 5) {
    return firstWord.slice(0, 3)
  }
  if (words.length >= 2) {
    const second = words[1]
    const s1 = firstWord.slice(0, Math.min(3, firstWord.length))
    const s2 = second.slice(0, Math.min(3, second.length))
    return s1 + s2
  }
  return firstWord.slice(0, Math.min(6, firstWord.length))
}

function lotLetter(index: number): string {
  if (index < 0) return "a"
  return String.fromCharCode(65 + index)
}

function flowerLetter(index: number): string {
  if (index < 0) return "a"
  return String.fromCharCode(97 + index)
}

export interface NomenclatureInput {
  seedParent: string | null
  pollenParent: string | null
  lotIndex: number
  flowerIndex: number
  seedCount: number
  year?: number
}

export function generateSeedlingCode(input: NomenclatureInput): string {
  const syll1 = extractSyllables(input.seedParent ?? "")
  const syll2 = extractSyllables(input.pollenParent ?? "")
  const syllables = syll1 + syll2
  const lot = lotLetter(input.lotIndex)
  const flower = flowerLetter(input.flowerIndex)
  const seeds = Math.max(0, input.seedCount)
  const year = input.year ?? new Date().getFullYear()

  return `${syllables}-${lot}-${flower}-${seeds}-${year}`
}

export function generateSeedlingCodeFromParents(
  seedParent: string,
  pollenParent: string,
  lotIndex: number,
  flowerIndex: number,
  seedCount: number,
): string {
  return generateSeedlingCode({
    seedParent,
    pollenParent,
    lotIndex,
    flowerIndex,
    seedCount,
  })
}
