"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  getCurrentUser,
  getIngredients,
  getIngredientExpirationSummary,
  getInventoryAlerts,
  getProductAvailableStock,
  getProducts,
  getSalesTotalByDateRange,
  getTopProducts,
  getTransactionsByDateRange,
  getUserRole,
  initializeSupabaseStore,
  verifyDataPersistence,
  type UserRole,
} from "@/lib/store"
import type { Ingredient, Product, Transaction } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarRange,
  ClipboardList,
  Crown,
  DollarSign,
  Leaf,
  Package,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react"

type DashboardSnapshot = {
  products: Product[]
  ingredients: Ingredient[]
  transactions: Transaction[]
  rangeTotal: number
  topSeller: string
  lastUpdatedLabel: string
  cachedAt: number
}

const DASHBOARD_CACHE_PREFIX = "alfresco_dashboard_snapshot"
const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000

function getDefaultRange() {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 6)

  return {
    fromDate: startDate.toISOString().split("T")[0],
    toDate: endDate.toISOString().split("T")[0],
  }
}

function getDashboardCacheKey(role: UserRole, fromDate: string, toDate: string) {
  return `${DASHBOARD_CACHE_PREFIX}:${role}:${fromDate}:${toDate}`
}

function readDashboardCache(role: UserRole, fromDate: string, toDate: string): DashboardSnapshot | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(getDashboardCacheKey(role, fromDate, toDate))
    if (!raw) return null

    const parsed = JSON.parse(raw) as DashboardSnapshot
    if (Date.now() - parsed.cachedAt > DASHBOARD_CACHE_TTL_MS) return null

    return parsed
  } catch {
    return null
  }
}

function writeDashboardCache(role: UserRole, fromDate: string, toDate: string, snapshot: DashboardSnapshot) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(getDashboardCacheKey(role, fromDate, toDate), JSON.stringify(snapshot))
  } catch {
    // Ignore local cache write failures
  }
}

function formatRoleLabel(role: UserRole) {
  switch (role) {
    case "admin":
      return "Admin"
    case "inventory_staff":
      return "Manager"
    default:
      return "Staff"
  }
}

function getRoleConfig(role: UserRole) {
  switch (role) {
    case "admin":
      return {
        icon: Crown,
        badge: "Executive View",
        title: "Command the full cafe operation",
        description: "Monitor sales, staffing, stock health, and access control from one focused control surface.",
        gradient: "from-[#4a342a] via-[#7d5a44] to-[#b2967d]",
        panelTone: "from-[#3b2a22]/98 via-[#5c4336]/94 to-[#87654f]/88",
        quickLinks: [
          { href: "/user-management", label: "Manage team access", detail: "Create accounts and adjust permissions", icon: Users },
          { href: "/sales-history", label: "Review sales reports", detail: "Track revenue and trend movement", icon: ReceiptText },
          { href: "/inventory", label: "Inspect inventory", detail: "Catch stock risk before it slows service", icon: Boxes },
        ],
      }
    case "inventory_staff":
      return {
        icon: ShieldCheck,
        badge: "Operations View",
        title: "Keep stock, prep, and products in sync",
        description: "Watch ingredient pressure points, expiring batches, and menu readiness with a cleaner operational dashboard.",
        gradient: "from-[#5a4134] via-[#8a6a55] to-[#d7c9b8]",
        panelTone: "from-[#463227]/98 via-[#6b4f3e]/94 to-[#9a775f]/88",
        quickLinks: [
          { href: "/inventory", label: "Update inventory", detail: "Restock, audit, and reconcile availability", icon: Package },
          { href: "/ingredients", label: "Manage ingredients", detail: "Adjust item-level supply details", icon: Leaf },
          { href: "/expiration-logs", label: "Review expiry logs", detail: "Prevent spoilage and service gaps", icon: AlertTriangle },
        ],
      }
    default:
      return {
        icon: Sparkles,
        badge: "Frontline View",
        title: "Stay ready for the next rush",
        description: "See the sales pulse, top movers, and checkout shortcuts without leaving the floor-focused workflow.",
        gradient: "from-[#6a4b3a] via-[#9a7258] to-[#d7c4ae]",
        panelTone: "from-[#523a2c]/98 via-[#7a5945]/94 to-[#a77e61]/88",
        quickLinks: [
          { href: "/pos", label: "Open checkout", detail: "Jump straight into current orders", icon: ShoppingCart },
          { href: "/sales-history", label: "Check recent sales", detail: "Review completed transactions quickly", icon: ReceiptText },
          { href: "/settings", label: "Update preferences", detail: "Keep your station set up your way", icon: ClipboardList },
        ],
      }
  }
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  icon: typeof DollarSign
}) {
  return (
    <article className="rounded-[22px] border border-white/45 bg-[rgba(255,251,247,0.78)] p-4 shadow-[0_18px_36px_rgba(60,42,31,0.06)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8b7a6e]">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#1f1916] lg:text-[1.75rem]">{value}</p>
          <p className="mt-2 max-w-[16rem] text-[0.8rem] leading-5 text-[#72645a]">{detail}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e4d7cc] bg-white/80 text-[#54443a]">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </article>
  )
}

