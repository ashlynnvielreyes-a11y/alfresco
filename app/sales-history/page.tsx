"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { FileText, Calendar, Download, TrendingUp } from "lucide-react"
import {
  getTransactionsByDate,
  getDailySales,
  getMonthlySales,
  getYearlySales,
  getSalesOverTime,
  getSalesByCategory,
  getTopProducts,
  getPeakHours,
} from "@/lib/store"
import type { SalesOverTimePoint, SalesByCategory, TopProduct, PeakHour } from "@/lib/store"
import type { Transaction } from "@/lib/types"
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export default function SalesHistoryPage() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    return now.toISOString().split("T")[0]
  })
  const [timePeriod, setTimePeriod] = useState<"today" | "week" | "month">("week")
  const [chartPeriod, setChartPeriod] = useState<"daily" | "weekly">("daily")

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [dailyTotal, setDailyTotal] = useState(0)
  const [weeklyTotal, setWeeklyTotal] = useState(0)
  const [monthlyTotal, setMonthlyTotal] = useState(0)
  const [yearlyTotal, setYearlyTotal] = useState(0)

  const [salesOverTime, setSalesOverTime] = useState<SalesOverTimePoint[]>([])
  const [salesByCategory, setSalesByCategory] = useState<SalesByCategory[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [peakHours, setPeakHours] = useState<PeakHour[]>([])

  useEffect(() => {
    const loadData = async () => {
      const currentDate = new Date(selectedDate)

      let startDate: Date
      let endDate: Date

      if (timePeriod === "today") {
        startDate = new Date(currentDate)
        endDate = new Date(currentDate)
      } else if (timePeriod === "week") {
        startDate = new Date(currentDate)
        startDate.setDate(currentDate.getDate() - 7)
        endDate = new Date(currentDate)
      } else {
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      }

      setTransactions(await getTransactionsByDate(selectedDate))
      setDailyTotal(await getDailySales(selectedDate))

      const weekStart = new Date(currentDate)
      weekStart.setDate(currentDate.getDate() - ((currentDate.getDay() + 6) % 7))
      const weeklyTotals = await Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const d = new Date(weekStart)
          d.setDate(weekStart.getDate() + i)
          return getDailySales(d.toISOString().split("T")[0])
        })
      )
      setWeeklyTotal(weeklyTotals.reduce((a, b) => a + b, 0))

      setMonthlyTotal(await getMonthlySales(currentDate.getFullYear(), currentDate.getMonth()))
      setYearlyTotal(await getYearlySales(currentDate.getFullYear()))

      setSalesOverTime(await getSalesOverTime(startDate, endDate))
      setSalesByCategory(await getSalesByCategory(startDate, endDate))
      setTopProducts(await getTopProducts(startDate, endDate, 5))
      setPeakHours(await getPeakHours(startDate, endDate))
    }

    loadData()
  }, [selectedDate, timePeriod])

  const getMonthName = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }

  const exportToCSV = () => {
    const headers = ["Transaction ID", "Date", "Time", "Items", "Payment Method", "Amount"]
    const rows = transactions.map((t) => [t.id, t.date, t.time, t.items.length, t.paymentMethod, t.total])

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `sales-${selectedDate}.csv`
    a.click()
  }

  const totalCards = [
    { label: "Daily Sales", value: `\u20B1${dailyTotal.toFixed(2)}`, tint: "from-[#bb3e00] to-[#8f2f00]" },
    { label: "Weekly Sales", value: `\u20B1${weeklyTotal.toFixed(2)}`, tint: "from-[#f7a645] to-[#cf7d2d]" },
    { label: `Monthly Sales (${getMonthName(selectedDate)})`, value: `\u20B1${monthlyTotal.toFixed(2)}`, tint: "from-[#7b6f19] to-[#a79630]" },
    { label: "Yearly Sales", value: `\u20B1${yearlyTotal.toFixed(2)}`, tint: "from-[#bb3e00] to-[#f7a645]" },
  ]

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-y-auto p-4 pt-20 lg:p-8 lg:pt-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-10 left-0 h-52 w-52 rounded-full bg-[#f7a645]/18 blur-3xl" />
          <div className="absolute right-8 top-28 h-48 w-48 rounded-full bg-[#7b6f19]/12 blur-3xl" />
        </div>

        <div className="relative mb-6 rounded-[28px] border border-white/55 bg-white/50 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl lg:mb-8 lg:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.32em] text-[#7b6f19]">REPORTING SUITE</p>
              <h1 className="mb-2 text-2xl font-bold text-[#bb3e00] lg:text-4xl">Sales History & Analytics</h1>
              <p className="max-w-3xl text-sm text-muted-foreground lg:text-base">
                Trend charts, category mix, peak-hour activity, and transaction history in the same warm glass system.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-white/55 bg-white/60 px-3 py-2 backdrop-blur-sm">
                <Calendar className="h-4 w-4 text-[#bb3e00]" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-sm font-medium outline-none"
                />
              </div>

              <div className="flex gap-1 rounded-2xl border border-white/55 bg-white/60 p-1 backdrop-blur-sm">
                {(["today", "week", "month"] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setTimePeriod(period)}
                    className={`rounded-xl px-3 py-2 text-xs font-medium transition-all lg:text-sm ${
                      timePeriod === period
                        ? "bg-gradient-to-r from-[#bb3e00] to-[#f7a645] text-white shadow-[0_10px_18px_rgba(187,62,0,0.18)]"
                        : "text-foreground hover:bg-white/70"
                    }`}
                  >
                    {period === "today" ? "Today" : period === "week" ? "Week" : "Month"}
                  </button>
                ))}
              </div>

              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 rounded-2xl border border-white/55 bg-white/60 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/80"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        <div className="relative mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mb-8 lg:grid-cols-4 lg:gap-4">
          {totalCards.map((card) => (
            <div
              key={card.label}
              className={`overflow-hidden rounded-[24px] bg-gradient-to-br ${card.tint} p-[1px] shadow-[0_18px_34px_rgba(123,111,25,0.10)]`}
            >
              <div className="rounded-[23px] bg-[rgba(255,255,255,0.14)] px-4 py-4 text-white backdrop-blur-sm lg:px-5 lg:py-5">
                <p className="text-xs text-white/75 lg:text-sm">{card.label}</p>
                <p className="mt-2 text-xl font-bold lg:text-2xl">{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:mb-8 lg:grid-cols-2 lg:gap-8">
          <div className="rounded-[28px] border border-white/55 bg-white/52 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl lg:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground lg:text-xl">Sales Over Time</h2>
                <p className="text-xs text-muted-foreground lg:text-sm">Revenue movement for the selected range.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setChartPeriod("daily")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium ${
                    chartPeriod === "daily" ? "bg-[#bb3e00] text-white" : "bg-muted text-foreground"
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setChartPeriod("weekly")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium ${
                    chartPeriod === "weekly" ? "bg-[#7b6f19] text-white" : "bg-muted text-foreground"
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5d3ae" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(value) => `\u20B1${value}`} />
                <Line type="monotone" dataKey="sales" stroke="#bb3e00" strokeWidth={3} dot={false} isAnimationActive />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-[28px] border border-white/55 bg-white/52 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl lg:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground lg:text-xl">Sales by Category</h2>
                <p className="text-xs text-muted-foreground lg:text-sm">Revenue distribution across menu groups.</p>
              </div>
              <TrendingUp className="h-5 w-5 text-[#bb3e00]" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={salesByCategory}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percentage }) => `${category} ${percentage}%`}
                  outerRadius={100}
                  fill="#bb3e00"
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
          <div className="rounded-[28px] border border-white/55 bg-white/52 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl lg:p-6">
            <h2 className="mb-4 text-lg font-bold text-foreground lg:text-xl">Peak Hours</h2>
            <p className="mb-4 text-xs text-muted-foreground lg:text-sm">Busy periods based on recorded order times.</p>
            <div className="space-y-3">
              {peakHours.slice(0, 8).map((peak, idx) => (
                <div key={idx}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium">{peak.hour}</span>
                    <span className="text-sm text-muted-foreground">{peak.orders} orders</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#f3e6c9]">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-[#bb3e00] to-[#f7a645]"
                      style={{ width: `${peak.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/55 bg-white/52 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl lg:p-6">
            <h2 className="mb-4 text-lg font-bold text-foreground lg:text-xl">Top Selling Products</h2>
            <p className="mb-4 text-xs text-muted-foreground lg:text-sm">Best-performing items by quantity sold.</p>
            <div className="space-y-3">
              {topProducts.map((product, idx) => (
                <div key={idx}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium">{product.name}</span>
                    <span className="text-sm font-bold text-[#bb3e00]">{product.quantity}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#f3e6c9]">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-[#7b6f19] to-[#f7a645]"
                      style={{ width: `${(product.quantity / Math.max(1, topProducts[0]?.quantity || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/55 bg-white/52 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl">
          <div className="border-b border-white/45 p-4 lg:p-6">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-2xl bg-[#fff1d7] p-2">
                <FileText className="h-5 w-5 text-[#bb3e00]" />
              </div>
              <h2 className="text-lg font-bold text-foreground lg:text-xl">Sales Transactions</h2>
            </div>
            <p className="text-xs text-muted-foreground lg:text-sm">
              Latest transactions for the selected period with accountability tracking.
            </p>
          </div>

          <div className="lg:hidden">
            {transactions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No transactions</div>
            ) : (
              transactions.map((transaction) => (
                <div key={transaction.id} className="border-b border-white/45 p-4 last:border-0">
                  <div className="mb-2 flex items-start justify-between">
                    <p className="font-medium">{transaction.id}</p>
                    <p className="font-bold text-[#bb3e00]">{`\u20B1${transaction.total.toFixed(2)}`}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{transaction.date} {transaction.time}</p>
                  <p className="text-xs text-muted-foreground">{transaction.paymentMethod}</p>
                </div>
              ))
            )}
          </div>

          <div className="hidden lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/45">
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
                      No transactions for this date
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-white/45 last:border-0 hover:bg-white/30">
                      <td className="px-6 py-4 font-medium">{transaction.id}</td>
                      <td className="px-6 py-4 text-muted-foreground">{transaction.date}</td>
                      <td className="px-6 py-4 text-muted-foreground">{transaction.time}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            transaction.paymentMethod === "cash"
                              ? "bg-[#fff1d7] text-[#bb3e00]"
                              : "bg-[#f3edd0] text-[#7b6f19]"
                          }`}
                        >
                          {transaction.paymentMethod === "cash"
                            ? "Cash"
                            : transaction.paymentMethod === "gcash"
                              ? "GCash"
                              : transaction.paymentMethod === "card"
                                ? "Card"
                                : "Grab Pay"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{transaction.processedBy}</td>
                      <td className="px-6 py-4 text-right font-bold text-[#bb3e00]">
                        {`\u20B1${transaction.total.toFixed(2)}`}
                      </td>
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
