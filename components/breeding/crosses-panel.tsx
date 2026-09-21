"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Flower2, Plus, Sprout } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useData } from "./data-provider"
import { Badge, Card, EmptyState, Field, Input, SectionHeading } from "./ui"
import type { Cross, CrossLot } from "@/lib/domain/types"

export function CrossesPanel() {
  const { crosses, cross, run } = useData()
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [form, setForm] = useState({ seedParent: "", pollenParent: "" })

  function createCross() {
    if (!form.seedParent.trim() || !form.pollenParent.trim()) return
    const root = `${form.seedParent.trim()} × ${form.pollenParent.trim()}`
    run(() => cross.createCross({ code: root, root, seedParent: form.seedParent, pollenParent: form.pollenParent }))
    setForm({ seedParent: "", pollenParent: "" })
    setCreating(false)
  }

  return <div className="flex flex-col gap-6">
    <SectionHeading title="Croisements & récoltes" description="Organisez chaque couple, ses lots, puis le suivi individuel des fruits." action={<div className="flex gap-2"><Button variant="outline" className="gap-1.5"><Flower2 className="size-4" /> Pollen</Button><Button onClick={() => setCreating((v) => !v)} className="gap-1.5"><Plus className="size-4" /> Nouveau croisement</Button></div>} />
    {creating ? <Card className="p-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Parent porte-graine (♀)"><Input value={form.seedParent} onChange={(e) => setForm({ ...form, seedParent: e.target.value })} placeholder="Black Baccara" /></Field><Field label="Parent pollen (♂)"><Input value={form.pollenParent} onChange={(e) => setForm({ ...form, pollenParent: e.target.value })} placeholder="Grande Amore" /></Field></div><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setCreating(false)}>Annuler</Button><Button onClick={createCross} disabled={!form.seedParent.trim() || !form.pollenParent.trim()}>Créer le couple</Button></div></Card> : null}
    {crosses.length === 0 ? <EmptyState icon={<Flower2 className="size-8" />} title="Aucun couple enregistré" description="Commencez par créer un couple de parents, puis ajoutez son premier lot." /> : <div className="grid gap-3">{crosses.map((item) => <CrossCard key={item.id} cross={item} expanded={open === item.id} onToggle={() => setOpen(open === item.id ? null : item.id)} />)}</div>}
  </div>
}

function CrossCard({ cross, expanded, onToggle }: { cross: Cross; expanded: boolean; onToggle: () => void }) {
  const { cross: service, run } = useData()
  const lots = service.listLots(cross.id)
  const [adding, setAdding] = useState(false)
  const [flowers, setFlowers] = useState("")
  function addLot() {
    const lot = run(() => service.createLot({ crossId: cross.id, pollinationDate: null, location: "", containers: "", pollenSource: cross.pollenParent, flowerCount: null, remarks: "" }))
    if (flowers) run(() => service.createFruits(lot, Number(flowers)))
    setFlowers(""); setAdding(false)
  }
  return <Card className="overflow-hidden"><button onClick={onToggle} className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted/30"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{expanded ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}</span><div className="min-w-0"><p className="font-medium">{cross.seedParent} <span className="text-muted-foreground">×</span> {cross.pollenParent}</p><p className="text-xs text-muted-foreground">Racine unique · {lots.length} lot{lots.length > 1 ? "s" : ""}</p></div><Badge tone="primary" className="ml-auto">{lots.length} lot{lots.length > 1 ? "s" : ""}</Badge></button>{expanded ? <div className="border-t border-border bg-muted/10 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-medium">Lots du couple</h3><Button size="sm" onClick={() => setAdding((v) => !v)} className="gap-1"><Plus className="size-3.5" /> Ajouter un lot</Button></div>{adding ? <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-3"><Field label="Fleurs pollinisées"><Input className="w-36" type="number" min="1" placeholder="Vide au départ" value={flowers} onChange={(e) => setFlowers(e.target.value)} /></Field><Button onClick={addLot}>Créer le lot</Button></div> : null}{lots.length ? <div className="grid gap-2">{lots.map((lot) => <LotRow key={lot.id} lot={lot} />)}</div> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Aucun lot. Ajoutez le lot A pour commencer.</p>}</div> : null}</Card>
}

function LotRow({ lot }: { lot: CrossLot }) { const { cross } = useData(); const fruits = cross.listFruits(lot.id); return <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"><span className="font-serif text-lg text-primary">{lot.lotLetter}</span><div><p className="text-sm font-medium">Lot {lot.lotLetter}</p><p className="text-xs text-muted-foreground">{lot.flowerCount ? `${lot.flowerCount} fruit${lot.flowerCount > 1 ? "s" : ""} suivi(s)` : "Suivi des fruits indisponible"}</p></div><Button variant="outline" size="sm" disabled={!fruits.length} className="ml-auto gap-1"><Sprout className="size-3.5" /> Suivi des fruits</Button></div> }