function StatCardSkeleton() {
  return (
    <article className="rounded-[22px] border border-white/45 bg-[rgba(255,251,247,0.78)] p-4 shadow-[0_18px_36px_rgba(60,42,31,0.06)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-3 w-28 rounded-full bg-[#e9ddd3]" />
          <Skeleton className="mt-3 h-8 w-24 rounded-xl bg-[#e5d8cc]" />
          <Skeleton className="mt-2 h-4 w-40 rounded-full bg-[#eee4db]" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl bg-[#ece1d7]" />
      </div>
    </article>
  )
}

function PanelSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="rounded-[24px] border border-[#ebdfd5] bg-white/78 px-4 py-4">
          <Skeleton className="h-4 w-32 rounded-full bg-[#e8dbd1]" />
          <Skeleton className="mt-3 h-3 w-44 rounded-full bg-[#f0e7de]" />
        </div>
      ))}
    </div>
  )
}

function ChartPanelSkeleton() {
  return (
    <div className="rounded-[24px] border border-white/45 bg-[rgba(255,251,247,0.78)] p-4 shadow-[0_18px_36px_rgba(60,42,31,0.06)] backdrop-blur-xl lg:p-5">
      <Skeleton className="h-3 w-28 rounded-full bg-[#e8dbd1]" />
      <Skeleton className="mt-2 h-6 w-44 rounded-xl bg-[#e5d8cc]" />
      <Skeleton className="mt-3 h-12 w-full rounded-[18px] bg-[#f2e9e1]" />
      <Skeleton className="mt-3 h-[180px] w-full rounded-[20px] bg-[#f1e7de]" />
    </div>
  )
}

