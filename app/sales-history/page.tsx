"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { SalesSnapshotCard } from "@/components/sales-snapshot-card"
import type { SalesSnapshotData } from "@/components/sales-snapshot-card"
import { FileText, Calendar, Download, TrendingUp } from "lucide-react"
import {
  initializeSupabaseStore,
  getTransactionsByDateRange,
  getDailySales,
  getSalesTotalByDateRange,
  getWeeklySales,
  getMonthlySales,
  getYearlySales,
  getSalesOverTime,
  getSalesByCategory,
  getTopProducts,
  getPeakHours,
} from "@/lib/store"
import type { SalesOverTimePoint, SalesByCategory, TopProduct, PeakHour } from "@/lib/store"
import type { Transaction } from "@/lib/types"
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

function getDefaultRange() {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 6)

  return {
    fromDate: startDate.toISOString().split("T")[0],
    toDate: endDate.toISOString().split("T")[0],
  }
}

function paymentMethodLabel(paymentMethod: Transaction["paymentMethod"]) {
  return paymentMethod === "gcash" ? "GCash" : "Cash"
}

function renderCategoryLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  category,
}: {
  cx?: number
  cy?: number
  midAngle?: number
  innerRadius?: number
  outerRadius?: number
  percent?: number
  category?: string
}) {
  if (
    cx === undefined ||
    cy === undefined ||
    midAngle === undefined ||
    innerRadius === undefined ||
    outerRadius === undefined ||
    percent === undefined ||
    !category
  ) {
    return null
  }

  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 1.24
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN) + (yNeedsLift(midAngle) ? -10 : 0)

  return (
    <text
      x={x}
      y={y}
      fill="#7d5a44"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={14}
      fontWeight={700}
    >
      {`${category} ${Math.round(percent * 100)}%`}
    </text>
  )
}

function yNeedsLift(midAngle: number) {
  return midAngle > 45 && midAngle < 135
}

function getWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
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

