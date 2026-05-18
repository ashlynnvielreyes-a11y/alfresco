"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Activity,
  Calendar,
  Clock3,
  Layers3,
  PackageSearch,
  PieChart as PieChartIcon,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { Sidebar } from "@/components/sidebar"
import { SalesSnapshotCard } from "@/components/sales-snapshot-card"
import type { SalesSnapshotData } from "@/components/sales-snapshot-card"
import { createClient } from "@/lib/supabase/client"
import {
  getDailySales,
  getIngredients,
  getInventoryAlerts,
  getMonthlySales,
  getProductAvailableStock,
  getProducts,
  getTransactionsByDateRange,
  getWeeklySales,
  getYearlySales,
  initializeSupabaseStore,
} from "@/lib/store"
import type { Ingredient, Product, ProductCategory, Transaction } from "@/lib/types"

type TrendView = "daily" | "weekly" | "monthly" | "yearly"

type TrendPoint = {
  label: string
  revenue: number
  orders: number
}

type PaymentPoint = {
  name: string
  value: number
  fill: string
}

type OrderTypePoint = {
  name: string
  orders: number
  fill: string
}

type ComparisonPoint = {
  period: string
  revenue: number
  orders: number
}

type InventoryInsightPoint = {
  name: string
  quantitySold: number
  availableStock: number
  urgency: "watch" | "critical"
}

function getDefaultRange() {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 6)

  return {
    fromDate: startDate.toISOString().split("T")[0],
    toDate: endDate.toISOString().split("T")[0],
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value)
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function formatWeekLabel(start: Date) {
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return `${formatShortDate(start)}-${end.getDate()}`
}

