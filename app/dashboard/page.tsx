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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 p-4 pt-20 lg:pt-6 lg:p-6">
        <div className="mb-6 lg:mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
            <div>
              <p className="text-xs lg:text-sm uppercase tracking-wide text-muted-foreground mb-2">
                ANALYTICS OVERVIEW
              </p>
              <h1 className="text-3xl lg:text-4xl font-bold text-[#A61F30] mb-2">Dashboard</h1>
              <p className="text-sm lg:text-base text-muted-foreground">
                A clean, data-driven command center for sales, payments, and inventory
                performance across your POS system.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">MANAGER</p>
                <p className="text-lg font-bold text-foreground">admin</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTimeView("weekly")}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    timeView === "weekly"
                      ? "bg-[#A61F30] text-white"
                      : "bg-white border border-border text-foreground hover:bg-muted"
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setTimeView("monthly")}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    timeView === "monthly"
                      ? "bg-[#A61F30] text-white"
                      : "bg-white border border-border text-foreground hover:bg-muted"
                  }`}
                >
                  Monthly
                </button>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">LIVE REFRESH</p>
                <p className="text-sm font-medium text-foreground">
                  Updated {new Date().toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <div className="bg-gradient-to-br from-[#A61F30] to-[#8B1826] rounded-xl lg:rounded-2xl p-6 lg:p-8 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-white/80 mb-2">Weekly Revenue</p>
                  <p className="text-4xl lg:text-5xl font-bold">{`\u20B1${weeklyTotal.toFixed(2)}`}</p>
                  <p className="text-white/70 text-sm mt-2">Down 55% current week performance</p>
                </div>
                <div className="w-12 h-12 lg:w-14 lg:h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 lg:h-7 lg:w-7" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
          <div className="bg-gradient-to-br from-[#A61F30] to-[#d4516f] rounded-xl border border-[#F1646E]/30 p-4 lg:p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white/80 text-sm mb-1">Today&apos;s Sales</p>
                <p className="text-2xl lg:text-3xl font-bold">{`\u20B1${dailyTotal.toFixed(2)}`}</p>
                <p className="text-white/70 text-xs mt-2">Up 0% sales recorded today</p>
              </div>
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#F1646E] to-[#d4516f] rounded-xl border border-[#F1646E]/30 p-4 lg:p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white/80 text-sm mb-1">Total Orders</p>
                <p className="text-2xl lg:text-3xl font-bold">{transactions.length}</p>
                <p className="text-white/70 text-xs mt-2">Up 0% transactions today</p>
              </div>
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#A61F30] to-[#8B1826] rounded-xl border border-[#F1646E]/30 p-4 lg:p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white/80 text-sm mb-1">Items Sold</p>
                <p className="text-2xl lg:text-3xl font-bold">30</p>
                <p className="text-white/70 text-xs mt-2">Up 0% items today</p>
              </div>
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#F1646E] to-[#E84A5C] rounded-xl border border-[#F1646E]/30 p-4 lg:p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white/80 text-sm mb-1">Low Stock Items</p>
                <p className="text-2xl lg:text-3xl font-bold">{lowStockItems.length}</p>
                <p className="text-white/70 text-xs mt-2">
                  Alert {lowStockItems.length > 0 ? `${lowStockItems[0]?.name} needs action` : "All clear"}
                </p>
              </div>
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <div className="bg-white rounded-xl border border-border p-4 lg:p-6">
            <h2 className="text-base lg:text-lg font-bold text-foreground mb-3 lg:mb-4">
              Recent Transactions
            </h2>
            {transactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 lg:py-8 text-sm lg:text-base">
                No transactions yet
              </p>
            ) : (
              <div className="space-y-2 lg:space-y-3">
                {transactions.slice(-5).reverse().map((t) => (
                  <div
                    key={t.id}
                    className="flex justify-between items-center py-2 border-b border-border last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm lg:text-base">{t.id}</p>
                      <p className="text-xs lg:text-sm text-muted-foreground truncate">
                        {t.date} {t.time}
                      </p>
                    </div>
                    <p className="font-bold text-[#A61F30] text-sm lg:text-base ml-2">
                      {`\u20B1${t.total.toFixed(2)}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-border p-4 lg:p-6">
            <h2 className="text-base lg:text-lg font-bold text-foreground mb-3 lg:mb-4">
              Low Stock Items
            </h2>
            {lowStockItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 lg:py-8 text-sm lg:text-base">
                All items are well stocked
              </p>
            ) : (
              <div className="space-y-2 lg:space-y-3">
                {lowStockItems.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center py-2 border-b border-border last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm lg:text-base truncate">{p.name}</p>
                      <p className="text-xs lg:text-sm text-muted-foreground">{p.category}</p>
                    </div>
                    <span className="px-2 lg:px-3 py-1 bg-destructive/10 text-destructive rounded-full font-medium text-xs lg:text-sm ml-2 flex-shrink-0">
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
