"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Sidebar } from "@/components/sidebar"
import { initializeSupabaseStore, getProducts, getIngredients, getProductAvailableStock, verifyDataPersistence, getTransactionsByDateRange, getSalesTotalByDateRange, getTopProducts, getInventoryAlerts, getIngredientExpirationSummary, getActiveOrders, getCurrentUser } from "@/lib/store"
import type { Product, Transaction, Ingredient, ActiveOrder } from "@/lib/types"
import { Package, ShoppingCart, TrendingUp, DollarSign, CalendarRange, Activity } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

function getDefaultRange() {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 6)

  return {
    fromDate: startDate.toISOString().split("T")[0],
    toDate: endDate.toISOString().split("T")[0],
  }
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
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([])
  const [currentUserRole, setCurrentUserRole] = useState("")

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
    setActiveOrders(await getActiveOrders())
    setCurrentUserRole(getCurrentUser()?.role || "")

    const topProducts = await getTopProducts(startDate, endDate, 1)
    setTopSeller(topProducts[0]?.name || "No sales yet")
    setLastUpdatedLabel(new Date().toLocaleTimeString())
  }, [fromDate, toDate])

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
      .on("postgres_changes", { event: "*", schema: "public", table: "active_orders" }, () => void refreshData())
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

  const { lowStockItems, itemsSold, ingredientAlerts, criticalIngredients } = useMemo(() => {
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

    return {
      lowStockItems: low,
      itemsSold: sold,
      ingredientAlerts: getInventoryAlerts(ingredients, { lowStockThreshold: 10, expiringThresholdDays: 3 }),
      criticalIngredients: Array.from(criticalById.values()),
    }
  }, [products, ingredients, transactions])

  const statCards = [
    {
      label: "Range Sales",
      value: `\u20B1${rangeTotal.toFixed(2)}`,
      detail: `${fromDate} to ${toDate}`,
      icon: DollarSign,
      tint: "from-[#4a342a] via-[#7d5a44] to-[#b2967d]",
      light: false,
    },
    {
      label: "Total Orders",
      value: String(transactions.length),
      detail: "Orders processed in the selected range",
      icon: ShoppingCart,
      tint: "from-[#b2967d] via-[#d7c9b8] to-[#f5f1ea]",
      light: true,
    },
    {
      label: "Items Sold",
      value: String(itemsSold),
      detail: `Top seller: ${topSeller}`,
      icon: Package,
      tint: "from-[#7d5a44] via-[#b2967d] to-[#d7c9b8]",
      light: false,
    },
    {
      label: "Low Stock Items",
      value: String(lowStockItems.length),
      detail: lowStockItems.length > 0 ? `${lowStockItems[0]?.name} needs action` : "Stock levels look healthy",
      icon: TrendingUp,
      tint: "from-[#f5f1ea] via-[#d7c9b8] to-[#b2967d]",
      light: true,
    },
  ]

  const activeOrderCount = activeOrders.length

  const formatMonitorTime = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "--"
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-hidden p-4 pt-20 lg:p-6 lg:pt-6 xl:p-8 xl:pt-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-16 top-8 h-48 w-48 rounded-full bg-[#b2967d]/20 blur-3xl" />
          <div className="absolute right-8 top-0 h-64 w-64 rounded-full bg-[#7d5a44]/12 blur-3xl" />
          <div className="absolute bottom-12 left-1/3 h-40 w-40 rounded-full bg-[#4a342a]/10 blur-3xl" />
        </div>

        <div className="relative mb-6 lg:mb-8">
          <div className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/45 p-5 shadow-[0_24px_60px_rgba(123,111,25,0.10),inset_0_1px_0_rgba(245,241,234,0.65)] backdrop-blur-xl lg:p-7">
            <div className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-[#4a342a]/30 to-transparent" />
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.32em] text-[#7d5a44] lg:text-sm">ANALYTICS OVERVIEW</p>
                <h1 className="mb-3 text-3xl font-bold text-[#4a342a] lg:text-5xl">Dashboard</h1>
                <p className="max-w-2xl text-sm text-[#7d5a44] lg:text-base">
                  Date-range analytics for revenue, order volume, and stock health using the existing cafe dashboard language.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 lg:gap-4">
                <div className="flex items-center gap-2 rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/55 px-4 py-3 shadow-[inset_0_1px_0_rgba(245,241,234,0.75)] backdrop-blur-sm">
                  <CalendarRange className="h-4 w-4 text-[#4a342a]" />
                  <div className="flex items-center gap-2 text-sm">
                    <label className="text-[#7d5a44]">From</label>
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-transparent outline-none" />
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/55 px-4 py-3 shadow-[inset_0_1px_0_rgba(245,241,234,0.75)] backdrop-blur-sm">
                  <CalendarRange className="h-4 w-4 text-[#4a342a]" />
                  <div className="flex items-center gap-2 text-sm">
                    <label className="text-[#7d5a44]">To</label>
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-transparent outline-none" />
                  </div>
                </div>

                <div className="rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/55 px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(245,241,234,0.75)] backdrop-blur-sm">
                  <p className="text-[10px] tracking-[0.24em] text-[#7d5a44]">LIVE REFRESH</p>
                  <p className="text-sm font-semibold text-foreground">Updated {lastUpdatedLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:mb-8 lg:gap-4">
          {statCards.map((card) => {
            const Icon = card.icon

            return (
              <div key={card.label} className={`group relative overflow-hidden rounded-[24px] border border-[#f5f1ea]/55 bg-gradient-to-br ${card.tint} p-[1px] shadow-[0_18px_36px_rgba(123,111,25,0.10)]`}>
                <div className={`relative h-full rounded-[23px] p-5 backdrop-blur-sm lg:p-6 ${card.light ? "bg-[#f5f1ea]/88 text-[#4a342a]" : "bg-[rgba(245,241,234,0.14)] text-[#f5f1ea]"}`}>
                  <div className="absolute inset-x-0 top-0 h-px bg-[#f5f1ea]/45" />
                  <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full ${card.light ? "bg-[#f5f1ea]/35" : "bg-[#f5f1ea]/10"} blur-sm transition-transform duration-300 group-hover:scale-110`} />

                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className={`mb-1 text-sm ${card.light ? "text-[#7d5a44]" : "text-[#f5f1ea]/75"}`}>{card.label}</p>
                      <p className="text-2xl font-bold lg:text-3xl">{card.value}</p>
                      <p className={`mt-3 text-xs leading-5 ${card.light ? "text-[#7d5a44]" : "text-[#f5f1ea]/70"}`}>{card.detail}</p>
                    </div>

                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${card.light ? "border-[#b2967d]/30 bg-[#f5f1ea]/55 text-[#4a342a]" : "border-[#f5f1ea]/15 bg-[#f5f1ea]/12 text-[#f5f1ea]"} backdrop-blur-sm`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {currentUserRole === "admin" && (
          <div className="mb-6 rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/45 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl lg:mb-8 lg:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.24em] text-[#7d5a44]">Live POS Monitor</p>
                <h2 className="text-lg font-bold text-[#4a342a] lg:text-2xl">Cashier Active Orders</h2>
                <p className="text-sm text-[#7d5a44]">Real-time carts currently open at cashier stations.</p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 px-4 py-3 shadow-[inset_0_1px_0_rgba(245,241,234,0.75)]">
                <Activity className="h-4 w-4 text-[#4a342a]" />
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#7d5a44]">Stations Live</p>
                  <p className="text-sm font-semibold text-foreground">{activeOrderCount}</p>
                </div>
              </div>
            </div>

            {activeOrders.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#d7c9b8] bg-[#f5f1ea]/60 px-4 py-8 text-center text-sm text-muted-foreground">
                No active cashier orders right now.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {activeOrders.map((order) => (
                  <div key={order.id} className="rounded-[24px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/62 p-4 shadow-[0_16px_30px_rgba(74,52,42,0.06)]">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-[#4a342a]">{order.cashierName}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-[#7d5a44]">{order.stationId}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#4a342a]">{`\u20B1${order.total.toFixed(2)}`}</p>
                        <p className="text-xs text-muted-foreground">Updated {formatMonitorTime(order.lastUpdatedAt)}</p>
                      </div>
                    </div>

                    <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/72 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[#7d5a44]">Items</p>
                        <p className="font-semibold text-foreground">{order.cartItemCount}</p>
                      </div>
                      <div className="rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/72 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[#7d5a44]">Payment</p>
                        <p className="font-semibold capitalize text-foreground">{order.paymentMethod}</p>
                      </div>
                      <div className="rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/72 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[#7d5a44]">Started</p>
                        <p className="font-semibold text-foreground">{formatMonitorTime(order.startedAt)}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {order.items.slice(0, 4).map((item, index) => (
                        <div key={`${order.id}-${item.product.id}-${index}`} className="flex items-center justify-between rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/55 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{item.product.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {[item.temperature, item.addOns?.length ? `${item.addOns.length} add-on(s)` : null].filter(Boolean).join(" • ") || "Standard"}
                            </p>
                          </div>
                          <p className="ml-2 text-sm font-semibold text-[#4a342a]">x{item.quantity}</p>
                        </div>
                      ))}
                      {order.items.length > 4 && (
                        <p className="text-xs text-[#7d5a44]">+{order.items.length - 4} more line item(s)</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4 lg:gap-5 2xl:gap-6">
          <div className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/52 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.68)] backdrop-blur-xl lg:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground lg:text-lg">Recent Transactions</h2>
              <span className="rounded-full bg-[#d7c9b8] px-3 py-1 text-xs font-medium text-[#7d5a44]">Range View</span>
            </div>

            {transactions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground lg:py-8 lg:text-base">No transactions in this range</p>
            ) : (
              <div className="space-y-2 lg:space-y-3">
                {transactions.slice(-5).reverse().map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/55 px-4 py-3 shadow-[inset_0_1px_0_rgba(245,241,234,0.75)]">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium lg:text-base">{transaction.id}</p>
                      <p className="truncate text-xs text-muted-foreground lg:text-sm">{transaction.date} {transaction.time}</p>
                    </div>
                    <p className="ml-2 text-sm font-bold text-[#4a342a] lg:text-base">{`\u20B1${transaction.total.toFixed(2)}`}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/52 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.68)] backdrop-blur-xl lg:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground lg:text-lg">Low Stock Ingredients</h2>
              <span className="rounded-full bg-[#d7c9b8] px-3 py-1 text-xs font-medium text-[#7d5a44]">Monitor</span>
            </div>

            {criticalIngredients.length === 0 && ingredientAlerts.lowStockIngredients.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground lg:py-8 lg:text-base">All items are well stocked</p>
            ) : (
              <div className="space-y-2 lg:space-y-3">
                {[...criticalIngredients, ...ingredientAlerts.lowStockIngredients.filter((ingredient) => !criticalIngredients.some((critical) => critical.id === ingredient.id))].map((ingredient) => (
                  <div key={ingredient.id} className="flex items-center justify-between rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/55 px-4 py-3 shadow-[inset_0_1px_0_rgba(245,241,234,0.75)]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium lg:text-base">{ingredient.name}</p>
                      <p className="text-xs text-muted-foreground lg:text-sm">{ingredient.productId}</p>
                    </div>
                    <span className="ml-2 flex-shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 lg:px-3 lg:text-sm">
                      {getIngredientExpirationSummary(ingredient).usableStock} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/52 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.68)] backdrop-blur-xl lg:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground lg:text-lg">Low Stock Products</h2>
              <span className="rounded-full bg-[#d7c9b8] px-3 py-1 text-xs font-medium text-[#7d5a44]">POS Sync</span>
            </div>

            {lowStockItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground lg:py-8 lg:text-base">All products are well stocked</p>
            ) : (
              <div className="space-y-2 lg:space-y-3">
                {lowStockItems.map((product) => (
                  <div key={product.id} className="flex items-center justify-between rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/55 px-4 py-3 shadow-[inset_0_1px_0_rgba(245,241,234,0.75)]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium lg:text-base">{product.name}</p>
                      <p className="text-xs text-muted-foreground lg:text-sm">{product.category}</p>
                    </div>
                    <span className="ml-2 flex-shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 lg:px-3 lg:text-sm">
                      {getProductAvailableStock(product, ingredients)} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/52 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.68)] backdrop-blur-xl lg:col-span-2 2xl:col-span-1 lg:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground lg:text-lg">Expiration Alerts</h2>
              <span className="rounded-full bg-[#d7c9b8] px-3 py-1 text-xs font-medium text-[#7d5a44]">FIFO</span>
            </div>

            {ingredientAlerts.expiringSoonIngredients.length === 0 && ingredientAlerts.expiredIngredients.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground lg:py-8 lg:text-base">No expiration alerts right now</p>
            ) : (
              <div className="space-y-2 lg:space-y-3">
                {ingredientAlerts.expiredIngredients.map((ingredient) => {
                  const summary = getIngredientExpirationSummary(ingredient)
                  return (
                    <div key={`expired-${ingredient.id}`} className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium lg:text-base">{ingredient.name}</p>
                        <p className="text-xs text-red-700 lg:text-sm">{summary.expiredBatches.length} expired batch(es)</p>
                      </div>
                      <span className="ml-2 flex-shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 lg:px-3 lg:text-sm">
                        Expired
                      </span>
                    </div>
                  )
                })}
                {ingredientAlerts.expiringSoonIngredients.map((ingredient) => {
                  const summary = getIngredientExpirationSummary(ingredient)
                  return (
                    <div key={`soon-${ingredient.id}`} className="flex items-center justify-between rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium lg:text-base">{ingredient.name}</p>
                        <p className="text-xs text-yellow-700 lg:text-sm">
                          Batch {summary.displayBatchId || summary.nextBatchId || "pending"} expires {summary.displayExpirationDate || summary.nextExpirationDate || "soon"}
                        </p>
                      </div>
                      <span className="ml-2 flex-shrink-0 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700 lg:px-3 lg:text-sm">
                        Near expiry
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}


