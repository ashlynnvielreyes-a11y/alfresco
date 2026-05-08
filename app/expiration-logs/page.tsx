"use client"

import { useEffect, useState, useCallback } from "react"
import { Sidebar } from "@/components/sidebar"
import { AlertTriangle, Calendar, Search } from "lucide-react"
import { initializeSupabaseStore, getExpirationLogs } from "@/lib/store"
import type { ExpirationLog } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"

function formatDate(date?: string | null) {
  if (!date) return "Unknown"
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return "Unknown"
  return parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateTime(date?: string | null) {
  if (!date) return "Unknown"
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return "Unknown"
  return parsedDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatBatchSummary(batchId: string) {
  const batchIds = batchId
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  if (batchIds.length <= 1) {
    return batchIds[0] || "Unknown batch"
  }

  return `${batchIds.length} batches combined`
}

function normalizeDateValue(date?: string | null) {
  if (!date) return null
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return null

  const year = parsedDate.getFullYear()
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0")
  const day = String(parsedDate.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function ExpirationLogsPage() {
  const [expirationLogs, setExpirationLogs] = useState<ExpirationLog[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const refreshData = useCallback(async () => {
    await initializeSupabaseStore()
    setExpirationLogs(getExpirationLogs())
  }, [])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("expiration-logs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "expiration_logs" }, () => void refreshData())
      .subscribe()

    const intervalId = window.setInterval(() => {
      void refreshData()
    }, 60000)

    return () => {
      window.clearInterval(intervalId)
      void supabase.removeChannel(channel)
    }
  }, [refreshData])

  const filteredLogs = expirationLogs.filter((log) => {
    const query = searchQuery.trim().toLowerCase()
    const matchesQuery =
      query.length === 0 ||
      log.ingredientName.toLowerCase().includes(query) ||
      log.batchId.toLowerCase().includes(query) ||
      String(log.quantity).includes(query) ||
      formatDate(log.expirationDate).toLowerCase().includes(query)

    const logDate = normalizeDateValue(log.expirationDate)
    const matchesFromDate = !fromDate || (logDate !== null && logDate >= fromDate)
    const matchesToDate = !toDate || (logDate !== null && logDate <= toDate)

    return matchesQuery && matchesFromDate && matchesToDate
  })

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-hidden p-4 pt-20 lg:p-6 lg:pt-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-10 h-64 w-64 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
          <div className="absolute right-8 top-24 h-52 w-52 rounded-full bg-[#7d5a44]/10 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="mb-6 flex flex-col gap-3 lg:mb-8">
            <h1 className="text-2xl font-bold text-[#4a342a] lg:text-3xl">Expiration Logs</h1>
            <p className="text-sm text-muted-foreground lg:text-base">
              View recorded expired ingredient batches from inventory.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <section className="rounded-2xl border border-[#f5f1ea]/55 bg-[rgba(245,241,234,0.78)] p-4 shadow-[0_18px_40px_rgba(74,52,42,0.08)] backdrop-blur-xl lg:p-6">
              <div className="mb-4 flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#4a342a]">Expired Ingredient Logs</h2>
                    <p className="text-sm text-muted-foreground">Recorded expired FIFO batches from inventory.</p>
                  </div>
                  <span className="inline-flex items-center self-start rounded-full bg-[#4a342a] px-3 py-1 text-xs font-semibold text-[#f5f1ea]">
                    {filteredLogs.length} of {expirationLogs.length} log{expirationLogs.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <label className="flex flex-1 items-center gap-2 rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 px-3 py-2 backdrop-blur-sm">
                    <Search className="h-4 w-4 text-[#4a342a]" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search ingredient, batch, quantity, or date"
                      className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </label>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <label className="flex items-center gap-2 rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 px-3 py-2 backdrop-blur-sm">
                      <Calendar className="h-4 w-4 text-[#4a342a]" />
                      <span className="text-sm text-muted-foreground">From</span>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="bg-transparent text-sm font-medium text-foreground outline-none"
                      />
                    </label>

                    <label className="flex items-center gap-2 rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 px-3 py-2 backdrop-blur-sm">
                      <Calendar className="h-4 w-4 text-[#4a342a]" />
                      <span className="text-sm text-muted-foreground">To</span>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="bg-transparent text-sm font-medium text-foreground outline-none"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {filteredLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-8 text-center text-sm text-muted-foreground">
                  {expirationLogs.length === 0 ? "No expired ingredient logs recorded yet." : "No logs match the current filters."}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-[#d7c9b8]/70 bg-[#f5f1ea]/82 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{log.ingredientName}</p>
                          <p className="text-xs text-muted-foreground">{formatBatchSummary(log.batchId)}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Expired
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                        <p>
                          Quantity
                          <span className="mt-1 block font-medium text-foreground">{log.quantity}</span>
                        </p>
                        <p>
                          Expired On
                          <span className="mt-1 block font-medium text-foreground">{formatDate(log.expirationDate)}</span>
                        </p>
                        <p>
                          Logged At
                          <span className="mt-1 block font-medium text-foreground">{formatDateTime(log.loggedAt)}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
