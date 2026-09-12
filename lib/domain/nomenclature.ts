// ---------------------------------------------------------------------------
// nomenclature — génération automatique des codes de traçabilité Rosa Hybrida.
//
// N2 Specification:
//
// 1. Racine Phonétique (base_syllable):
//    Extraite des noms des parents. Ex: Black Baccara × Golden Perfumella → "blape"
//    - Prend les 2-3 premières syllabes de chaque parent et les concatène.
//
// 2. Code Fruit / Fleur:
//    [base_syllable][lot_letter][flower_letter]  (ex: blapeAa, blapeAb)
//    - lot_letter: lettre majuscule de saison (A, B, C...)
//    - flower_letter: lettre minuscule de fleur (a, b, c...)
//    Si recroisé plus tard: blapeBa, etc.
//
// 3. Code Semis Unique Définitif (seedling_code):
//    [base_syllable][lot_letter][flower_letter][index]  (ex: blapeAc1, blapeAc2)
//    Attribué uniquement aux graines ayant germé et levé en serre.
//
// 4. Code Catalogue Semis (catalogue-semis):
//    [base_syllable]-[lot_letter]-[flower_letter]-[seed_count]-[year]
//    Ex: blape-A-a-12-2026
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

export function generateBaseSyllable(seedParent: string, pollenParent: string): string {
  const syll1 = extractSyllables(seedParent)
  const syll2 = extractSyllables(pollenParent)
  return syll1 + syll2
}

export function lotLetter(index: number): string {
  if (index < 0) return "A"
  return String.fromCharCode(65 + index)
}

export function flowerLetter(index: number): string {
  if (index < 0) return "a"
  return String.fromCharCode(97 + index)
}

export function generateFruitCode(
  baseSyllable: string,
  lotIndex: number,
  flowerIndex: number,
): string {
  return `${baseSyllable}${lotLetter(lotIndex)}${flowerLetter(flowerIndex)}`
}

export function generateSeedlingCode(
  baseSyllable: string,
  lotIndex: number,
  flowerIndex: number,
  seedlingIndex: number,
): string {
  return `${baseSyllable}${lotLetter(lotIndex)}${flowerLetter(flowerIndex)}${seedlingIndex}`
}

export function generateCatalogueCode(
  baseSyllable: string,
  lotIndex: number,
  flowerIndex: number,
  seedCount: number,
  year?: number,
): string {
  const y = year ?? new Date().getFullYear()
  return `${baseSyllable}-${lotLetter(lotIndex)}-${flowerLetter(flowerIndex)}-${Math.max(0, seedCount)}-${y}`
}

export interface NomenclatureInput {
  seedParent: string | null
  pollenParent: string | null
  lotIndex: number
  flowerIndex: number
  seedCount: number
  year?: number
}

export function generateSeedlingCodeFromInput(input: NomenclatureInput): string {
  const base = generateBaseSyllable(input.seedParent ?? "", input.pollenParent ?? "")
  return generateCatalogueCode(base, input.lotIndex, input.flowerIndex, input.seedCount, input.year)
}

export function generateSeedlingCodeFromParents(
  seedParent: string,
  pollenParent: string,
  lotIndex: number,
  flowerIndex: number,
  seedCount: number,
): string {
  return generateSeedlingCodeFromInput({
    seedParent,
    pollenParent,
    lotIndex,
    flowerIndex,
    seedCount,
  })
}
