"use client"

import { useState } from "react"
import { Flower2, Cherry, Sprout, Warehouse, Sparkles, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataProvider, useData } from "./data-provider"
import { CrossesPanel } from "./crosses-panel"
import { HarvestsPanel } from "./harvests-panel"
import { BatchesPanel } from "./batches-panel"
import { GreenhousesPanel } from "./greenhouses-panel"
import { seedSampleData } from "./sample-data"

type TabKey = "crosses" | "harvests" | "batches" | "greenhouses"

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "crosses", label: "Croisements", icon: Flower2 },
  { key: "harvests", label: "Récoltes", icon: Cherry },
  { key: "batches", label: "Lots & semis", icon: Sprout },
  { key: "greenhouses", label: "Serres", icon: Warehouse },
]

export function BreedingApp() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  )
}

function Shell() {
  const [tab, setTab] = useState<TabKey>("crosses")
  const { crosses, hipHarvests, seedlings, run, resetAll } = useData()

  const hasData = crosses.length > 0 || hipHarvests.length > 0 || seedlings.length > 0

  return (
    <div className="min-h-svh">
      <header className="border-b border-border bg-sidebar">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Flower2 className="size-5" />
            </span>
            <div>
              <h1 className="font-serif text-xl leading-tight text-foreground">
                Carnet de sélection — Rosiers
              </h1>
              <p className="text-xs text-muted-foreground">
                Croisement A → Fruit Aa → Semis Aa1
              </p>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            {!hasData ? (
              <Button variant="outline" onClick={() => run(() => seedSampleData())} className="gap-1.5">
                <Sparkles className="size-4" /> Données d&apos;exemple
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm("Réinitialiser toutes les données ?")) resetAll()
                }}
                className="gap-1.5"
              >
                <RotateCcw className="size-4" /> Réinitialiser
              </Button>
            )}
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={
                  active
                    ? "flex items-center gap-1.5 border-b-2 border-primary px-3 py-2.5 text-sm font-medium text-foreground"
                    : "flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                <Icon className="size-4" />
                {label}
              </button>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {tab === "crosses" ? <CrossesPanel /> : null}
        {tab === "harvests" ? <HarvestsPanel /> : null}
        {tab === "batches" ? <BatchesPanel /> : null}
        {tab === "greenhouses" ? <GreenhousesPanel /> : null}
      </main>
    </div>
  )
}
