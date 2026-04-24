"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { FileText, Calendar, Download, TrendingUp } from "lucide-react"
import { getTransactionsByDate, getDailySales, getMonthlySales, getYearlySales, getSalesOverTime, getSalesByCategory, getTopProducts, getPeakHours } from "@/lib/store"
import type { SalesOverTimePoint, SalesByCategory, TopProduct, PeakHour } from "@/lib/store"
import type { Transaction } from "@/lib/types"
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

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
      
      // Get date range based on time period
      let startDate: Date, endDate: Date
      
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
      
      // Update transactions
      setTransactions(await getTransactionsByDate(selectedDate))
      
      // Update sales totals
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
      
      // Get chart data
      setSalesOverTime(await getSalesOverTime(startDate, endDate))
      setSalesByCategory(await getSalesByCategory(startDate, endDate))
      setTopProducts(await getTopProducts(startDate, endDate, 5))
      setPeakHours(await getPeakHours(startDate, endDate))
    }
    
    loadData()
  }, [selectedDate, timePeriod])

  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    })
  }

  const getMonthName = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }

  const getDayOfMonth = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const exportToCSV = () => {
    const headers = ["Transaction ID", "Date", "Time", "Items", "Payment Method", "Amount"]
    const rows = transactions.map(t => [
      t.id,
      t.date,
      t.time,
      t.items.length,
      t.paymentMethod,
      t.total
    ])
    
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n")
    
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `sales-${selectedDate}.csv`
    a.click()
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 p-4 pt-20 lg:pt-6 lg:p-6 overflow-y-auto">
        {/* Header Section */}
        <div className="bg-[#F5E6E8] rounded-lg p-4 lg:p-6 mb-6 lg:mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold text-[#A61F30] mb-2">
                Sales History & Analytics
              </h1>
              <p className="text-muted-foreground text-sm lg:text-base">
                Modern reporting with trend charts, category mix, top products, peak-hour analysis, and a full sales transaction list.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2">
                <Calendar className="h-4 w-4 text-[#A61F30]" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border-0 outline-none bg-transparent font-medium text-sm"
                />
              </div>
              
              <div className="flex gap-1">
                <button
                  onClick={() => setTimePeriod("today")}
                  className={`px-3 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors ${
                    timePeriod === "today"
                      ? "bg-[#A61F30] text-white"
                      : "bg-white border border-border text-foreground hover:bg-muted"
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setTimePeriod("week")}
                  className={`px-3 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors ${
                    timePeriod === "week"
                      ? "bg-[#A61F30] text-white"
                      : "bg-white border border-border text-foreground hover:bg-muted"
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setTimePeriod("month")}
                  className={`px-3 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors ${
                    timePeriod === "month"
                      ? "bg-[#A61F30] text-white"
                      : "bg-white border border-border text-foreground hover:bg-muted"
                  }`}
                >
                  Month
                </button>
              </div>
              
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sales Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
          <div className="bg-gradient-to-br from-[#A61F30] to-[#8B1826] rounded-xl p-3 lg:p-4 text-white">
            <p className="text-white/80 text-xs lg:text-sm mb-1">Daily Sales</p>
            <p className="text-xl lg:text-2xl font-bold">₱{dailyTotal.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-[#F1646E] to-[#d4516f] rounded-xl p-3 lg:p-4 text-white">
            <p className="text-white/80 text-xs lg:text-sm mb-1">Weekly Sales</p>
            <p className="text-xl lg:text-2xl font-bold">₱{weeklyTotal.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-[#A61F30] to-[#d4516f] rounded-xl p-3 lg:p-4 text-white">
            <p className="text-white/80 text-xs lg:text-sm mb-1">Monthly Sales ({getMonthName(selectedDate)})</p>
            <p className="text-xl lg:text-2xl font-bold">₱{monthlyTotal.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-[#F1646E] to-[#E84A5C] rounded-xl p-3 lg:p-4 text-white">
            <p className="text-white/80 text-xs lg:text-sm mb-1">Yearly Sales</p>
            <p className="text-xl lg:text-2xl font-bold">₱{yearlyTotal.toFixed(2)}</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-6 lg:mb-8">
          {/* Sales Over Time */}
          <div className="bg-white rounded-xl border border-border p-4 lg:p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg lg:text-xl font-bold text-foreground">Sales Over Time</h2>
                <p className="text-xs lg:text-sm text-muted-foreground">Smooth trend view for daily and weekly revenue movement.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setChartPeriod("daily")}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    chartPeriod === "daily"
                      ? "bg-[#A61F30] text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setChartPeriod("weekly")}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    chartPeriod === "weekly"
                      ? "bg-[#A61F30] text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8dce2" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(value) => `₱${value}`} />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#A61F30"
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Sales by Category */}
          <div className="bg-white rounded-xl border border-border p-4 lg:p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg lg:text-xl font-bold text-foreground">Sales by Category</h2>
                <p className="text-xs lg:text-sm text-muted-foreground">Revenue distribution across menu categories.</p>
              </div>
              <TrendingUp className="h-5 w-5 text-[#A61F30]" />
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
                  fill="#A61F30"
                  dataKey="sales"
                >
                  {salesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₱${value}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours and Top Products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-6 lg:mb-8">
          {/* Peak Hours */}
          <div className="bg-white rounded-xl border border-border p-4 lg:p-6">
            <h2 className="text-lg lg:text-xl font-bold text-foreground mb-4">Peak Hours</h2>
            <p className="text-xs lg:text-sm text-muted-foreground mb-4">Busy periods based on recorded order times.</p>
            <div className="space-y-3">
              {peakHours.slice(0, 8).map((peak, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">{peak.hour}</span>
                    <span className="text-sm text-muted-foreground">{peak.orders} orders</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-[#A61F30] to-[#F1646E] h-2 rounded-full"
                      style={{ width: `${peak.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Selling Products */}
          <div className="bg-white rounded-xl border border-border p-4 lg:p-6">
            <h2 className="text-lg lg:text-xl font-bold text-foreground mb-4">Top Selling Products</h2>
            <p className="text-xs lg:text-sm text-muted-foreground mb-4">Top 5 to 10 best-performing items by quantity sold.</p>
            <div className="space-y-3">
              {topProducts.map((product, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">{product.name}</span>
                    <span className="text-sm font-bold text-[#A61F30]">{product.quantity}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-[#A61F30] to-[#F1646E] h-2 rounded-full"
                      style={{ width: `${(product.quantity / Math.max(1, topProducts[0]?.quantity || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sales Transactions */}
        <div className="bg-white rounded-xl border border-border">
          <div className="p-4 lg:p-6 border-b border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-[#F5E6E8] rounded-lg p-2">
                <FileText className="h-5 w-5 text-[#A61F30]" />
              </div>
              <h2 className="text-lg lg:text-xl font-bold text-foreground">Sales Transactions</h2>
            </div>
            <p className="text-xs lg:text-sm text-muted-foreground">Latest transactions for the selected period with accountability tracking.</p>
          </div>

          {/* Mobile View */}
          <div className="lg:hidden">
            {transactions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No transactions</div>
            ) : (
              transactions.map((transaction) => (
                <div key={transaction.id} className="p-4 border-b border-border last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium">{transaction.id}</p>
                    <p className="text-[#A61F30] font-bold">₱{transaction.total.toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{transaction.date} {transaction.time}</p>
                  <p className="text-xs text-muted-foreground">{transaction.paymentMethod}</p>
                </div>
              ))
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-4 font-semibold text-foreground">Transaction ID</th>
                  <th className="text-left px-6 py-4 font-semibold text-foreground">Date</th>
                  <th className="text-left px-6 py-4 font-semibold text-foreground">Time</th>
                  <th className="text-left px-6 py-4 font-semibold text-foreground">Payment Method</th>
                  <th className="text-left px-6 py-4 font-semibold text-foreground">Processed By</th>
                  <th className="text-right px-6 py-4 font-semibold text-foreground">Amount</th>
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
                    <tr key={transaction.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-6 py-4 font-medium">{transaction.id}</td>
                      <td className="px-6 py-4 text-muted-foreground">{transaction.date}</td>
                      <td className="px-6 py-4 text-muted-foreground">{transaction.time}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.paymentMethod === "cash" ? "bg-[#F5E6E8] text-[#A61F30]" : "bg-[#E8F5E9] text-[#2E7D32]"
                        }`}>
                          {transaction.paymentMethod === "cash" ? "Cash" : transaction.paymentMethod === "gcash" ? "GCash" : transaction.paymentMethod === "card" ? "Card" : "Grab Pay"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{transaction.processedBy}</td>
                      <td className="px-6 py-4 text-right text-[#A61F30] font-bold">
                        ₱{transaction.total.toFixed(2)}
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