function addDays(date: Date, amount: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

function addMonths(date: Date, amount: number) {
  const nextDate = new Date(date)
  nextDate.setMonth(nextDate.getMonth() + amount)
  return nextDate
}

function startOfWeek(date: Date) {
  const nextDate = new Date(date)
  const day = nextDate.getDay()
  nextDate.setDate(nextDate.getDate() - day)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function endOfWeek(date: Date) {
  const nextDate = startOfWeek(date)
  nextDate.setDate(nextDate.getDate() + 6)
  nextDate.setHours(23, 59, 59, 999)
  return nextDate
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function buildTrendLabel(currentValue: number, previousValue: number) {
  if (previousValue === 0) {
    if (currentValue === 0) {
      return {
        trendDirection: "neutral" as const,
        trendPercentage: 0,
        trendLabel: "No change",
      }
    }

    return {
      trendDirection: "positive" as const,
      trendPercentage: 100,
      trendLabel: "+100% increase",
    }
  }

  const rawPercentage = ((currentValue - previousValue) / previousValue) * 100
  const roundedPercentage = Math.round(Math.abs(rawPercentage) * 10) / 10

  if (rawPercentage > 0) {
    return {
      trendDirection: "positive" as const,
      trendPercentage: roundedPercentage,
      trendLabel: `+${roundedPercentage}% increase`,
    }
  }

  if (rawPercentage < 0) {
    return {
      trendDirection: "negative" as const,
      trendPercentage: roundedPercentage,
      trendLabel: `-${roundedPercentage}% decrease`,
    }
  }

  return {
    trendDirection: "neutral" as const,
    trendPercentage: 0,
    trendLabel: "No change",
  }
}

function transactionOrderType(transaction: Transaction) {
  if (transaction.items.some((item) => item.comboMeal)) return "Combo"

  const categorySet = new Set<ProductCategory>(
    transaction.items.map((item) => item.product.category)
  )

  const hasDrink = Array.from(categorySet).some((category) =>
    ["Coffee", "Milk Tea", "Fruit Soda", "Fruit Tea"].includes(String(category))
  )
  const hasMeal = Array.from(categorySet).some((category) =>
    ["Silog", "Combos"].includes(String(category))
  )

  if (hasDrink && hasMeal) return "Mixed"
  if (hasDrink) return "Beverage"
  if (hasMeal) return "Meal"
  return "Other"
}

function renderPieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
}: {
  cx?: number
  cy?: number
  midAngle?: number
  innerRadius?: number
  outerRadius?: number
  percent?: number
  name?: string
}) {
  if (
    cx === undefined ||
    cy === undefined ||
    midAngle === undefined ||
    innerRadius === undefined ||
    outerRadius === undefined ||
    percent === undefined ||
    !name
  ) {
    return null
  }

  const radian = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 1.22
  const x = cx + radius * Math.cos(-midAngle * radian)
  const y = cy + radius * Math.sin(-midAngle * radian)

  return (
    <text
      x={x}
      y={y}
      fill="#7d5a44"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={13}
      fontWeight={700}
    >
      {`${name} ${Math.round(percent * 100)}%`}
    </text>
  )
}

function Panel({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description: string
  icon: typeof TrendingUp
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground lg:text-xl">{title}</h2>
          <p className="text-xs text-muted-foreground lg:text-sm">{description}</p>
        </div>
        <Icon className="h-5 w-5 text-[#4a342a]" />
      </div>
      {children}
    </section>
  )
}

export default function SalesAnalyticsPage() {
  const defaults = getDefaultRange()
  const [fromDate, setFromDate] = useState(defaults.fromDate)
  const [toDate, setToDate] = useState(defaults.toDate)
  const [trendView, setTrendView] = useState<TrendView>("daily")
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [salesSnapshotData, setSalesSnapshotData] = useState<SalesSnapshotData>({
    daily: {
      label: "Daily Sales",
      value: 0,
      comparisonLabel: "Compared with yesterday",
      trendLabel: "No change",
      trendDirection: "neutral",
      trendPercentage: 0,
      sparkline: [0, 0, 0, 0, 0, 0, 0],
      sparklineLabel: "Last 7 days",
    },
    weekly: {
      label: "Weekly Sales",
      value: 0,
      comparisonLabel: "Compared with last week",
      trendLabel: "No change",
      trendDirection: "neutral",
      trendPercentage: 0,
      sparkline: [0, 0, 0, 0, 0, 0, 0, 0],
      sparklineLabel: "Last 8 weeks",
    },
    monthly: {
      label: "Monthly Sales",
      value: 0,
      comparisonLabel: "Compared with last month",
      trendLabel: "No change",
      trendDirection: "neutral",
      trendPercentage: 0,
      sparkline: [0, 0, 0, 0, 0, 0],
      sparklineLabel: "Last 6 months",
    },
    yearly: {
      label: "Yearly Sales",
      value: 0,
      comparisonLabel: "Compared with last year",
      trendLabel: "No change",
      trendDirection: "neutral",
      trendPercentage: 0,
      sparkline: [0, 0, 0, 0, 0],
      sparklineLabel: "Last 5 years",
    },
  })

  const loadData = useCallback(async () => {
    await initializeSupabaseStore()

    const startDate = new Date(fromDate)
    const endDate = new Date(toDate)
    const today = new Date()

    if (startDate > endDate) return

    const todayKey = today.toISOString().split("T")[0]
    const previousDay = addDays(today, -1)
    const previousWeekDate = addDays(today, -7)
    const previousWeekStart = startOfWeek(previousWeekDate)
    const previousWeekEnd = endOfWeek(previousWeekDate)
    const previousMonthDate = addMonths(today, -1)
    const previousYear = today.getFullYear() - 1

    const [
      nextTransactions,
      nextDailySales,
      nextWeeklySales,
      nextMonthlySales,
      nextYearlySales,
      previousDailySales,
      previousWeeklySales,
      previousMonthlySales,
      previousYearlySales,
      dailySparkline,
      weeklySparkline,
      monthlySparkline,
      yearlySparkline,
    ] = await Promise.all([
      getTransactionsByDateRange(fromDate, toDate),
      getDailySales(todayKey),
      getWeeklySales(today.getFullYear(), Math.ceil((((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7)),
      getMonthlySales(today.getFullYear(), today.getMonth()),
      getYearlySales(today.getFullYear()),
      getDailySales(previousDay.toISOString().split("T")[0]),
      getTransactionsByDateRange(previousWeekStart.toISOString().split("T")[0], previousWeekEnd.toISOString().split("T")[0]).then(
        (rows) => rows.reduce((sum, row) => sum + row.total, 0)
      ),
      getMonthlySales(previousMonthDate.getFullYear(), previousMonthDate.getMonth()),
      getYearlySales(previousYear),
      Promise.all(
        Array.from({ length: 7 }, (_, index) =>
          getDailySales(addDays(today, index - 6).toISOString().split("T")[0])
        )
      ),
      Promise.all(
        Array.from({ length: 8 }, (_, index) => {
          const weekAnchor = addDays(today, (index - 7) * 7)
          const weekStart = startOfWeek(weekAnchor)
          const weekEnd = endOfWeek(weekAnchor)
          return getTransactionsByDateRange(
            weekStart.toISOString().split("T")[0],
            weekEnd.toISOString().split("T")[0]
          ).then((rows) => rows.reduce((sum, row) => sum + row.total, 0))
        })
      ),
      Promise.all(
        Array.from({ length: 6 }, (_, index) => {
          const monthDate = addMonths(today, index - 5)
          return getMonthlySales(monthDate.getFullYear(), monthDate.getMonth())
        })
      ),
      Promise.all(
        Array.from({ length: 5 }, (_, index) => getYearlySales(today.getFullYear() + index - 4))
      ),
    ])

    setTransactions(nextTransactions)
    setProducts(getProducts())
    setIngredients(getIngredients())
    setSalesSnapshotData({
      daily: {
        label: "Daily Sales",
        value: nextDailySales,
        comparisonLabel: "Compared with yesterday",
        sparkline: dailySparkline,
        sparklineLabel: "Last 7 days",
        ...buildTrendLabel(nextDailySales, previousDailySales),
      },
      weekly: {
        label: "Weekly Sales",
        value: nextWeeklySales,
        comparisonLabel: "Compared with last week",
        sparkline: weeklySparkline,
        sparklineLabel: "Last 8 weeks",
        ...buildTrendLabel(nextWeeklySales, previousWeeklySales),
      },
      monthly: {
        label: "Monthly Sales",
        value: nextMonthlySales,
        comparisonLabel: "Compared with last month",
        sparkline: monthlySparkline,
        sparklineLabel: "Last 6 months",
        ...buildTrendLabel(nextMonthlySales, previousMonthlySales),
      },
      yearly: {
        label: "Yearly Sales",
        value: nextYearlySales,
        comparisonLabel: "Compared with last year",
        sparkline: yearlySparkline,
        sparklineLabel: "Last 5 years",
        ...buildTrendLabel(nextYearlySales, previousYearlySales),
      },
    })
    setLastSyncedAt(new Date())
  }, [fromDate, toDate])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("sales-analytics-transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        void loadData()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadData])

  const analytics = useMemo(() => {
    const revenue = transactions.reduce((sum, transaction) => sum + transaction.total, 0)
    const orders = transactions.length
    const averageTicket = orders ? revenue / orders : 0

    const productSales = new Map<string, { quantity: number; product: Product | null }>()
    const paymentMixBase = new Map<string, number>([
      ["Cash", 0],
      ["GCash", 0],
    ])
    const orderTypeBase = new Map<string, number>([
      ["Meal", 0],
      ["Beverage", 0],
      ["Mixed", 0],
      ["Combo", 0],
      ["Other", 0],
    ])
    const hourlyOrders = new Map<number, number>()

    transactions.forEach((transaction) => {
      paymentMixBase.set(
        transaction.paymentMethod === "gcash" ? "GCash" : "Cash",
        (paymentMixBase.get(transaction.paymentMethod === "gcash" ? "GCash" : "Cash") || 0) + transaction.total
      )
      orderTypeBase.set(
        transactionOrderType(transaction),
        (orderTypeBase.get(transactionOrderType(transaction)) || 0) + 1
      )

      const hourMatch = transaction.time.match(/(\d{1,2})/)
      const hour = hourMatch ? Number(hourMatch[1]) : 0
      const normalizedHour = transaction.time.toLowerCase().includes("pm") && hour < 12 ? hour + 12 : hour
      hourlyOrders.set(normalizedHour, (hourlyOrders.get(normalizedHour) || 0) + 1)

      transaction.items.forEach((item) => {
        const key = item.product.name
        const current = productSales.get(key)
        productSales.set(key, {
          quantity: (current?.quantity || 0) + item.quantity,
          product: products.find((product) => product.id === item.product.id) || item.product,
        })
      })
    })

    const topProducts = Array.from(productSales.entries())
      .map(([name, entry]) => ({ name, quantity: entry.quantity, product: entry.product }))
      .sort((left, right) => right.quantity - left.quantity)

    const paymentMixData: PaymentPoint[] = [
      { name: "Cash", value: paymentMixBase.get("Cash") || 0, fill: "#4a342a" },
      { name: "GCash", value: paymentMixBase.get("GCash") || 0, fill: "#b2967d" },
    ]

    const orderTypeData: OrderTypePoint[] = [
      { name: "Meal", orders: orderTypeBase.get("Meal") || 0, fill: "#4a342a" },
      { name: "Beverage", orders: orderTypeBase.get("Beverage") || 0, fill: "#7d5a44" },
      { name: "Mixed", orders: orderTypeBase.get("Mixed") || 0, fill: "#b2967d" },
      { name: "Combo", orders: orderTypeBase.get("Combo") || 0, fill: "#d7c9b8" },
    ].filter((entry) => entry.orders > 0)

    const dailyTrendMap = new Map<string, TrendPoint>()
    const weeklyTrendMap = new Map<string, TrendPoint>()
    const monthlyTrendMap = new Map<string, TrendPoint>()
    const yearlyTrendMap = new Map<string, TrendPoint>()

    transactions.forEach((transaction) => {
      const date = new Date(transaction.date)
      const dayLabel = formatShortDate(date)
      const weekStart = startOfWeek(date)
      const weekLabel = formatWeekLabel(weekStart)
      const monthLabel = formatMonthLabel(date)
      const yearLabel = String(date.getFullYear())

      const writePoint = (collection: Map<string, TrendPoint>, key: string, label: string) => {
        const current = collection.get(key) || { label, revenue: 0, orders: 0 }
        current.revenue += transaction.total
        current.orders += 1
        collection.set(key, current)
      }

      writePoint(dailyTrendMap, transaction.date, dayLabel)
      writePoint(weeklyTrendMap, `${weekStart.toISOString()}`, weekLabel)
      writePoint(monthlyTrendMap, `${date.getFullYear()}-${date.getMonth()}`, monthLabel)
      writePoint(yearlyTrendMap, yearLabel, yearLabel)
    })

    const comparisonData: ComparisonPoint[] = [
      { period: "Current", revenue, orders },
      {
        period: "Previous",
        revenue:
          transactions.length > 0
            ? transactions.reduce((sum, transaction) => {
                const transactionDate = new Date(transaction.date)
                const rangeLengthDays = Math.max(
                  1,
                  Math.round(
                    (new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000
                  ) + 1
                )
                const comparisonStart = addDays(new Date(fromDate), -rangeLengthDays)
                const comparisonEnd = addDays(new Date(toDate), -rangeLengthDays)
                return transactionDate >= comparisonStart && transactionDate <= comparisonEnd ? sum + transaction.total : sum
              }, 0)
            : 0,
        orders:
          transactions.length > 0
            ? transactions.filter((transaction) => {
                const transactionDate = new Date(transaction.date)
                const rangeLengthDays = Math.max(
                  1,
                  Math.round(
                    (new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000
                  ) + 1
                )
                const comparisonStart = addDays(new Date(fromDate), -rangeLengthDays)
                const comparisonEnd = addDays(new Date(toDate), -rangeLengthDays)
                return transactionDate >= comparisonStart && transactionDate <= comparisonEnd
              }).length
            : 0,
      },
    ]

    const inventoryAlerts = getInventoryAlerts(ingredients, { lowStockThreshold: 10, expiringThresholdDays: 3 })
    const lowStockCount = inventoryAlerts.lowStockIngredients.length
    const atRiskCount = inventoryAlerts.expiringSoonIngredients.length + inventoryAlerts.expiredIngredients.length

    const fastMovingLowStock: InventoryInsightPoint[] = topProducts
      .map((entry) => ({
        name: entry.name,
        quantitySold: entry.quantity,
        availableStock: entry.product ? getProductAvailableStock(entry.product, ingredients) : 0,
        urgency: (entry.product && getProductAvailableStock(entry.product, ingredients) <= 10 ? "critical" : "watch") as InventoryInsightPoint["urgency"],
      }))
      .filter((entry) => entry.availableStock <= 12)
      .slice(0, 5)

    const peakHoursData = Array.from(hourlyOrders.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([hour, count]) => ({
        label: `${String(hour).padStart(2, "0")}:00`,
        orders: count,
      }))

    return {
      revenue,
      orders,
      averageTicket,
      topProductLabel: topProducts[0]?.name || "No sales yet",
      paymentMixData,
      orderTypeData,
      trendSeries: {
        daily: Array.from(dailyTrendMap.values()),
        weekly: Array.from(weeklyTrendMap.values()),
        monthly: Array.from(monthlyTrendMap.values()),
        yearly: Array.from(yearlyTrendMap.values()),
      } satisfies Record<TrendView, TrendPoint[]>,
      comparisonData,
      topProducts,
      peakHoursData,
      lowStockCount,
      atRiskCount,
      fastMovingLowStock,
    }
  }, [fromDate, ingredients, products, toDate, transactions])

  const heroCards = [
    {
      label: "Total Revenue",
      value: formatCurrency(analytics.revenue),
      detail: `${fromDate} to ${toDate}`,
      tint: "from-[#4a342a] via-[#7d5a44] to-[#b2967d]",
      light: false,
    },
    {
      label: "Total Orders",
      value: String(analytics.orders),
      detail: "Completed orders in the selected range",
      tint: "from-[#b2967d] via-[#d7c9b8] to-[#f5f1ea]",
      light: true,
    },
    {
      label: "Average Ticket",
      value: formatCurrency(analytics.averageTicket),
      detail: "Average order value",
      tint: "from-[#7d5a44] via-[#b2967d] to-[#d7c9b8]",
      light: false,
    },
    {
      label: "Top-Selling Product",
      value: analytics.topProductLabel,
      detail: analytics.topProducts[0] ? `${analytics.topProducts[0].quantity} sold in the selected range` : "No recorded sales for this range",
      tint: "from-[#f5f1ea] via-[#d7c9b8] to-[#b2967d]",
      light: true,
    },
  ]

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-y-auto p-4 pt-20 lg:p-8 lg:pt-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-10 left-0 h-52 w-52 rounded-full bg-[#b2967d]/18 blur-3xl" />
          <div className="absolute right-8 top-28 h-48 w-48 rounded-full bg-[#7d5a44]/12 blur-3xl" />
        </div>

        <div className="relative mb-6 rounded-[30px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/38 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.75)] backdrop-blur-xl lg:mb-8 lg:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.32em] text-[#7d5a44]">BUSINESS INTELLIGENCE</p>
              <h1 className="mb-2 text-2xl font-bold text-[#4a342a] lg:text-4xl">Sales Analytics</h1>
              <p className="max-w-3xl text-sm text-muted-foreground lg:text-base">
                A focused insight dashboard for trends, mix, throughput, revenue quality, and inventory pressure across the selected period.
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.24em] text-[#7d5a44]/75">
                {lastSyncedAt ? `Live sync active • Updated ${lastSyncedAt.toLocaleTimeString()}` : "Connecting live sync..."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 px-3 py-2 backdrop-blur-sm">
                <Calendar className="h-4 w-4 text-[#4a342a]" />
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-muted-foreground">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="bg-transparent font-medium outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 px-3 py-2 backdrop-blur-sm">
                <Calendar className="h-4 w-4 text-[#4a342a]" />
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-muted-foreground">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="bg-transparent font-medium outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:mb-8 lg:gap-4">
          {heroCards.map((card) => (
            <div
              key={card.label}
              className={`group relative overflow-hidden rounded-[24px] border border-[#f5f1ea]/55 bg-gradient-to-br ${card.tint} p-[1px] shadow-[0_18px_36px_rgba(123,111,25,0.10)]`}
            >
              <div className={`relative h-full rounded-[23px] p-5 backdrop-blur-sm lg:p-6 ${card.light ? "bg-[#f5f1ea]/88 text-[#4a342a]" : "bg-[rgba(245,241,234,0.14)] text-[#f5f1ea]"}`}>
                <div className="absolute inset-x-0 top-0 h-px bg-[#f5f1ea]/45" />
                <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full ${card.light ? "bg-[#f5f1ea]/35" : "bg-[#f5f1ea]/10"} blur-sm transition-transform duration-300 group-hover:scale-110`} />
                <div className="relative">
                  <p className={`mb-1 text-sm ${card.light ? "text-[#7d5a44]" : "text-[#f5f1ea]/75"}`}>{card.label}</p>
                  <p className={`text-2xl font-bold ${card.label === "Top-Selling Product" ? "lg:text-[2rem]" : "lg:text-3xl"}`}>{card.value}</p>
                  <p className={`mt-3 text-xs leading-5 ${card.light ? "text-[#7d5a44]" : "text-[#f5f1ea]/70"}`}>{card.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:mb-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          <div className="relative">
            <SalesSnapshotCard data={salesSnapshotData} />
          </div>

          <Panel
            title="Revenue Comparison"
            description="Compare current period performance against the previous equivalent window."
            icon={Layers3}
          >
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Low-stock ingredients</p>
                <p className="mt-2 text-3xl font-bold text-[#4a342a]">{analytics.lowStockCount}</p>
              </div>
              <div className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea]/70 p-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">At-risk inventory</p>
                <p className="mt-2 text-3xl font-bold text-[#4a342a]">{analytics.atRiskCount}</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.comparisonData} barGap={18}>
                <CartesianGrid vertical={false} stroke="#d7c9b8" strokeDasharray="3 3" />
                <XAxis dataKey="period" axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number, name: string) => (name === "revenue" ? formatCurrency(value) : value)} />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" fill="#4a342a" radius={[10, 10, 0, 0]} name="Revenue" />
                <Bar yAxisId="right" dataKey="orders" fill="#b2967d" radius={[10, 10, 0, 0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:mb-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-8">
          <Panel
            title="Trend Explorer"
            description="Interactive sales trends across daily, weekly, monthly, and yearly perspectives."
            icon={TrendingUp}
          >
            <div className="mb-4 flex flex-wrap gap-2">
              {(["daily", "weekly", "monthly", "yearly"] as TrendView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setTrendView(view)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                    trendView === view
                      ? "bg-[#4a342a] text-[#f5f1ea]"
                      : "border border-[#d7c9b8] bg-[#f5f1ea]/70 text-[#7d5a44] hover:bg-[#ede3d8]"
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={analytics.trendSeries[trendView]}>
                <defs>
                  <linearGradient id="analytics-revenue-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#4a342a" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#4a342a" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#d7c9b8" strokeDasharray="3 3" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number, name: string) => (name === "Revenue" ? formatCurrency(value) : value)} />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#4a342a" fill="url(#analytics-revenue-fill)" strokeWidth={3} name="Revenue" />
                <Bar yAxisId="right" dataKey="orders" fill="#b2967d" radius={[8, 8, 0, 0]} name="Orders" />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          <Panel
            title="Payment Distribution"
            description="Revenue split across checkout methods."
            icon={Wallet}
          >
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={analytics.paymentMixData}
                  cx="50%"
                  cy="52%"
                  labelLine={false}
                  label={renderPieLabel}
                  outerRadius={94}
                  innerRadius={46}
                  dataKey="value"
                >
                  {analytics.paymentMixData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:mb-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8">
          <Panel
            title="Order Type Analytics"
            description="Order composition derived from what customers actually bought."
            icon={PieChartIcon}
          >
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={analytics.orderTypeData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid horizontal={false} stroke="#d7c9b8" strokeDasharray="3 3" />
                <XAxis type="number" axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={88} />
                <Tooltip formatter={(value: number) => `${value} orders`} />
                <Bar dataKey="orders" radius={[0, 10, 10, 0]}>
                  {analytics.orderTypeData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel
            title="Peak Business Hours"
            description="Service pressure across the hours represented in the selected range."
            icon={Clock3}
          >
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={analytics.peakHoursData}>
                <CartesianGrid vertical={false} stroke="#d7c9b8" strokeDasharray="3 3" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number) => `${value} orders`} />
                <Bar dataKey="orders" fill="#7d5a44" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          <Panel
            title="Top-Selling Products"
            description="Fastest-moving products by quantity sold in the selected period."
            icon={Activity}
          >
            <div className="space-y-4">
              {analytics.topProducts.slice(0, 6).map((product) => (
                <div key={product.name}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-[#4a342a]">{product.name}</span>
                    <span className="text-sm font-bold text-[#4a342a]">{product.quantity}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#d7c9b8]">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-[#7d5a44] to-[#b2967d]"
                      style={{ width: `${(product.quantity / Math.max(1, analytics.topProducts[0]?.quantity || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Inventory-Related Insights"
            description="Fast-moving items that may need attention from stock or prep planning."
            icon={PackageSearch}
          >
            <div className="space-y-3">
              {analytics.fastMovingLowStock.length === 0 ? (
                <div className="rounded-[22px] border border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-4 text-sm leading-7 text-[#7d5a44]">
                  No fast-moving low-stock products are currently flagged in this date range.
                </div>
              ) : (
                analytics.fastMovingLowStock.map((item) => (
                  <div key={item.name} className="rounded-[22px] border border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#4a342a]">{item.name}</p>
                        <p className="mt-1 text-sm text-[#7d5a44]">
                          {item.quantitySold} sold • {item.availableStock} available
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                        item.urgency === "critical"
                          ? "bg-red-100 text-red-700"
                          : "bg-[#e8ddd2] text-[#7d5a44]"
                      }`}>
                        {item.urgency === "critical" ? "Critical" : "Watch"}
                      </span>
                    </div>
                  </div>
                ))
              )}

              <div className="rounded-[22px] border border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-4 text-sm leading-7 text-[#7d5a44]">
                Revenue quality is strongest when top sellers stay stocked and peak-hour demand aligns with prep capacity.
              </div>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  )
}
