"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Flower2, Cherry, Sprout, CloudSun, Dome as Home, User, Settings, LifeBuoy, LogOut, Menu, X, ChartBar as BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WeatherBanner } from "@/components/weather/weather-banner"
import { useAuth } from "@/components/auth/auth-provider"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/croisement", label: "Croisement", icon: Flower2 },
  { href: "/serre", label: "Serre / Semis", icon: Sprout },
  { href: "/meteo", label: "Météo & Capteurs", icon: CloudSun },
  { href: "/bilans", label: "Bilans", icon: BarChart3 },
]

const ADMIN_ITEMS = [
  { href: "/profil", label: "Profil", icon: User },
  { href: "/parametres", label: "Paramètres", icon: Settings },
  { href: "/contact", label: "Contact / Support", icon: LifeBuoy },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Flower2 className="size-8 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </div>
      </div>
    )
  }

  async function handleSignOut() {
    await signOut()
    router.push("/auth/login")
  }

  return (
    <div className="min-h-svh bg-background">
      <WeatherBanner />
      <header className="sticky top-0 z-40 border-b border-border bg-sidebar/95 backdrop-blur">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Flower2 className="size-5" />
              </span>
              <span className="font-serif text-lg text-foreground">Sélection Rosiers</span>
            </Link>
            <nav className="ml-auto hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="ml-auto flex items-center gap-1 md:ml-2">
              <div className="hidden items-center gap-1 md:flex">
                {ADMIN_ITEMS.map((item) => {
                  const active = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  )
                })}
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
                  <LogOut className="size-4" /> Déconnexion
                </Button>
              </div>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
              >
                {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </div>
          {menuOpen ? (
            <nav className="flex flex-col gap-1 border-t border-border px-4 py-3 md:hidden">
              {[...NAV_ITEMS, ...ADMIN_ITEMS].map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                )
              })}
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="mt-1 gap-1.5">
                <LogOut className="size-4" /> Déconnexion
              </Button>
            </nav>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  )
}
