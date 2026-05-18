"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  OFFLINE_SYNC_STATUS_EVENT,
  getOfflineSyncStatus,
  readOfflineSnapshot,
  type OfflineSyncStatus,
} from "@/lib/offline-sync"
import {
  flushOfflineSyncQueue,
  getCurrentUser,
  getIngredientExpirationSummary,
  getIngredients,
  getInventoryAlerts,
  getProductAvailableStock,
  getProducts,
  getTransactions,
  initializeSupabaseStore,
} from "@/lib/store"
import type { Ingredient, Product, Transaction } from "@/lib/types"
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Cloud,
  CloudOff,
  DatabaseZap,
  LineChart,
  Package,
  PieChart as PieChartIcon,
  RefreshCw,
  ShieldCheck,
  TimerReset,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Line, Pie, PieChart, XAxis, YAxis } from "recharts"

type SnapshotBundle = {
  products: Product[]
  ingredients: Ingredient[]
  transactions: Transaction[]
}

type SalesTrendPoint = {
  date: string
  label: string
  revenue: number
  orders: number
}

type PaymentMixPoint = {
  name: "cash" | "gcash"
  value: number
  fill: string
}

type PeakHourPoint = {
  hour: string
  transactions: number
  fill: string
}

type InventoryPressurePoint = {
  ingredient: Ingredient
  usableStock: number
}

type DashboardInsights = {
  todaySales: number
  todayTransactions: number
  lowStockCount: number
  atRiskProducts: number
  queueDetail: string
  recentTransactions: Transaction[]
  inventoryPressure: InventoryPressurePoint[]
  salesTrendData: SalesTrendPoint[]
  paymentMixData: PaymentMixPoint[]
  peakHoursData: PeakHourPoint[]
  bestProductLabel: string
  averageTicket: number
}

const salesTrendChartConfig = {
  revenue: { label: "Revenue", color: "#4a342a" },
  orders: { label: "Orders", color: "#7d5a44" },
} satisfies ChartConfig

const paymentMixChartConfig = {
  cash: { label: "Cash", color: "#4a342a" },
  gcash: { label: "GCash", color: "#b2967d" },
} satisfies ChartConfig

const peakHoursChartConfig = {
  transactions: { label: "Transactions", color: "#7d5a44" },
} satisfies ChartConfig

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value)
}

function formatSyncTime(value: number | null) {
  if (!value) return "Not synced yet"
  return new Date(value).toLocaleTimeString()
}

function formatPaymentMethod(value: Transaction["paymentMethod"]) {
  return value === "gcash" ? "GCash" : "Cash"
}

function getTransactionItemTotal(item: Transaction["items"][number]) {
  const addOnTotal = (item.addOns || []).reduce((sum, addOn) => sum + addOn.price * (addOn.selectedQuantity || 1), 0)
  const basePrice = item.comboMeal ? item.comboMeal.price : item.product.price
  return (basePrice + addOnTotal) * item.quantity
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <article className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.72)] backdrop-blur-xl">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#7d5a44]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[#4a342a]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#7d5a44]">{detail}</p>
    </article>
  )
}

function MetricCardSkeleton() {
  return (
    <article className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.72)] backdrop-blur-xl">
      <Skeleton className="h-3 w-24 rounded-full bg-[#e8dbd1]" />
      <Skeleton className="mt-3 h-10 w-28 rounded-2xl bg-[#e5d8cc]" />
      <Skeleton className="mt-3 h-4 w-full rounded-full bg-[#f0e7df]" />
    </article>
  )
}

function ChartPanelSkeleton() {
  return (
    <article className="rounded-[30px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.72)] backdrop-blur-xl">
      <Skeleton className="h-3 w-24 rounded-full bg-[#e8dbd1]" />
      <Skeleton className="mt-3 h-8 w-64 rounded-2xl bg-[#e5d8cc]" />
      <Skeleton className="mt-4 h-64 w-full rounded-[24px] bg-[#f2ebe4]" />
    </article>
  )
}

