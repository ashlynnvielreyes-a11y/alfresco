"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import {
  getCurrentUser,
  getIngredients,
  getInventoryAlerts,
  getProductAvailableStock,
  getProducts,
  getSalesTotalByDateRange,
  getTopProducts,
  getTransactionsByDateRange,
  getUserRole,
  getIngredientExpirationSummary,
  initializeSupabaseStore,
  verifyDataPersistence,
  type UserRole,
} from "@/lib/store"
import type { Ingredient, Product, Transaction } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
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

function getDefaultRange() {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 6)

  return {
    fromDate: startDate.toISOString().split("T")[0],
    toDate: endDate.toISOString().split("T")[0],
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
        gradient: "from-[#1a2421] via-[#30584f] to-[#81b6ac]",
        panelTone: "from-[#1a2421]/98 via-[#233833]/95 to-[#2f4f48]/90",
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
        gradient: "from-[#3a271b] via-[#76533c] to-[#d4b69e]",
        panelTone: "from-[#2e2017]/98 via-[#523829]/94 to-[#755641]/88",
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
        gradient: "from-[#261c30] via-[#504061] to-[#a89aba]",
        panelTone: "from-[#21192a]/98 via-[#3f3350]/94 to-[#5a4c6c]/88",
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
    <article className="rounded-[28px] border border-white/40 bg-[rgba(255,251,247,0.7)] p-5 shadow-[0_24px_48px_rgba(60,42,31,0.08)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8b7a6e]">{label}</p>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#1f1916]">{value}</p>
          <p className="mt-3 max-w-[18rem] text-sm text-[#72645a]">{detail}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e4d7cc] bg-white/75 text-[#54443a]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
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

  const refreshData = useCallback(async () => {
    verifyDataPersistence()
    await initializeSupabaseStore()

    const startDate = new Date(fromDate)
    const endDate = new Date(toDate)
    if (startDate > endDate) return

    setProducts(getProducts())
    setIngredients(getIngredients())
    setTransactions(await getTransactionsByDateRange(fromDate, toDate))
    setRangeTotal(await getSalesTotalByDateRange(fromDate, toDate))

    const topProducts = await getTopProducts(startDate, endDate, 1)
    setTopSeller(topProducts[0]?.name || "No sales yet")
    setLastUpdatedLabel(new Date().toLocaleTimeString())
  }, [fromDate, toDate])

  useEffect(() => {
    const currentUser = getCurrentUser()
    setUserRole(getUserRole())
    setUsername(currentUser?.username || "User")
  }, [])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ingredients" }, () => void refreshData())
      .on("postgres_changes", { event: "*", schema: "public", table: "ingredient_batches" }, () => void refreshData())
      .on("postgres_changes", { event: "*", schema: "public", table: "expiration_logs" }, () => void refreshData())
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => void refreshData())
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => void refreshData())
      .subscribe()

    const intervalId = window.setInterval(() => {
      void refreshData()
    }, 60000)

    return () => {
      window.clearInterval(intervalId)
      void supabase.removeChannel(channel)
    }
  }, [refreshData])

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

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-hidden p-4 pt-24 lg:p-6 lg:pt-6 xl:p-8 xl:pt-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-12 top-6 h-52 w-52 rounded-full bg-[#d8c8bb]/22 blur-3xl" />
          <div className="absolute right-4 top-0 h-72 w-72 rounded-full bg-[#8b6d57]/12 blur-3xl" />
          <div className="absolute bottom-10 left-1/3 h-44 w-44 rounded-full bg-[#3b2b21]/8 blur-3xl" />
        </div>

        <div className="relative z-10 space-y-6 lg:space-y-7">
          <section className={`rounded-[34px] bg-gradient-to-br ${roleConfig.gradient} p-[1px] shadow-[0_28px_70px_rgba(40,29,23,0.14)]`}>
            <div className={`rounded-[33px] bg-gradient-to-br ${roleConfig.panelTone} p-6 text-[#f8f4ef] backdrop-blur-2xl lg:p-8`}>
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-white/82">
                    <RoleIcon className="h-4 w-4" />
                    {roleConfig.badge}
                  </div>
                  <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-white lg:text-6xl">{roleConfig.title}</h1>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72 lg:text-base">
                    {roleConfig.description}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[25rem]">
                  <div className="rounded-[28px] border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/62">Signed In As</p>
                    <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{username}</p>
                    <p className="mt-1 text-sm text-white/70">{formatRoleLabel(userRole)}</p>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/62">Live Refresh</p>
                    <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{lastUpdatedLabel}</p>
                    <p className="mt-1 text-sm text-white/70">Realtime updates on sales and inventory</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-[30px] border border-white/40 bg-[rgba(255,251,247,0.68)] p-5 shadow-[0_24px_48px_rgba(60,42,31,0.08)] backdrop-blur-xl lg:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8f7f73]">Date Window</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#1f1916]">Dashboard pulse</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-3 rounded-2xl border border-[#e8ddd3] bg-white/80 px-4 py-3 text-sm text-[#5d5149]">
                    <CalendarRange className="h-4 w-4 text-[#5d5149]" />
                    <span>From</span>
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-transparent outline-none" />
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-[#e8ddd3] bg-white/80 px-4 py-3 text-sm text-[#5d5149]">
                    <CalendarRange className="h-4 w-4 text-[#5d5149]" />
                    <span>To</span>
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-transparent outline-none" />
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/40 bg-[rgba(255,251,247,0.68)] p-5 shadow-[0_24px_48px_rgba(60,42,31,0.08)] backdrop-blur-xl lg:p-6">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8f7f73]">Top Seller</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#1f1916]">{topSeller}</p>
              <p className="mt-2 text-sm text-[#706159]">Highest performer across the selected range.</p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {roleStats.map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} detail={card.detail} icon={card.icon} />
            ))}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[30px] border border-white/40 bg-[rgba(255,251,247,0.68)] p-5 shadow-[0_24px_48px_rgba(60,42,31,0.08)] backdrop-blur-xl lg:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8f7f73]">Quick Access</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#1f1916]">Links tuned to your role</h2>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {roleConfig.quickLinks.map((link) => {
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group flex items-center justify-between rounded-[26px] border border-[#ebdfd5] bg-white/78 px-5 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#d7c7ba] hover:shadow-[0_18px_36px_rgba(58,41,31,0.08)]"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e5d8cc] bg-[#fbf7f2] text-[#5d4d43]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold tracking-[-0.03em] text-[#1f1916]">{link.label}</p>
                          <p className="truncate text-sm text-[#7a6b61]">{link.detail}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-[#85766c] transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  )
                })}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/40 bg-[rgba(255,251,247,0.68)] p-5 shadow-[0_24px_48px_rgba(60,42,31,0.08)] backdrop-blur-xl lg:p-6">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8f7f73]">Role Spotlight</p>
              <div className="mt-5 space-y-3">
                {spotlightItems.map((item) => (
                  <div key={item.title} className="rounded-[24px] border border-[#eadfd6] bg-white/75 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8f7f73]">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[#61554d]">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[30px] border border-white/40 bg-[rgba(255,251,247,0.68)] p-5 shadow-[0_24px_48px_rgba(60,42,31,0.08)] backdrop-blur-xl lg:p-6">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8f7f73]">Live Feed</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#1f1916]">Operational highlights</h2>

              <div className="mt-5 space-y-3">
                {operationalFeed.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[#dccfc4] px-4 py-8 text-center text-sm text-[#84766b]">
                    No recent items to show yet.
                  </div>
                ) : (
                  operationalFeed.map((item) => (
                    <div key={`${item.title}-${item.value}`} className="flex items-center justify-between gap-4 rounded-[24px] border border-[#ebdfd5] bg-white/78 px-4 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[#1f1916]">{item.title}</p>
                        <p className="truncate text-sm text-[#7a6b61]">{item.description}</p>
                      </div>
                      <span className="rounded-full bg-[#f3ece5] px-3 py-1 text-sm font-semibold text-[#5f4f45]">{item.value}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/40 bg-[rgba(255,251,247,0.68)] p-5 shadow-[0_24px_48px_rgba(60,42,31,0.08)] backdrop-blur-xl lg:p-6">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8f7f73]">Alerts</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#1f1916]">What needs attention now</h2>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-[24px] border border-[#ebdfd5] bg-white/78 p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8f7f73]">Ingredient Pressure</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#1f1916]">{criticalIngredients.length}</p>
                  <p className="mt-2 text-sm text-[#706159]">Ingredients currently limiting available menu output.</p>
                </div>
                <div className="rounded-[24px] border border-[#ebdfd5] bg-white/78 p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8f7f73]">Expiring Batches</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#1f1916]">{nearExpiryCount}</p>
                  <p className="mt-2 text-sm text-[#706159]">Items due soon or already expired in the active window.</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {[...criticalIngredients.slice(0, 2), ...ingredientAlerts.expiredIngredients.slice(0, 1), ...ingredientAlerts.expiringSoonIngredients.slice(0, 1)]
                  .slice(0, 4)
                  .map((ingredient) => (
                    <div key={ingredient.id} className="flex items-center justify-between rounded-[24px] border border-[#ebdfd5] bg-white/78 px-4 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[#1f1916]">{ingredient.name}</p>
                        <p className="truncate text-sm text-[#7a6b61]">
                          Usable stock: {getIngredientExpirationSummary(ingredient).usableStock}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#f3ece5] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#68574c]">
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
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
