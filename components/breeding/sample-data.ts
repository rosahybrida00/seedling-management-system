import { crossService } from "@/lib/services/crossService"
import { seedlingService } from "@/lib/services/seedlingService"
import { greenhouseService } from "@/lib/services/greenhouseService"

/**
 * Peuple la base avec un jeu d'exemple illustrant le système Aa1 :
 *   Croisement A -> Fruit Aa -> Lot semé -> Semis Aa1, Aa2, ...
 */
export function seedSampleData(): void {
  // Serre + table
  const gh = greenhouseService.createGreenhouse({ name: "Serre nord" })
  const table = greenhouseService.createTable({
    greenhouseId: gh.id,
    name: "Table A1",
    capacity: 40,
  })

  // Croisement A
  const crossA = crossService.createCross({
    code: "A",
    seedParent: "Rosa gallica",
    pollenParent: "Rosa moschata",
    pollinationDate: "2025-05-12T00:00:00.000Z",
    remarks: "Bonne nouaison, temps sec.",
  })

  // Fruit Aa (récolte)
  const harvestAa = crossService.createHarvest({
    crossId: crossA.id,
    code: "Aa",
    harvestDate: "2025-10-03T00:00:00.000Z",
    seedCount: 6,
    remarks: "Cynorrhodon sain, bien mûr.",
  })

  // Semis : crée le lot (copie harvestDate + seedCount) et génère Aa1..Aa6
  const { batch, seedlings } = seedlingService.sow({
    hipHarvest: harvestAa,
    sowingDate: "2025-11-15T00:00:00.000Z",
    tableId: table.id,
    remarks: "Semis en godets tourbe.",
  })

  // Quelques statuts pour l'exemple
  if (seedlings[0]) seedlingService.setStatus(seedlings[0].id, "selected")
  if (seedlings[1]) seedlingService.updateSeedling(seedlings[1].id, { remarks: "Feuillage prometteur." })
  if (seedlings[2]) seedlingService.setStatus(seedlings[2].id, "discarded")

  // Second fruit Ab, non encore semé
  crossService.createHarvest({
    crossId: crossA.id,
    code: "Ab",
    harvestDate: "2025-10-08T00:00:00.000Z",
    seedCount: 3,
    remarks: "Petit fruit, à surveiller.",
  })

  void batch
}