export default function SalesHistoryPage() {
  const defaults = getDefaultRange()
  const [fromDate, setFromDate] = useState(defaults.fromDate)
  const [toDate, setToDate] = useState(defaults.toDate)
  const [chartPeriod, setChartPeriod] = useState<"daily" | "weekly">("daily")

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [rangeTotal, setRangeTotal] = useState(0)
  const [dailySales, setDailySales] = useState(0)
  const [weeklySales, setWeeklySales] = useState(0)
  const [monthlySales, setMonthlySales] = useState(0)
  const [yearlySales, setYearlySales] = useState(0)
  const [salesSnapshotData, setSalesSnapshotData] = useState<SalesSnapshotData>({
    daily: {
      label: "Daily Sales",
      value: 0,
      comparisonLabel: "Compared with yesterday",
      trendLabel: "No change",
      trendDirection: "neutral" as const,
      trendPercentage: 0,
      sparkline: [0, 0, 0, 0, 0, 0, 0],
      sparklineLabel: "Last 7 days",
    },
    weekly: {
      label: "Weekly Sales",
      value: 0,
      comparisonLabel: "Compared with last week",
      trendLabel: "No change",
      trendDirection: "neutral" as const,
      trendPercentage: 0,
      sparkline: [0, 0, 0, 0, 0, 0, 0, 0],
      sparklineLabel: "Last 8 weeks",
    },
    monthly: {
      label: "Monthly Sales",
      value: 0,
      comparisonLabel: "Compared with last month",
      trendLabel: "No change",
      trendDirection: "neutral" as const,
      trendPercentage: 0,
      sparkline: [0, 0, 0, 0, 0, 0],
      sparklineLabel: "Last 6 months",
    },
    yearly: {
      label: "Yearly Sales",
      value: 0,
      comparisonLabel: "Compared with last year",
      trendLabel: "No change",
      trendDirection: "neutral" as const,
      trendPercentage: 0,
      sparkline: [0, 0, 0, 0, 0],
      sparklineLabel: "Last 5 years",
    },
  })
  const [salesOverTime, setSalesOverTime] = useState<SalesOverTimePoint[]>([])
  const [salesByCategory, setSalesByCategory] = useState<SalesByCategory[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [peakHours, setPeakHours] = useState<PeakHour[]>([])

  useEffect(() => {
    const loadData = async () => {
      await initializeSupabaseStore()
      const startDate = new Date(fromDate)
      const endDate = new Date(toDate)
      const today = new Date()

      if (startDate > endDate) return
      const todayKey = formatDateKey(today)
      const previousDay = addDays(today, -1)
      const previousWeekDate = addDays(today, -7)
      const previousWeekStart = startOfWeek(previousWeekDate)
      const previousWeekEnd = endOfWeek(previousWeekDate)
      const previousMonthDate = addMonths(today, -1)
      const previousYear = today.getFullYear() - 1

      const [
        nextTransactions,
        nextRangeTotal,
        nextDailySales,
        nextWeeklySales,
        nextMonthlySales,
        nextYearlySales,
        nextSalesOverTime,
        nextSalesByCategory,
        nextTopProducts,
        nextPeakHours,
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
        getSalesTotalByDateRange(fromDate, toDate),
        getDailySales(todayKey),
        getWeeklySales(today.getFullYear(), getWeekNumber(today)),
        getMonthlySales(today.getFullYear(), today.getMonth()),
        getYearlySales(today.getFullYear()),
        getSalesOverTime(startDate, endDate),
        getSalesByCategory(startDate, endDate),
        getTopProducts(startDate, endDate, 5),
        getPeakHours(startDate, endDate),
        getDailySales(formatDateKey(previousDay)),
        getSalesTotalByDateRange(formatDateKey(previousWeekStart), formatDateKey(previousWeekEnd)),
        getMonthlySales(previousMonthDate.getFullYear(), previousMonthDate.getMonth()),
        getYearlySales(previousYear),
        Promise.all(
          Array.from({ length: 7 }, (_, index) => {
            const date = addDays(today, index - 6)
            return getDailySales(formatDateKey(date))
          })
        ),
        Promise.all(
          Array.from({ length: 8 }, (_, index) => {
            const weekAnchor = addDays(today, (index - 7) * 7)
            const weekStart = startOfWeek(weekAnchor)
            const weekEnd = endOfWeek(weekAnchor)
            return getSalesTotalByDateRange(formatDateKey(weekStart), formatDateKey(weekEnd))
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
      setRangeTotal(nextRangeTotal)
      setDailySales(nextDailySales)
      setWeeklySales(nextWeeklySales)
      setMonthlySales(nextMonthlySales)
      setYearlySales(nextYearlySales)
      setSalesOverTime(nextSalesOverTime)
      setSalesByCategory(nextSalesByCategory)
      setTopProducts(nextTopProducts)
      setPeakHours(nextPeakHours)

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
    }

    loadData()
  }, [fromDate, toDate])

  const exportToCSV = () => {
    const headers = ["Transaction ID", "Date", "Time", "Items", "Payment Method", "Amount"]
    const rows = transactions.map((t) => [t.id, t.date, t.time, t.items.length, paymentMethodLabel(t.paymentMethod), t.total])

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `sales-${fromDate}-to-${toDate}.csv`
    a.click()
  }

  const averageTicket = transactions.length ? rangeTotal / transactions.length : 0
  const topProductLabel = topProducts[0]?.name || "No sales yet"
  const salesCards = [
    {
      label: "Range Sales",
      value: `\u20B1${rangeTotal.toFixed(2)}`,
      detail: `${fromDate} to ${toDate}`,
      tint: "from-[#4a342a] via-[#7d5a44] to-[#b2967d]",
      light: false,
      span: "",
    },
    {
      label: "Transactions",
      value: String(transactions.length),
      detail: "Completed orders in the selected range",
      tint: "from-[#b2967d] via-[#d7c9b8] to-[#f5f1ea]",
      light: true,
      span: "",
    },
    {
      label: "Top Product",
      value: topProductLabel,
      detail: topProducts[0] ? `${topProducts[0].quantity} sold in selected range` : "No recorded sales for this range",
      tint: "from-[#7d5a44] via-[#b2967d] to-[#d7c9b8]",
      light: false,
      span: "",
    },
    {
      label: "Average Ticket",
      value: `\u20B1${averageTicket.toFixed(2)}`,
      detail: "Average value per transaction",
      tint: "from-[#f5f1ea] via-[#d7c9b8] to-[#b2967d]",
      light: true,
      span: "",
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

        <div className="relative mb-6 rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/38 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.75)] backdrop-blur-xl lg:mb-8 lg:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.32em] text-[#7d5a44]">REPORTING SUITE</p>
              <h1 className="mb-2 text-2xl font-bold text-[#4a342a] lg:text-4xl">Sales History & Analytics</h1>
              <p className="max-w-3xl text-sm text-muted-foreground lg:text-base">
                Filter history, charts, and summary cards by the same date range for a cleaner reporting flow.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 px-3 py-2 backdrop-blur-sm">
                <Calendar className="h-4 w-4 text-[#4a342a]" />
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-muted-foreground">From</label>
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-transparent font-medium outline-none" />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 px-3 py-2 backdrop-blur-sm">
                <Calendar className="h-4 w-4 text-[#4a342a]" />
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-muted-foreground">To</label>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-transparent font-medium outline-none" />
                </div>
              </div>

              <button onClick={exportToCSV} className="flex items-center gap-2 rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 px-4 py-2 text-sm font-medium transition-colors hover:bg-[#f5f1ea]/80">
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        <div className="relative mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:mb-8 lg:gap-4">
          {salesCards.map((card) => (
            <div
              key={card.label}
              className={`group relative overflow-hidden rounded-[24px] border border-[#f5f1ea]/55 bg-gradient-to-br ${card.tint} p-[1px] shadow-[0_18px_36px_rgba(123,111,25,0.10)] ${card.span}`}
            >
              <div className={`relative h-full rounded-[23px] p-5 backdrop-blur-sm lg:p-6 ${card.light ? "bg-[#f5f1ea]/88 text-[#4a342a]" : "bg-[rgba(245,241,234,0.14)] text-[#f5f1ea]"}`}>
                <div className="absolute inset-x-0 top-0 h-px bg-[#f5f1ea]/45" />
                <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full ${card.light ? "bg-[#f5f1ea]/35" : "bg-[#f5f1ea]/10"} blur-sm transition-transform duration-300 group-hover:scale-110`} />

                <div className="relative">
                  <p className={`mb-1 text-sm ${card.light ? "text-[#7d5a44]" : "text-[#f5f1ea]/75"}`}>{card.label}</p>
                  <p className={`text-2xl font-bold ${card.label === "Top Product" ? "lg:text-[2rem]" : "lg:text-3xl"}`}>{card.value}</p>
                  <p className={`mt-3 text-xs leading-5 ${card.light ? "text-[#7d5a44]" : "text-[#f5f1ea]/70"}`}>{card.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="relative mb-6 lg:mb-8">
          <SalesSnapshotCard data={salesSnapshotData} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:mb-8 lg:grid-cols-2 lg:gap-8">
          <div className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl lg:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground lg:text-xl">Sales Over Time</h2>
                <p className="text-xs text-muted-foreground lg:text-sm">Revenue movement for the selected range.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setChartPeriod("daily")} className={`rounded-xl px-3 py-1.5 text-xs font-medium ${chartPeriod === "daily" ? "bg-[#4a342a] text-[#f5f1ea]" : "bg-muted text-foreground"}`}>
                  Daily
                </button>
                <button onClick={() => setChartPeriod("weekly")} className={`rounded-xl px-3 py-1.5 text-xs font-medium ${chartPeriod === "weekly" ? "bg-[#7d5a44] text-[#f5f1ea]" : "bg-muted text-foreground"}`}>
                  Weekly
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d7c9b8" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(value) => `\u20B1${value}`} />
                <Line type="monotone" dataKey="sales" stroke="#4a342a" strokeWidth={3} dot={false} isAnimationActive />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl lg:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground lg:text-xl">Sales by Category</h2>
                <p className="text-xs text-muted-foreground lg:text-sm">Revenue distribution across menu groups.</p>
              </div>
              <TrendingUp className="h-5 w-5 text-[#4a342a]" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={salesByCategory}
                  cx="50%"
                  cy="54%"
                  labelLine={false}
                  label={renderCategoryLabel}
                  outerRadius={100}
                  fill="#4a342a"
                  dataKey="sales"
                >
                  {salesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `\u20B1${value}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:mb-8 lg:grid-cols-2 lg:gap-8">
          <div className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl lg:p-6">
            <h2 className="mb-4 text-lg font-bold text-foreground lg:text-xl">Peak Hours</h2>
            <p className="mb-4 text-xs text-muted-foreground lg:text-sm">Busy periods based on recorded order times.</p>
            <div className="space-y-3">
              {peakHours.slice(0, 8).map((peak, idx) => (
                <div key={idx}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium">{peak.hour}</span>
                    <span className="text-sm text-muted-foreground">{peak.orders} orders</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#d7c9b8]">
                    <div className="h-2 rounded-full bg-gradient-to-r from-[#4a342a] to-[#b2967d]" style={{ width: `${peak.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl lg:p-6">
            <h2 className="mb-4 text-lg font-bold text-foreground lg:text-xl">Top Selling Products</h2>
            <p className="mb-4 text-xs text-muted-foreground lg:text-sm">Best-performing items by quantity sold.</p>
            <div className="space-y-3">
              {topProducts.map((product, idx) => (
                <div key={idx}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium">{product.name}</span>
                    <span className="text-sm font-bold text-[#4a342a]">{product.quantity}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#d7c9b8]">
                    <div className="h-2 rounded-full bg-gradient-to-r from-[#7d5a44] to-[#b2967d]" style={{ width: `${(product.quantity / Math.max(1, topProducts[0]?.quantity || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl">
          <div className="border-b border-[#f5f1ea]/45 p-4 lg:p-6">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-2xl bg-[#f5f1ea] p-2">
                <FileText className="h-5 w-5 text-[#4a342a]" />
              </div>
              <h2 className="text-lg font-bold text-foreground lg:text-xl">Sales Transactions</h2>
            </div>
            <p className="text-xs text-muted-foreground lg:text-sm">Transactions limited to the selected date range.</p>
          </div>

          <div className="lg:hidden">
            {transactions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No transactions</div>
            ) : (
              transactions.map((transaction) => (
                <div key={transaction.id} className="border-b border-[#f5f1ea]/45 p-4 last:border-0">
                  <div className="mb-2 flex items-start justify-between">
                    <p className="font-medium">{transaction.id}</p>
                    <p className="font-bold text-[#4a342a]">{`\u20B1${transaction.total.toFixed(2)}`}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{transaction.date} {transaction.time}</p>
                  <p className="text-xs text-muted-foreground">{paymentMethodLabel(transaction.paymentMethod)}</p>
                </div>
              ))
            )}
          </div>

          <div className="hidden lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f5f1ea]/45">
                  <th className="px-6 py-4 text-left font-semibold text-foreground">Transaction ID</th>
                  <th className="px-6 py-4 text-left font-semibold text-foreground">Date</th>
                  <th className="px-6 py-4 text-left font-semibold text-foreground">Time</th>
                  <th className="px-6 py-4 text-left font-semibold text-foreground">Payment Method</th>
                  <th className="px-6 py-4 text-left font-semibold text-foreground">Processed By</th>
                  <th className="px-6 py-4 text-right font-semibold text-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No transactions for this range
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-[#f5f1ea]/45 last:border-0 hover:bg-[#f5f1ea]/30">
                      <td className="px-6 py-4 font-medium">{transaction.id}</td>
                      <td className="px-6 py-4 text-muted-foreground">{transaction.date}</td>
                      <td className="px-6 py-4 text-muted-foreground">{transaction.time}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${transaction.paymentMethod === "cash" ? "bg-[#f5f1ea] text-[#4a342a]" : "bg-[#d7c9b8] text-[#7d5a44]"}`}>
                          {paymentMethodLabel(transaction.paymentMethod)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{transaction.processedBy}</td>
                      <td className="px-6 py-4 text-right font-bold text-[#4a342a]">{`\u20B1${transaction.total.toFixed(2)}`}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}