function InlineMetric({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "accent"
}) {
  return (
    <div
      className={`rounded-xl border px-2.5 py-2 ${
        tone === "accent"
          ? "border-[#d8c7b8] bg-[#f3ece5] text-[#4a342a]"
          : "border-[#eadfd6] bg-white/72 text-[#5f4f45]"
      }`}
    >
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#8d7d71]">{label}</p>
      <p className="mt-1 text-[0.82rem] font-semibold tracking-[-0.02em]">{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const defaults = getDefaultRange()
  const [products, setProducts] = useState<Product[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [rangeTotal, setRangeTotal] = useState(0)
  const [fromDate, setFromDate] = useState(defaults.fromDate)
  const [toDate, setToDate] = useState(defaults.toDate)
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState("--:--:--")
  const [topSeller, setTopSeller] = useState("No sales yet")
  const [userRole, setUserRole] = useState<UserRole>("cashier")
  const [username, setUsername] = useState("User")
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasWarmCache, setHasWarmCache] = useState(false)

  const applySnapshot = useCallback((snapshot: DashboardSnapshot) => {
    setProducts(snapshot.products)
    setIngredients(snapshot.ingredients)
    setTransactions(snapshot.transactions)
    setRangeTotal(snapshot.rangeTotal)
    setTopSeller(snapshot.topSeller)
    setLastUpdatedLabel(snapshot.lastUpdatedLabel)
  }, [])

  const buildSnapshot = useCallback(async (): Promise<DashboardSnapshot | null> => {
    const startDate = new Date(fromDate)
    const endDate = new Date(toDate)
    if (startDate > endDate) return null

    verifyDataPersistence()
    await initializeSupabaseStore()

    const [transactionsInRange, salesTotal, topProducts] = await Promise.all([
      getTransactionsByDateRange(fromDate, toDate),
      getSalesTotalByDateRange(fromDate, toDate),
      getTopProducts(startDate, endDate, 1),
    ])

    return {
      products: getProducts(),
      ingredients: getIngredients(),
      transactions: transactionsInRange,
      rangeTotal: salesTotal,
      topSeller: topProducts[0]?.name || "No sales yet",
      lastUpdatedLabel: new Date().toLocaleTimeString(),
      cachedAt: Date.now(),
    }
  }, [fromDate, toDate])

  const loadDashboardData = useCallback(
    async (options?: { background?: boolean }) => {
      const background = options?.background ?? false

      if (background) {
        setIsRefreshing(true)
      } else {
        setIsInitialLoading(true)
      }

      try {
        const snapshot = await buildSnapshot()
        if (!snapshot) return

        applySnapshot(snapshot)
        writeDashboardCache(userRole, fromDate, toDate, snapshot)
      } finally {
        setIsInitialLoading(false)
        setIsRefreshing(false)
      }
    },
    [applySnapshot, buildSnapshot, fromDate, toDate, userRole]
  )

  useEffect(() => {
    const currentUser = getCurrentUser()
    const currentRole = getUserRole()
    setUserRole(currentRole)
    setUsername(currentUser?.username || "User")
  }, [])

  useEffect(() => {
    const cachedSnapshot = readDashboardCache(userRole, fromDate, toDate)

    if (cachedSnapshot) {
      applySnapshot(cachedSnapshot)
      setHasWarmCache(true)
      setIsInitialLoading(false)
      void loadDashboardData({ background: true })
      return
    }

    setHasWarmCache(false)
    void loadDashboardData()
  }, [applySnapshot, fromDate, loadDashboardData, toDate, userRole])

  useEffect(() => {
    const supabase = createClient()
    const triggerRefresh = () => void loadDashboardData({ background: true })

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ingredients" }, triggerRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "ingredient_batches" }, triggerRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "expiration_logs" }, triggerRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, triggerRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, triggerRefresh)
      .subscribe()

    const intervalId = window.setInterval(() => {
      void loadDashboardData({ background: true })
    }, 60000)

    return () => {
      window.clearInterval(intervalId)
      void supabase.removeChannel(channel)
    }
  }, [loadDashboardData])

  const roleConfig = getRoleConfig(userRole)
  const RoleIcon = roleConfig.icon

  const { lowStockItems, itemsSold, ingredientAlerts, criticalIngredients, nearExpiryCount } = useMemo(() => {
    const low = products.filter((product) => getProductAvailableStock(product, ingredients) < 15)
    const sold = transactions.reduce((sum, transaction) => sum + transaction.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)
    const criticalById = new Map<number, Ingredient>()

    products.forEach((product) => {
      product.ingredients.forEach((productIngredient) => {
        const ingredient = ingredients.find((entry) => entry.id === productIngredient.ingredientId)
        if (!ingredient) return

        const usableStock = getIngredientExpirationSummary(ingredient).usableStock
        if (usableStock < productIngredient.quantity) {
          criticalById.set(ingredient.id, ingredient)
        }
      })
    })

    const alerts = getInventoryAlerts(ingredients, { lowStockThreshold: 10, expiringThresholdDays: 3 })

    return {
      lowStockItems: low,
      itemsSold: sold,
      ingredientAlerts: alerts,
      criticalIngredients: Array.from(criticalById.values()),
      nearExpiryCount: alerts.expiringSoonIngredients.length + alerts.expiredIngredients.length,
    }
  }, [products, ingredients, transactions])

  const roleStats = useMemo(() => {
    const shared = [
      {
        label: "Sales Window",
        value: `\u20B1${rangeTotal.toFixed(2)}`,
        detail: `${fromDate} to ${toDate}`,
        icon: DollarSign,
      },
      {
        label: "Orders",
        value: String(transactions.length),
        detail: `${itemsSold} items processed`,
        icon: ShoppingCart,
      },
    ]

    if (userRole === "admin") {
      return [
        ...shared,
        {
          label: "Low Stock Products",
          value: String(lowStockItems.length),
          detail: lowStockItems[0]?.name ? `${lowStockItems[0].name} needs attention` : "Stock levels look stable",
          icon: Package,
        },
        {
          label: "Expiry Signals",
          value: String(nearExpiryCount),
          detail: nearExpiryCount > 0 ? "Immediate review recommended" : "No urgent batch issues",
          icon: AlertTriangle,
        },
      ]
    }

    if (userRole === "inventory_staff") {
      return [
        ...shared,
        {
          label: "Critical Ingredients",
          value: String(criticalIngredients.length),
          detail: criticalIngredients[0]?.name ? `${criticalIngredients[0].name} could block menu items` : "No ingredient bottlenecks",
          icon: Leaf,
        },
        {
          label: "Products at Risk",
          value: String(lowStockItems.length),
          detail: "Quick scan for menu readiness",
          icon: Boxes,
        },
      ]
    }

    return [
      ...shared,
      {
        label: "Top Seller",
        value: topSeller,
        detail: "Best performer in the selected range",
        icon: Sparkles,
      },
      {
        label: "Ready to Serve",
        value: String(products.length - lowStockItems.length),
        detail: `${lowStockItems.length} products need support`,
        icon: Package,
      },
    ]
  }, [criticalIngredients.length, fromDate, itemsSold, lowStockItems, nearExpiryCount, products.length, rangeTotal, toDate, topSeller, transactions.length, userRole])

  const operationalFeed = useMemo(() => {
    const items = [
      ...transactions.slice(-3).reverse().map((transaction) => ({
        title: transaction.id,
        description: `${transaction.date} ${transaction.time}`,
        value: `\u20B1${transaction.total.toFixed(2)}`,
      })),
      ...criticalIngredients.slice(0, 2).map((ingredient) => ({
        title: ingredient.name,
        description: "Ingredient threshold reached",
        value: `${getIngredientExpirationSummary(ingredient).usableStock} left`,
      })),
    ]

    return items.slice(0, 5)
  }, [criticalIngredients, transactions])

  const salesTrendData = useMemo(() => {
    const dailyTotals = new Map<string, { sales: number; orders: number }>()

    transactions.forEach((transaction) => {
      const existing = dailyTotals.get(transaction.date) || { sales: 0, orders: 0 }
      existing.sales += transaction.total
      existing.orders += 1
      dailyTotals.set(transaction.date, existing)
    })

    return Array.from(dailyTotals.entries())
      .sort(([left], [right]) => new Date(left).getTime() - new Date(right).getTime())
      .map(([date, values]) => ({
        date,
        shortDate: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        sales: Number(values.sales.toFixed(2)),
        orders: values.orders,
      }))
  }, [transactions])

  const categoryChartData = useMemo(() => {
    const categoryTotals = new Map<string, number>()

    transactions.forEach((transaction) => {
      transaction.items.forEach((item) => {
        const category = item.product.category || "Other"
        categoryTotals.set(category, (categoryTotals.get(category) || 0) + item.quantity)
      })
    })

    return Array.from(categoryTotals.entries())
      .map(([category, quantity], index) => ({
        category,
        quantity,
        fill: ["#4a342a", "#7d5a44", "#b2967d", "#d7c9b8", "#8a6c5b"][index % 5],
      }))
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 5)
  }, [transactions])

  const stockRiskChartData = useMemo(() => {
    return lowStockItems
      .slice()
      .sort((left, right) => getProductAvailableStock(left, ingredients) - getProductAvailableStock(right, ingredients))
      .slice(0, 5)
      .map((product) => ({
        name: product.name.length > 16 ? `${product.name.slice(0, 16)}...` : product.name,
        stock: getProductAvailableStock(product, ingredients),
      }))
  }, [ingredients, lowStockItems])

  const ingredientAlertChartData = useMemo(() => {
    return [
      { name: "Critical", value: criticalIngredients.length, fill: "#7d5a44" },
      { name: "Expiring", value: ingredientAlerts.expiringSoonIngredients.length, fill: "#b2967d" },
      { name: "Expired", value: ingredientAlerts.expiredIngredients.length, fill: "#4a342a" },
    ]
  }, [criticalIngredients.length, ingredientAlerts.expiredIngredients.length, ingredientAlerts.expiringSoonIngredients.length])

  const spotlightItems = useMemo(() => {
    if (userRole === "admin") {
      return [
        { title: "Team access", body: "Use Team Access to create or revoke accounts without disrupting verification flows." },
        { title: "Sales posture", body: `${transactions.length} orders and ${itemsSold} items moved in the selected period.` },
        { title: "Stock watch", body: `${lowStockItems.length} products and ${criticalIngredients.length} ingredients need a closer look.` },
      ]
    }

    if (userRole === "inventory_staff") {
      return [
        { title: "Menu protection", body: `${criticalIngredients.length} ingredients can affect active menu items if they are not restocked soon.` },
        { title: "Expiry radar", body: `${nearExpiryCount} batches need monitoring for spoilage or write-off risk.` },
        { title: "Best seller demand", body: `${topSeller} is currently the strongest mover in this date window.` },
      ]
    }

    return [
      { title: "Fast lane", body: "Jump straight into Checkout from the sidebar to continue serving without extra clicks." },
      { title: "Sales pulse", body: `${transactions.length} orders were completed in the selected period.` },
      { title: "Popular item", body: `${topSeller} is leading performance right now.` },
    ]
  }, [criticalIngredients.length, itemsSold, lowStockItems.length, nearExpiryCount, topSeller, transactions.length, userRole])

  const showSkeletons = isInitialLoading && !hasWarmCache

  const salesTrendChartConfig = {
    sales: { label: "Sales", color: "#7d5a44" },
    orders: { label: "Orders", color: "#b2967d" },
  }

  const categoryChartConfig = {
    quantity: { label: "Items Sold", color: "#7d5a44" },
  }

  const stockRiskChartConfig = {
    stock: { label: "Remaining Stock", color: "#8a6a55" },
  }

  const ingredientAlertChartConfig = {
    value: { label: "Alerts", color: "#7d5a44" },
    Critical: { label: "Critical", color: "#7d5a44" },
    Expiring: { label: "Expiring", color: "#b2967d" },
    Expired: { label: "Expired", color: "#4a342a" },
  }

  const topCategory = categoryChartData[0]
  const stockRiskLeader = stockRiskChartData[0]
  const totalAlertSignals = ingredientAlertChartData.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-hidden p-4 pt-24 lg:p-5 lg:pt-5 xl:p-6 xl:pt-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-12 top-6 h-52 w-52 rounded-full bg-[#d8c8bb]/22 blur-3xl" />
          <div className="absolute right-4 top-0 h-72 w-72 rounded-full bg-[#8b6d57]/12 blur-3xl" />
          <div className="absolute bottom-10 left-1/3 h-44 w-44 rounded-full bg-[#3b2b21]/8 blur-3xl" />
        </div>

        <div className="relative z-10 space-y-4 lg:space-y-5">
          <section className={`rounded-[26px] bg-gradient-to-br ${roleConfig.gradient} p-[1px] shadow-[0_22px_56px_rgba(40,29,23,0.12)]`}>
            <div className={`rounded-[25px] bg-gradient-to-br ${roleConfig.panelTone} p-5 text-[#f8f4ef] backdrop-blur-2xl lg:p-6`}>
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-white/82">
                    <RoleIcon className="h-4 w-4" />
                    {roleConfig.badge}
                  </div>
                  <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.05em] text-white lg:text-[3.3rem]">{roleConfig.title}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
                    {roleConfig.description}
                  </p>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2 xl:min-w-[21rem]">
                  <div className="rounded-[22px] border border-white/10 bg-white/10 p-3.5 backdrop-blur-xl">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/62">Signed In As</p>
                    <p className="mt-2 text-xl font-semibold tracking-[-0.04em]">{username}</p>
                    <p className="mt-1 text-xs text-white/70">{formatRoleLabel(userRole)}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/10 p-3.5 backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/62">Live Refresh</p>
                      {isRefreshing && !showSkeletons ? (
                        <span className="rounded-full border border-white/14 bg-white/10 px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/72">
                          Syncing
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xl font-semibold tracking-[-0.04em]">{lastUpdatedLabel}</p>
                    <p className="mt-1 text-xs text-white/70">Realtime updates on sales and inventory</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                <div className="rounded-[18px] border border-white/10 bg-white/8 px-3.5 py-2.5">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/60">Revenue</p>
                  <p className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-white">{`\u20B1${rangeTotal.toFixed(2)}`}</p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/8 px-3.5 py-2.5">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/60">Orders</p>
                  <p className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-white">{transactions.length}</p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/8 px-3.5 py-2.5">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/60">Momentum</p>
                  <p className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-white">{topSeller}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-[24px] border border-white/45 bg-[rgba(255,251,247,0.78)] p-4 shadow-[0_18px_36px_rgba(60,42,31,0.06)] backdrop-blur-xl lg:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8f7f73]">Date Window</p>
                  <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.04em] text-[#1f1916]">Dashboard pulse</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2.5 rounded-xl border border-[#e8ddd3] bg-white/80 px-3 py-2.5 text-sm text-[#5d5149]">
                    <CalendarRange className="h-4 w-4 text-[#5d5149]" />
                    <span>From</span>
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-transparent outline-none" />
                  </label>
                  <label className="flex items-center gap-2.5 rounded-xl border border-[#e8ddd3] bg-white/80 px-3 py-2.5 text-sm text-[#5d5149]">
                    <CalendarRange className="h-4 w-4 text-[#5d5149]" />
                    <span>To</span>
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-transparent outline-none" />
                  </label>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <InlineMetric label="Window" value={`${fromDate} - ${toDate}`} />
                <InlineMetric label="Refresh" value={isRefreshing && !showSkeletons ? "Background sync" : "Stable snapshot"} tone="accent" />
              </div>
            </div>

            <div className="rounded-[24px] border border-white/45 bg-[rgba(255,251,247,0.78)] p-4 shadow-[0_18px_36px_rgba(60,42,31,0.06)] backdrop-blur-xl lg:p-5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8f7f73]">Top Seller</p>
              {showSkeletons ? (
                <>
                  <Skeleton className="mt-2 h-8 w-44 rounded-xl bg-[#e5d8cc]" />
                  <Skeleton className="mt-2 h-4 w-52 rounded-full bg-[#eee4db]" />
                </>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#1f1916]">{topSeller}</p>
                  <p className="mt-1.5 text-sm text-[#706159]">Highest performer across the selected range.</p>
                </>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {showSkeletons
              ? Array.from({ length: 4 }).map((_, index) => <StatCardSkeleton key={index} />)
              : roleStats.map((card) => (
                  <StatCard key={card.label} label={card.label} value={card.value} detail={card.detail} icon={card.icon} />
                ))}
          </section>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[24px] border border-white/45 bg-[rgba(255,251,247,0.78)] p-4 shadow-[0_18px_36px_rgba(60,42,31,0.06)] backdrop-blur-xl lg:p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8f7f73]">Quick Access</p>
                  <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.04em] text-[#1f1916]">Links tuned to your role</h2>
                </div>
              </div>

              <div className="mt-4 grid gap-2.5">
                {roleConfig.quickLinks.map((link) => {
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group flex items-center justify-between rounded-[20px] border border-[#ebdfd5] bg-white/78 px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#d7c7ba] hover:shadow-[0_14px_28px_rgba(58,41,31,0.08)]"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5d8cc] bg-[#fbf7f2] text-[#5d4d43]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold tracking-[-0.03em] text-[#1f1916]">{link.label}</p>
                          <p className="truncate text-xs text-[#7a6b61]">{link.detail}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[#85766c] transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  )
                })}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/45 bg-[rgba(255,251,247,0.78)] p-4 shadow-[0_18px_36px_rgba(60,42,31,0.06)] backdrop-blur-xl lg:p-5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8f7f73]">Role Spotlight</p>
              <div className="mt-4 space-y-2.5">
                {showSkeletons ? (
                  <PanelSkeleton />
                ) : (
                  spotlightItems.map((item) => (
                    <div key={item.title} className="rounded-[18px] border border-[#eadfd6] bg-white/75 p-3.5">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#8f7f73]">{item.title}</p>
                      <p className="mt-1.5 text-sm leading-5 text-[#61554d]">{item.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.8fr]">
            {showSkeletons ? (
              <>
                <ChartPanelSkeleton />
                <ChartPanelSkeleton />
              </>
            ) : (
              <>
                <div className="rounded-[24px] border border-white/45 bg-[rgba(255,251,247,0.78)] p-4 shadow-[0_18px_36px_rgba(60,42,31,0.06)] backdrop-blur-xl lg:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8f7f73]">Analytics Chart</p>
                      <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.04em] text-[#1f1916]">Sales trend across the selected range</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <InlineMetric label="Revenue" value={`\u20B1${rangeTotal.toFixed(2)}`} tone="accent" />
                      <InlineMetric label="Orders" value={String(transactions.length)} />
                    </div>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-[20px] border border-[#eadfd6] bg-[rgba(255,251,247,0.84)] p-2.5">
                    <ChartContainer config={salesTrendChartConfig} className="h-[210px] w-full">
                      <AreaChart data={salesTrendData}>
                        <defs>
                          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-sales)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--color-sales)" stopOpacity={0.03} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#d7c9b8" strokeDasharray="3 3" />
                        <XAxis dataKey="shortDate" tickLine={false} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} width={32} />
                        <ChartTooltip content={<ChartTooltipContent labelKey="shortDate" />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Area
                          type="monotone"
                          dataKey="sales"
                          stroke="var(--color-sales)"
                          fill="url(#salesFill)"
                          strokeWidth={2.5}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/45 bg-[rgba(255,251,247,0.78)] p-4 shadow-[0_18px_36px_rgba(60,42,31,0.06)] backdrop-blur-xl lg:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8f7f73]">Role Focus</p>
                      <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.04em] text-[#1f1916]">
                        {userRole === "inventory_staff" ? "Products closest to stockout" : userRole === "admin" ? "Alert distribution" : "Best-selling categories"}
                      </h2>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {userRole === "inventory_staff" ? (
                        <>
                          <InlineMetric label="Most at risk" value={stockRiskLeader?.name || "None"} tone="accent" />
                          <InlineMetric label="Units left" value={stockRiskLeader ? String(stockRiskLeader.stock) : "0"} />
                        </>
                      ) : userRole === "admin" ? (
                        <>
                          <InlineMetric label="Total alerts" value={String(totalAlertSignals)} tone="accent" />
                          <InlineMetric label="Critical" value={String(criticalIngredients.length)} />
                        </>
                      ) : (
                        <>
                          <InlineMetric label="Top category" value={topCategory?.category || "None"} tone="accent" />
                          <InlineMetric label="Items sold" value={topCategory ? String(topCategory.quantity) : "0"} />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-[20px] border border-[#eadfd6] bg-[rgba(255,251,247,0.84)] p-2.5">
                    {userRole === "inventory_staff" ? (
                      <ChartContainer config={stockRiskChartConfig} className="h-[210px] w-full">
                        <BarChart data={stockRiskChartData} layout="vertical" margin={{ left: 10, right: 8 }}>
                          <CartesianGrid horizontal={false} stroke="#d7c9b8" strokeDasharray="3 3" />
                          <XAxis type="number" tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={78} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Bar dataKey="stock" fill="var(--color-stock)" radius={[0, 8, 8, 0]} />
                        </BarChart>
                      </ChartContainer>
                    ) : userRole === "admin" ? (
                      <ChartContainer config={ingredientAlertChartConfig} className="h-[210px] w-full">
                        <PieChart>
                          <Pie data={ingredientAlertChartData} dataKey="value" nameKey="name" innerRadius={46} outerRadius={74} paddingAngle={3}>
                            {ingredientAlertChartData.map((entry) => (
                              <Cell key={entry.name} fill={entry.fill} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                          <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                        </PieChart>
                      </ChartContainer>
                    ) : (
                      <ChartContainer config={categoryChartConfig} className="h-[210px] w-full">
                        <BarChart data={categoryChartData} margin={{ left: 4, right: 4 }}>
                          <CartesianGrid vertical={false} stroke="#d7c9b8" strokeDasharray="3 3" />
                          <XAxis dataKey="category" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} width={28} />
                          <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Bar dataKey="quantity" radius={[8, 8, 0, 0]}>
                            {categoryChartData.map((entry) => (
                              <Cell key={entry.category} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[24px] border border-white/45 bg-[rgba(255,251,247,0.78)] p-4 shadow-[0_18px_36px_rgba(60,42,31,0.06)] backdrop-blur-xl lg:p-5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8f7f73]">Live Feed</p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.04em] text-[#1f1916]">Operational highlights</h2>

              <div className="mt-4 space-y-2.5">
                {showSkeletons ? (
                  <PanelSkeleton lines={4} />
                ) : operationalFeed.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[#dccfc4] px-4 py-8 text-center text-sm text-[#84766b]">
                    No recent items to show yet.
                  </div>
                ) : (
                  operationalFeed.map((item) => (
                    <div key={`${item.title}-${item.value}`} className="flex items-center justify-between gap-3 rounded-[18px] border border-[#ebdfd5] bg-white/78 px-3.5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[#1f1916]">{item.title}</p>
                        <p className="truncate text-sm text-[#7a6b61]">{item.description}</p>
                      </div>
                      <span className="rounded-full bg-[#f3ece5] px-2.5 py-1 text-xs font-semibold text-[#5f4f45]">{item.value}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/45 bg-[rgba(255,251,247,0.78)] p-4 shadow-[0_18px_36px_rgba(60,42,31,0.06)] backdrop-blur-xl lg:p-5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8f7f73]">Alerts</p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.04em] text-[#1f1916]">What needs attention now</h2>

              <div className="mt-4 grid gap-2.5 md:grid-cols-2">
                {showSkeletons ? (
                  <>
                    <div className="rounded-[18px] border border-[#ebdfd5] bg-white/78 p-3.5">
                      <Skeleton className="h-3 w-32 rounded-full bg-[#e8dbd1]" />
                      <Skeleton className="mt-4 h-9 w-16 rounded-xl bg-[#e5d8cc]" />
                      <Skeleton className="mt-3 h-4 w-44 rounded-full bg-[#f0e7de]" />
                    </div>
                    <div className="rounded-[18px] border border-[#ebdfd5] bg-white/78 p-3.5">
                      <Skeleton className="h-3 w-32 rounded-full bg-[#e8dbd1]" />
                      <Skeleton className="mt-4 h-9 w-16 rounded-xl bg-[#e5d8cc]" />
                      <Skeleton className="mt-3 h-4 w-44 rounded-full bg-[#f0e7de]" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-[18px] border border-[#ebdfd5] bg-white/78 p-3.5">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8f7f73]">Ingredient Pressure</p>
                      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#1f1916]">{criticalIngredients.length}</p>
                      <p className="mt-1.5 text-sm text-[#706159]">Ingredients currently limiting available menu output.</p>
                    </div>
                    <div className="rounded-[18px] border border-[#ebdfd5] bg-white/78 p-3.5">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8f7f73]">Expiring Batches</p>
                      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#1f1916]">{nearExpiryCount}</p>
                      <p className="mt-1.5 text-sm text-[#706159]">Items due soon or already expired in the active window.</p>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-3.5 space-y-2.5">
                {showSkeletons ? (
                  <PanelSkeleton lines={4} />
                ) : (
                  <>
                    {[...criticalIngredients.slice(0, 2), ...ingredientAlerts.expiredIngredients.slice(0, 1), ...ingredientAlerts.expiringSoonIngredients.slice(0, 1)]
                      .slice(0, 4)
                      .map((ingredient) => (
                        <div key={ingredient.id} className="flex items-center justify-between rounded-[18px] border border-[#ebdfd5] bg-white/78 px-3.5 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[#1f1916]">{ingredient.name}</p>
                            <p className="truncate text-sm text-[#7a6b61]">
                              Usable stock: {getIngredientExpirationSummary(ingredient).usableStock}
                            </p>
                          </div>
                          <span className="rounded-full bg-[#f3ece5] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#68574c]">
                            Review
                          </span>
                        </div>
                      ))}

                    {criticalIngredients.length === 0 &&
                      ingredientAlerts.expiredIngredients.length === 0 &&
                      ingredientAlerts.expiringSoonIngredients.length === 0 && (
                        <div className="rounded-[24px] border border-dashed border-[#dccfc4] px-4 py-8 text-center text-sm text-[#84766b]">
                          No urgent alerts right now.
                        </div>
                      )}
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