function StatusPill({ status }: { status: OfflineSyncStatus }) {
  const isOffline = !status.isOnline

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
        isOffline
          ? "border-[#d7c9b8] bg-[#d7c9b8]/60 text-[#7d5a44]"
          : "border-[#f5f1ea]/55 bg-[#f5f1ea]/70 text-[#7d5a44]"
      }`}
    >
      {isOffline ? <CloudOff className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
      {isOffline ? "Offline mode" : status.isSyncing ? "Syncing now" : "Server linked"}
    </div>
  )
}

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [username, setUsername] = useState("Operator")
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  const applySnapshot = useCallback((snapshot: SnapshotBundle) => {
    setProducts(snapshot.products)
    setIngredients(snapshot.ingredients)
    setTransactions(snapshot.transactions)
  }, [])

  const hydrateFromIndexedDb = useCallback(async () => {
    const [cachedProducts, cachedIngredients, cachedTransactions] = await Promise.all([
      readOfflineSnapshot<Product[]>("products"),
      readOfflineSnapshot<Ingredient[]>("ingredients"),
      readOfflineSnapshot<Transaction[]>("transactions"),
    ])

    if (!cachedProducts && !cachedIngredients && !cachedTransactions) return false

    applySnapshot({
      products: cachedProducts || [],
      ingredients: cachedIngredients || [],
      transactions: cachedTransactions || [],
    })

    setLoading(false)
    return true
  }, [applySnapshot])

  const refreshDashboard = useCallback(async (background = false) => {
    if (background) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      await initializeSupabaseStore()
      await flushOfflineSyncQueue()

      const [nextTransactions, nextStatus] = await Promise.all([
        getTransactions(),
        getOfflineSyncStatus(),
      ])

      applySnapshot({
        products: getProducts(),
        ingredients: getIngredients(),
        transactions: nextTransactions,
      })

      setSyncStatus(nextStatus)
      setLastLoadedAt(Date.now())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [applySnapshot])

  useEffect(() => {
    const user = getCurrentUser()
    setUsername(user?.username || "Operator")

    void (async () => {
      const [warmed, status] = await Promise.all([hydrateFromIndexedDb(), getOfflineSyncStatus()])
      setSyncStatus(status)
      if (warmed) {
        void refreshDashboard(true)
        return
      }
      void refreshDashboard()
    })()
  }, [hydrateFromIndexedDb, refreshDashboard])

  useEffect(() => {
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<OfflineSyncStatus>).detail
      setSyncStatus(detail)
    }

    window.addEventListener(OFFLINE_SYNC_STATUS_EVENT, handleStatus)
    return () => window.removeEventListener(OFFLINE_SYNC_STATUS_EVENT, handleStatus)
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshDashboard(true)
    }, 60000)

    return () => window.clearInterval(intervalId)
  }, [refreshDashboard])

  const todayKey = new Date().toISOString().split("T")[0]

  const {
    todaySales,
    todayTransactions,
    lowStockCount,
    atRiskProducts,
    queueDetail,
    recentTransactions,
    inventoryPressure,
    salesTrendData,
    paymentMixData,
    peakHoursData,
    bestProductLabel,
    averageTicket,
  } =
    useMemo<DashboardInsights>(() => {
      const alerts = getInventoryAlerts(ingredients, { lowStockThreshold: 10, expiringThresholdDays: 3 })
      const filteredTransactions = transactions.filter((transaction) => !transaction.voided)
      const todaysTransactions = filteredTransactions.filter((transaction) => transaction.date === todayKey)
      const todaySalesTotal = todaysTransactions.reduce((sum, transaction) => sum + transaction.total, 0)
      const riskyProducts = products.filter((product) => getProductAvailableStock(product, ingredients) < 10)
      const pressure: InventoryPressurePoint[] = ingredients
        .map((ingredient) => ({
          ingredient,
          usableStock: getIngredientExpirationSummary(ingredient).usableStock,
        }))
        .sort((left, right) => left.usableStock - right.usableStock)
        .slice(0, 5)
      const salesByDay = new Map<string, { revenue: number; orders: number }>()
      const productSales = new Map<string, number>()
      const paymentMix = new Map<"cash" | "gcash", number>([
        ["cash", 0],
        ["gcash", 0],
      ])
      const peakHours = new Map<number, number>()

      for (let offset = 6; offset >= 0; offset -= 1) {
        const date = new Date()
        date.setDate(date.getDate() - offset)
        const key = date.toISOString().split("T")[0]
        salesByDay.set(key, { revenue: 0, orders: 0 })
      }

      filteredTransactions.forEach((transaction) => {
        const currentDay = salesByDay.get(transaction.date) || { revenue: 0, orders: 0 }
        currentDay.revenue += transaction.total
        currentDay.orders += 1
        salesByDay.set(transaction.date, currentDay)

        paymentMix.set(transaction.paymentMethod, (paymentMix.get(transaction.paymentMethod) || 0) + transaction.total)

        const hour = Number(transaction.time.split(":")[0] || 0)
        peakHours.set(hour, (peakHours.get(hour) || 0) + 1)

        transaction.items.forEach((item) => {
          productSales.set(item.product.name, (productSales.get(item.product.name) || 0) + item.quantity)
        })
      })

      const salesTrend: SalesTrendPoint[] = Array.from(salesByDay.entries()).map(([date, values]) => ({
        date,
        label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: Number(values.revenue.toFixed(2)),
        orders: values.orders,
      }))

      const paymentData: PaymentMixPoint[] = Array.from(paymentMix.entries())
        .filter(([, value]) => value > 0)
        .map(([key, value]) => ({
          name: key,
          value: Number(value.toFixed(2)),
          fill: key === "cash" ? "#4a342a" : "#b2967d",
        }))

      const highestHour = Math.max(...Array.from(peakHours.values()), 1)
      const hourlyData: PeakHourPoint[] = Array.from({ length: 8 }, (_, index) => {
        const hour = 8 + index
        const count = peakHours.get(hour) || 0
        return {
          hour: `${String(hour).padStart(2, "0")}:00`,
          transactions: count,
          fill: count === highestHour ? "#4a342a" : "#b2967d",
        }
      })

      const bestProduct = Array.from(productSales.entries()).sort((left, right) => right[1] - left[1])[0]

      return {
        todaySales: todaySalesTotal,
        todayTransactions: todaysTransactions.length,
        lowStockCount: alerts.lowStockIngredients.length + alerts.expiringSoonIngredients.length + alerts.expiredIngredients.length,
        atRiskProducts: riskyProducts.length,
        queueDetail:
          syncStatus.pendingCount === 0
            ? "All local changes are already mirrored to the secured server."
            : `${syncStatus.pendingCount} cached update${syncStatus.pendingCount === 1 ? "" : "s"} waiting for upload.`,
        recentTransactions: filteredTransactions.slice(0, 6),
        inventoryPressure: pressure,
        salesTrendData: salesTrend,
        paymentMixData: paymentData,
        peakHoursData: hourlyData,
        bestProductLabel: bestProduct ? `${bestProduct[0]} (${bestProduct[1]})` : "No sales yet",
        averageTicket: todaysTransactions.length > 0 ? todaySalesTotal / todaysTransactions.length : 0,
      }
    }, [ingredients, products, syncStatus.pendingCount, todayKey, transactions])

  const showSkeletons = loading && products.length === 0 && ingredients.length === 0 && transactions.length === 0

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-hidden p-4 pt-20 lg:p-6 lg:pt-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(125,90,68,0.16),transparent_58%)]" />
          <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-[#d9c4b2]/20 blur-3xl" />
          <div className="absolute left-12 bottom-10 h-64 w-64 rounded-full bg-[#ebe2d8]/45 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl space-y-4">
          <section className="rounded-[36px] border border-[#ebe2d8] bg-[linear-gradient(135deg,rgba(255,252,249,0.92),rgba(244,236,229,0.84))] p-6 shadow-[0_28px_70px_rgba(51,38,29,0.08)] backdrop-blur-xl lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill status={syncStatus} />
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    IndexedDB cache active
                  </div>
                </div>
                <h1 className="mt-5 text-4xl font-semibold tracking-[-0.08em] text-[#4a342a] lg:text-[3.6rem]">
                  Dashboard
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[#7d5a44]">
                  {username}, this dashboard keeps sales and stock work moving locally, caches every mutation in IndexedDB,
                  and pushes queued updates to the secured server the moment connectivity returns.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 p-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Pending uploads</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-[#4a342a]">{syncStatus.pendingCount}</p>
                  <p className="mt-2 text-sm leading-6 text-[#7d5a44]">{queueDetail}</p>
                </div>
                <div className="rounded-[24px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 p-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Last server sync</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-[#4a342a]">{formatSyncTime(syncStatus.lastSyncedAt)}</p>
                  <p className="mt-2 text-sm leading-6 text-[#7d5a44]">
                    {syncStatus.lastError ? syncStatus.lastError : refreshing ? "Refreshing in background." : "Connection state is being watched live."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/pos"
                className="inline-flex items-center gap-2 rounded-full bg-[#4a342a] px-5 py-3 text-sm font-semibold text-[#f5f1ea] transition-colors hover:bg-[#7d5a44]"
              >
                Open POS
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="/inventory"
                className="inline-flex items-center gap-2 rounded-full border border-[#b2967d] bg-[#f5f1ea]/80 px-5 py-3 text-sm font-semibold text-[#4a342a] transition-colors hover:bg-[#ede3d8]"
              >
                Review inventory
                <Boxes className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => void refreshDashboard(true)}
                className="inline-flex items-center gap-2 rounded-full border border-[#b2967d] bg-[#f5f1ea]/80 px-5 py-3 text-sm font-semibold text-[#4a342a] transition-colors hover:bg-[#ede3d8]"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Sync now
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {showSkeletons ? (
              <>
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
              </>
            ) : (
              <>
                <MetricCard label="Today sales" value={formatCurrency(todaySales)} detail={`${todayTransactions} completed transactions cached locally and mirrored when possible.`} />
                <MetricCard label="Queue depth" value={String(syncStatus.pendingCount)} detail={syncStatus.isOnline ? "Queued writes will flush immediately." : "Writes are safely held until the network returns."} />
                <MetricCard label="Best seller" value={bestProductLabel} detail="Top product by quantity sold across cached and synced transactions." />
                <MetricCard label="Avg ticket" value={formatCurrency(averageTicket)} detail={`${lowStockCount} inventory alerts and ${atRiskProducts} products currently at risk.`} />
              </>
            )}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            {showSkeletons ? (
              <>
                <ChartPanelSkeleton />
                <ChartPanelSkeleton />
              </>
            ) : (
              <>
                <article className="rounded-[30px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#7d5a44]">Business chart</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#4a342a]">7-day sales and order performance</h2>
                    </div>
                    <LineChart className="h-5 w-5 text-[#6f5d53]" />
                  </div>

                  <div className="mt-5 rounded-[24px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-3">
                    <ChartContainer config={salesTrendChartConfig} className="h-[320px] w-full">
                      <BarChart data={salesTrendData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#d7c9b8" strokeDasharray="3 3" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                        <YAxis yAxisId="revenue" tickLine={false} axisLine={false} width={42} />
                        <YAxis yAxisId="orders" orientation="right" tickLine={false} axisLine={false} width={30} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, name) => (
                                <div className="flex min-w-[140px] items-center justify-between gap-3">
                                  <span>{name}</span>
                                  <span className="font-mono font-semibold">
                                    {name === "Revenue" ? formatCurrency(Number(value)) : Number(value).toLocaleString()}
                                  </span>
                                </div>
                              )}
                            />
                          }
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar yAxisId="revenue" dataKey="revenue" radius={[10, 10, 0, 0]} fill="var(--color-revenue)" />
                        <Line yAxisId="orders" type="monotone" dataKey="orders" stroke="var(--color-orders)" strokeWidth={2.5} dot={{ r: 3 }} />
                      </BarChart>
                    </ChartContainer>
                  </div>
                </article>

                <article className="rounded-[30px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#7d5a44]">Revenue mix</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#4a342a]">Cash vs GCash sales share</h2>
                    </div>
                    <PieChartIcon className="h-5 w-5 text-[#6f5d53]" />
                  </div>

                  <div className="mt-5 rounded-[24px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-3">
                    {paymentMixData.length === 0 ? (
                      <div className="flex h-[320px] items-center justify-center text-sm text-[#7a6c62]">
                        Payment mix will appear after transactions are processed.
                      </div>
                    ) : (
                      <ChartContainer config={paymentMixChartConfig} className="h-[320px] w-full">
                        <PieChart>
                          <Pie data={paymentMixData} dataKey="value" nameKey="name" innerRadius={72} outerRadius={104} paddingAngle={4}>
                            {paymentMixData.map((entry) => (
                              <Cell key={entry.name} fill={entry.fill} />
                            ))}
                          </Pie>
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                nameKey="name"
                                formatter={(value, name) => (
                                  <div className="flex min-w-[120px] items-center justify-between gap-3">
                                    <span>{name}</span>
                                    <span className="font-mono font-semibold">{formatCurrency(Number(value))}</span>
                                  </div>
                                )}
                              />
                            }
                          />
                          <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                        </PieChart>
                      </ChartContainer>
                    )}
                  </div>
                </article>
              </>
            )}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[30px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#7d5a44]">Sync channel</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#4a342a]">Offline cache and upload state</h2>
                </div>
                <DatabaseZap className="h-5 w-5 text-[#6f5d53]" />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-[22px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Transport</p>
                  <p className="mt-2 text-lg font-semibold text-[#4a342a]">{syncStatus.isOnline ? "Online" : "Offline"}</p>
                  <p className="mt-2 text-sm text-[#7d5a44]">The dashboard watches browser connectivity continuously.</p>
                </div>
                <div className="rounded-[22px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Queue state</p>
                  <p className="mt-2 text-lg font-semibold text-[#4a342a]">{syncStatus.isSyncing ? "Flushing" : "Stable"}</p>
                  <p className="mt-2 text-sm text-[#7d5a44]">Products, ingredients, and transactions are persisted before upload attempts.</p>
                </div>
                <div className="rounded-[22px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Snapshot loaded</p>
                  <p className="mt-2 text-lg font-semibold text-[#4a342a]">{lastLoadedAt ? new Date(lastLoadedAt).toLocaleTimeString() : "--:--:--"}</p>
                  <p className="mt-2 text-sm text-[#7d5a44]">Warm starts come from IndexedDB even when the network is unavailable.</p>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-dashed border-[#d7c9b8] bg-[#f5f1ea]/70 p-4">
                <div className="flex items-center gap-3">
                  <Activity className="h-4 w-4 text-[#7d5a44]" />
                  <p className="text-sm font-medium text-[#4a342a]">
                    {syncStatus.pendingCount === 0
                      ? "Local cache and server are aligned."
                      : `${syncStatus.pendingCount} update${syncStatus.pendingCount === 1 ? "" : "s"} are still pending upload.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#7d5a44]">Performance monitoring</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#4a342a]">Peak-hour throughput</h2>
                </div>
                <TimerReset className="h-5 w-5 text-[#6f5d53]" />
              </div>

              <div className="mt-5 rounded-[24px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-3">
                {showSkeletons ? (
                  <ChartPanelSkeleton />
                ) : (
                  <ChartContainer config={peakHoursChartConfig} className="h-[320px] w-full">
                    <BarChart data={peakHoursData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#d7c9b8" strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={28} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="transactions" radius={[10, 10, 0, 0]}>
                        {peakHoursData.map((entry) => (
                          <Cell key={entry.hour} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[30px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#7d5a44]">Recent sales</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#4a342a]">Transactions processed locally first</h2>
                </div>
                <Package className="h-5 w-5 text-[#6f5d53]" />
              </div>

              <div className="mt-5 space-y-3">
                {showSkeletons ? (
                  <>
                    <MetricCardSkeleton />
                    <MetricCardSkeleton />
                  </>
                ) : recentTransactions.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-10 text-center text-sm text-[#7d5a44]">
                    No transactions have been recorded yet.
                  </div>
                ) : (
                  recentTransactions.map((transaction) => (
                    <button
                      key={transaction.id}
                      type="button"
                      onClick={() => setSelectedTransaction(transaction)}
                      className="flex w-full items-center justify-between gap-3 rounded-[22px] border border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-4 text-left transition-colors hover:bg-[#ede3d8]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[#4a342a]">{transaction.id}</p>
                        <p className="truncate text-sm text-[#7d5a44]">
                          {transaction.date} {transaction.time} • {transaction.processedBy}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#4a342a] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#f5f1ea]">
                        {formatCurrency(transaction.total)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[30px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#7d5a44]">Inventory pressure</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#4a342a]">Ingredients closest to blocking service</h2>
                </div>
                <BarChart3 className="h-5 w-5 text-[#6f5d53]" />
              </div>

              <div className="mt-5 space-y-3">
                {showSkeletons ? (
                  <>
                    <MetricCardSkeleton />
                    <MetricCardSkeleton />
                  </>
                ) : inventoryPressure.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-10 text-center text-sm text-[#7d5a44]">
                    No ingredient pressure detected right now.
                  </div>
                ) : (
                  inventoryPressure.map(({ ingredient, usableStock }) => (
                    <div key={ingredient.id} className="flex items-center justify-between gap-3 rounded-[22px] border border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[#4a342a]">{ingredient.name}</p>
                        <p className="truncate text-sm text-[#7d5a44]">{ingredient.unit} • usable stock snapshot from IndexedDB and local cache</p>
                      </div>
                      <span className="rounded-full border border-[#b2967d] bg-[#f5f1ea] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#4a342a]">
                        {usableStock} left
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[30px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#7d5a44]">Operating notes</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#4a342a]">What this dashboard guarantees</h2>

              <div className="mt-5 space-y-3">
                {[
                  "Transactions are persisted locally before the server upload completes, so checkout can continue offline.",
                  "Inventory and product edits are written to local state and mirrored into IndexedDB for fast dashboard warm starts.",
                  "Queued writes flush automatically on reconnect and can also be pushed manually from this page.",
                ].map((item) => (
                  <div key={item} className="rounded-[22px] border border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-4 text-sm leading-7 text-[#7d5a44]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <Dialog open={Boolean(selectedTransaction)} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden border border-[#f5f1ea]/55 bg-[#f5f1ea] text-[#4a342a] shadow-[0_24px_48px_rgba(123,111,25,0.1)]">
            {selectedTransaction ? (
              <>
                <DialogHeader>
                  <DialogTitle>Past Order Details</DialogTitle>
                  <DialogDescription>
                    {selectedTransaction.id} - {selectedTransaction.date} {selectedTransaction.time}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-4">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Processed by</p>
                    <p className="mt-2 text-sm font-semibold text-[#4a342a]">{selectedTransaction.processedBy}</p>
                  </div>
                  <div className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-4">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Payment</p>
                    <p className="mt-2 text-sm font-semibold text-[#4a342a]">{formatPaymentMethod(selectedTransaction.paymentMethod)}</p>
                  </div>
                  <div className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-4">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Total</p>
                    <p className="mt-2 text-sm font-semibold text-[#4a342a]">{formatCurrency(selectedTransaction.total)}</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[24px] border border-[#d7c9b8] bg-[#f5f1ea]/70">
                  <div className="border-b border-[#d7c9b8] px-4 py-3">
                    <p className="text-sm font-semibold text-[#4a342a]">Order Items</p>
                  </div>
                  <div className="max-h-[44vh] space-y-3 overflow-y-auto px-4 py-4">
                    {selectedTransaction.items.map((item, index) => (
                      <div key={`${selectedTransaction.id}-${item.product.id}-${index}`} className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#4a342a]">
                              {item.product.name}
                              {item.temperature ? ` (${item.temperature})` : ""}
                            </p>
                            <p className="mt-1 text-sm text-[#7d5a44]">Quantity: {item.quantity}</p>
                            {item.comboMeal ? <p className="mt-1 text-sm text-[#7d5a44]">Combo meal order</p> : null}
                          </div>
                          <span className="rounded-full bg-[#4a342a] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#f5f1ea]">
                            {formatCurrency(getTransactionItemTotal(item))}
                          </span>
                        </div>

                        {item.addOns && item.addOns.length > 0 ? (
                          <div className="mt-3 space-y-1">
                            {item.addOns.map((addOn) => (
                              <p key={`${item.product.id}-${addOn.id}`} className="text-sm text-[#7d5a44]">
                                + {addOn.name} x{addOn.selectedQuantity || 1}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-4">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Subtotal</p>
                    <p className="mt-2 text-sm font-semibold text-[#4a342a]">{formatCurrency(selectedTransaction.subtotal)}</p>
                  </div>
                  <div className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-4">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Discount</p>
                    <p className="mt-2 text-sm font-semibold text-[#4a342a]">{formatCurrency(selectedTransaction.discountAmount || 0)}</p>
                  </div>
                  <div className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-4">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Cash received</p>
                    <p className="mt-2 text-sm font-semibold text-[#4a342a]">{formatCurrency(selectedTransaction.cashReceived)}</p>
                  </div>
                  <div className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-4">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Change</p>
                    <p className="mt-2 text-sm font-semibold text-[#4a342a]">{formatCurrency(selectedTransaction.change)}</p>
                  </div>
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
