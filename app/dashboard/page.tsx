"use client"

import { useState, useEffect, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import {
  getProducts,
  getTransactions,
  getDailySales,
  getMonthlySales,
  getWeeklySales,
  getYearlySales,
  getIngredients,
  getProductAvailableStock,
  verifyDataPersistence,
} from "@/lib/store"
import type { Product, Transaction } from "@/lib/types"
import { Package, ShoppingCart, TrendingUp, DollarSign } from "lucide-react"

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [ingredients, setIngredients] = useState<any[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [dailyTotal, setDailyTotal] = useState(0)
  const [weeklyTotal, setWeeklyTotal] = useState(0)
  const [monthlyTotal, setMonthlyTotal] = useState(0)
  const [yearlyTotal, setYearlyTotal] = useState(0)
  const [timeView, setTimeView] = useState<"weekly" | "monthly">("weekly")

  useEffect(() => {
    const loadData = async () => {
      const now = new Date()
      const today = now.toISOString().split("T")[0]
      const weekNumber = getWeekNumber(now)

      verifyDataPersistence()

      setProducts(getProducts())
      setIngredients(getIngredients())
      setTransactions(await getTransactions())
      setDailyTotal(await getDailySales(today))
      setWeeklyTotal(await getWeeklySales(now.getFullYear(), weekNumber))
      setMonthlyTotal(await getMonthlySales(now.getFullYear(), now.getMonth()))
      setYearlyTotal(await getYearlySales(now.getFullYear()))
    }

    loadData()
  }, [])

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  }

  const { lowStockItems } = useMemo(() => {
    const low = products.filter((p) => getProductAvailableStock(p, ingredients) < 15)
    return { lowStockItems: low }
  }, [products, ingredients])

  const statCards = [
    {
      label: "Today's Sales",
      value: `\u20B1${dailyTotal.toFixed(2)}`,
      detail: "Steady floor activity today",
      icon: DollarSign,
      tint: "from-[#bb3e00] via-[#d4661f] to-[#f7a645]",
      light: false,
    },
    {
      label: "Total Orders",
      value: String(transactions.length),
      detail: "Orders processed in the queue",
      icon: ShoppingCart,
      tint: "from-[#f7a645] via-[#efc06a] to-[#fff1d7]",
      light: true,
    },
    {
      label: "Items Sold",
      value: "30",
      detail: "Across drinks and meal categories",
      icon: Package,
      tint: "from-[#7b6f19] via-[#90832f] to-[#cabd64]",
      light: false,
    },
    {
      label: "Low Stock Items",
      value: String(lowStockItems.length),
      detail: lowStockItems.length > 0 ? `${lowStockItems[0]?.name} needs action` : "Stock levels look healthy",
      icon: TrendingUp,
      tint: "from-[#fff1d7] via-[#f4e2b6] to-[#f7a645]",
      light: true,
    },
  ]

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-hidden p-4 pt-20 lg:p-8 lg:pt-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-16 top-8 h-48 w-48 rounded-full bg-[#f7a645]/20 blur-3xl" />
          <div className="absolute right-8 top-0 h-64 w-64 rounded-full bg-[#7b6f19]/12 blur-3xl" />
          <div className="absolute bottom-12 left-1/3 h-40 w-40 rounded-full bg-[#bb3e00]/10 blur-3xl" />
        </div>

        <div className="relative mb-6 lg:mb-8">
          <div className="rounded-[28px] border border-white/55 bg-white/45 p-5 shadow-[0_24px_60px_rgba(123,111,25,0.10),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl lg:p-7">
            <div className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-[#bb3e00]/30 to-transparent" />
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.32em] text-[#7b6f19] lg:text-sm">
                  ANALYTICS OVERVIEW
                </p>
                <h1 className="mb-3 text-3xl font-bold text-[#bb3e00] lg:text-5xl">Dashboard</h1>
                <p className="max-w-2xl text-sm text-[#6d593a] lg:text-base">
                  A cleaner manager view with warm gradients, cream glass surfaces, and softer
                  micro-detail treatment built from your palette.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 lg:gap-4">
                <div className="rounded-2xl border border-white/55 bg-white/55 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm">
                  <p className="mb-1 text-[10px] tracking-[0.24em] text-[#7b6f19]">MANAGER</p>
                  <p className="text-lg font-bold text-foreground">admin</p>
                </div>

                <div className="flex gap-2 rounded-2xl border border-white/55 bg-white/55 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm">
                  <button
                    onClick={() => setTimeView("weekly")}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                      timeView === "weekly"
                        ? "bg-gradient-to-r from-[#bb3e00] to-[#f7a645] text-white shadow-[0_10px_20px_rgba(187,62,0,0.18)]"
                        : "text-foreground hover:bg-white/70"
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setTimeView("monthly")}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                      timeView === "monthly"
                        ? "bg-gradient-to-r from-[#7b6f19] to-[#b6a235] text-white shadow-[0_10px_20px_rgba(123,111,25,0.18)]"
                        : "text-foreground hover:bg-white/70"
                    }`}
                  >
                    Monthly
                  </button>
                </div>

                <div className="rounded-2xl border border-white/55 bg-white/55 px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm">
                  <p className="text-[10px] tracking-[0.24em] text-[#7b6f19]">LIVE REFRESH</p>
                  <p className="text-sm font-semibold text-foreground">
                    Updated {new Date().toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mb-6 lg:mb-8">
          <div className="relative overflow-hidden rounded-[30px] border border-[#f2d8af] bg-gradient-to-br from-[#bb3e00] via-[#d4661f] to-[#f7a645] p-6 text-white shadow-[0_28px_70px_rgba(187,62,0,0.22)] lg:p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
            <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full border border-white/15 bg-white/10 blur-[1px]" />
            <div className="absolute right-16 top-16 h-20 w-20 rounded-full border border-white/15 bg-white/10" />
            <div className="absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-black/10 to-transparent" />

            <div className="relative z-10">
              <div className="mb-6 flex items-start justify-between gap-6">
                <div>
                  <p className="mb-2 text-sm uppercase tracking-[0.28em] text-white/75">
                    {timeView === "weekly" ? "Weekly Revenue" : "Monthly Revenue"}
                  </p>
                  <p className="text-4xl font-bold lg:text-6xl">
                    {`\u20B1${(timeView === "weekly" ? weeklyTotal : monthlyTotal).toFixed(2)}`}
                  </p>
                  <p className="mt-3 max-w-md text-sm text-white/75">
                    Revenue is framed with gradient depth, glass overlays, and restrained
                    highlights instead of flat solid fills.
                  </p>
                </div>

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/15 backdrop-blur-sm lg:h-16 lg:w-16">
                  <TrendingUp className="h-7 w-7 lg:h-8 lg:w-8" />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/15 bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/65">Daily</p>
                  <p className="mt-2 text-xl font-semibold">{`\u20B1${dailyTotal.toFixed(2)}`}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/65">Monthly</p>
                  <p className="mt-2 text-xl font-semibold">{`\u20B1${monthlyTotal.toFixed(2)}`}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/65">Yearly</p>
                  <p className="mt-2 text-xl font-semibold">{`\u20B1${yearlyTotal.toFixed(2)}`}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:mb-8 lg:gap-4">
          {statCards.map((card) => {
            const Icon = card.icon

            return (
              <div
                key={card.label}
                className={`group relative overflow-hidden rounded-[24px] border border-white/55 bg-gradient-to-br ${card.tint} p-[1px] shadow-[0_18px_36px_rgba(123,111,25,0.10)]`}
              >
                <div
                  className={`relative h-full rounded-[23px] p-5 backdrop-blur-sm lg:p-6 ${
                    card.light ? "bg-[#fff8eb]/88 text-[#4f320f]" : "bg-[rgba(255,255,255,0.14)] text-white"
                  }`}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-white/45" />
                  <div
                    className={`absolute -right-6 -top-6 h-20 w-20 rounded-full ${
                      card.light ? "bg-white/35" : "bg-white/10"
                    } blur-sm transition-transform duration-300 group-hover:scale-110`}
                  />

                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className={`mb-1 text-sm ${card.light ? "text-[#7b6f19]" : "text-white/75"}`}>
                        {card.label}
                      </p>
                      <p className="text-2xl font-bold lg:text-3xl">{card.value}</p>
                      <p className={`mt-3 text-xs leading-5 ${card.light ? "text-[#7a6748]" : "text-white/70"}`}>
                        {card.detail}
                      </p>
                    </div>

                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
                        card.light
                          ? "border-[#f7a645]/30 bg-white/55 text-[#bb3e00]"
                          : "border-white/15 bg-white/12 text-white"
                      } backdrop-blur-sm`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="rounded-[28px] border border-white/55 bg-white/52 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl lg:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground lg:text-lg">Recent Transactions</h2>
              <span className="rounded-full bg-[#f5e5c2] px-3 py-1 text-xs font-medium text-[#7b6f19]">
                Latest 5
              </span>
            </div>

            {transactions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground lg:py-8 lg:text-base">
                No transactions yet
              </p>
            ) : (
              <div className="space-y-2 lg:space-y-3">
                {transactions.slice(-5).reverse().map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-2xl border border-white/55 bg-white/55 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium lg:text-base">{t.id}</p>
                      <p className="truncate text-xs text-muted-foreground lg:text-sm">
                        {t.date} {t.time}
                      </p>
                    </div>
                    <p className="ml-2 text-sm font-bold text-[#bb3e00] lg:text-base">
                      {`\u20B1${t.total.toFixed(2)}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-white/55 bg-white/52 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl lg:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground lg:text-lg">Low Stock Items</h2>
              <span className="rounded-full bg-[#f5e5c2] px-3 py-1 text-xs font-medium text-[#7b6f19]">
                Monitor
              </span>
            </div>

            {lowStockItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground lg:py-8 lg:text-base">
                All items are well stocked
              </p>
            ) : (
              <div className="space-y-2 lg:space-y-3">
                {lowStockItems.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-2xl border border-white/55 bg-white/55 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium lg:text-base">{p.name}</p>
                      <p className="text-xs text-muted-foreground lg:text-sm">{p.category}</p>
                    </div>
                    <span className="ml-2 flex-shrink-0 rounded-full bg-[#fff1d7] px-2 py-1 text-xs font-medium text-[#bb3e00] lg:px-3 lg:text-sm">
                      {getProductAvailableStock(p, ingredients)} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

