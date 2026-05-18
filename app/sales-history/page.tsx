"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Calendar, Download, FileSearch, Search } from "lucide-react"

import { Sidebar } from "@/components/sidebar"
import { TransactionDetailsModal } from "@/components/transaction-details-modal"
import { createClient } from "@/lib/supabase/client"
import { getTransactionsByDateRange, getSalesTotalByDateRange, initializeSupabaseStore } from "@/lib/store"
import type { Transaction } from "@/lib/types"

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

export default function SalesHistoryPage() {
  const defaults = getDefaultRange()
  const [fromDate, setFromDate] = useState(defaults.fromDate)
  const [toDate, setToDate] = useState(defaults.toDate)
  const [searchQuery, setSearchQuery] = useState("")
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [rangeTotal, setRangeTotal] = useState(0)

  const loadData = useCallback(async () => {
    await initializeSupabaseStore()
    const startDate = new Date(fromDate)
    const endDate = new Date(toDate)

    if (startDate > endDate) return

    const [nextTransactions, nextRangeTotal] = await Promise.all([
      getTransactionsByDateRange(fromDate, toDate),
      getSalesTotalByDateRange(fromDate, toDate),
    ])

    setTransactions(nextTransactions)
    setRangeTotal(nextRangeTotal)
    setLastSyncedAt(new Date())
  }, [fromDate, toDate])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("sales-history-transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        void loadData()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadData])

  const filteredTransactions = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()
    if (!needle) return transactions

    return transactions.filter((transaction) => {
      const itemNames = transaction.items.map((item) => item.product.name).join(" ").toLowerCase()
      return (
        transaction.id.toLowerCase().includes(needle) ||
        transaction.date.toLowerCase().includes(needle) ||
        transaction.time.toLowerCase().includes(needle) ||
        transaction.processedBy.toLowerCase().includes(needle) ||
        paymentMethodLabel(transaction.paymentMethod).toLowerCase().includes(needle) ||
        itemNames.includes(needle) ||
        (transaction.customerName || "").toLowerCase().includes(needle) ||
        (transaction.queueNumber || "").toLowerCase().includes(needle)
      )
    })
  }, [searchQuery, transactions])

  const filteredTotal = useMemo(
    () => filteredTransactions.reduce((sum, transaction) => sum + transaction.total, 0),
    [filteredTransactions]
  )

  const exportToCSV = () => {
    const headers = ["Transaction ID", "Queue", "Customer", "Date", "Time", "Items", "Payment Method", "Cashier", "Amount"]
    const rows = filteredTransactions.map((transaction) => [
      transaction.id,
      transaction.queueNumber || "",
      transaction.customerName || "",
      transaction.date,
      transaction.time,
      transaction.items.map((item) => item.product.name).join(" | "),
      paymentMethodLabel(transaction.paymentMethod),
      transaction.processedBy,
      transaction.total.toFixed(2),
    ])

    const csvContent = [headers.join(","), ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `sales-history-${fromDate}-to-${toDate}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const averageTicket = filteredTransactions.length ? filteredTotal / filteredTransactions.length : 0
  const totalItems = filteredTransactions.reduce((sum, transaction) => sum + transaction.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)

  const historyCards = [
    {
      label: "Filtered Revenue",
      value: `₱${filteredTotal.toFixed(2)}`,
      detail: `${fromDate} to ${toDate}`,
      tint: "from-[#4a342a] via-[#7d5a44] to-[#b2967d]",
      light: false,
    },
    {
      label: "Transactions",
      value: String(filteredTransactions.length),
      detail: "Rows matching the current range and search",
      tint: "from-[#b2967d] via-[#d7c9b8] to-[#f5f1ea]",
      light: true,
    },
    {
      label: "Items Sold",
      value: String(totalItems),
      detail: "Total item quantity across filtered receipts",
      tint: "from-[#7d5a44] via-[#b2967d] to-[#d7c9b8]",
      light: false,
    },
    {
      label: "Average Ticket",
      value: `₱${averageTicket.toFixed(2)}`,
      detail: "Average value per transaction",
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

        <div className="relative mb-6 rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/38 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.75)] backdrop-blur-xl lg:mb-8 lg:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.32em] text-[#7d5a44]">TRANSACTION RECORDS</p>
              <h1 className="mb-2 text-2xl font-bold text-[#4a342a] lg:text-4xl">Sales History</h1>
              <p className="max-w-3xl text-sm text-muted-foreground lg:text-base">
                Search receipts, filter by date, inspect itemized transaction details, and export operational history.
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
          {historyCards.map((card) => (
            <div key={card.label} className={`group relative overflow-hidden rounded-[24px] border border-[#f5f1ea]/55 bg-gradient-to-br ${card.tint} p-[1px] shadow-[0_18px_36px_rgba(123,111,25,0.10)]`}>
              <div className={`relative h-full rounded-[23px] p-5 backdrop-blur-sm lg:p-6 ${card.light ? "bg-[#f5f1ea]/88 text-[#4a342a]" : "bg-[rgba(245,241,234,0.14)] text-[#f5f1ea]"}`}>
                <div className="absolute inset-x-0 top-0 h-px bg-[#f5f1ea]/45" />
                <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full ${card.light ? "bg-[#f5f1ea]/35" : "bg-[#f5f1ea]/10"} blur-sm transition-transform duration-300 group-hover:scale-110`} />
                <div className="relative">
                  <p className={`mb-1 text-sm ${card.light ? "text-[#7d5a44]" : "text-[#f5f1ea]/75"}`}>{card.label}</p>
                  <p className="text-2xl font-bold lg:text-3xl">{card.value}</p>
                  <p className={`mt-3 text-xs leading-5 ${card.light ? "text-[#7d5a44]" : "text-[#f5f1ea]/70"}`}>{card.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="relative mb-6 rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl lg:mb-8 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#7d5a44]">Search and review</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#4a342a]">Receipt lookup</h2>
            </div>
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d5a44]" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by transaction, cashier, product, queue, or customer"
                className="w-full rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/65 py-3 pl-11 pr-4 text-sm text-[#4a342a] outline-none shadow-[inset_0_1px_0_rgba(245,241,234,0.75)] transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
              />
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl">
          <div className="border-b border-[#f5f1ea]/45 p-4 lg:p-6">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-2xl bg-[#f5f1ea] p-2">
                <FileSearch className="h-5 w-5 text-[#4a342a]" />
              </div>
              <h2 className="text-lg font-bold text-foreground lg:text-xl">Sales Transactions</h2>
            </div>
            <p className="text-xs text-muted-foreground lg:text-sm">Click any row to open the full receipt breakdown.</p>
          </div>

          <div className="lg:hidden">
            {filteredTransactions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No transactions match this filter.</div>
            ) : (
              filteredTransactions.map((transaction) => (
                <button
                  key={transaction.id}
                  type="button"
                  onClick={() => setSelectedTransaction(transaction)}
                  className="block w-full border-b border-[#f5f1ea]/45 p-4 text-left transition-colors hover:bg-[#f5f1ea]/35 last:border-0"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#4a342a]">{transaction.id}</p>
                      <p className="text-xs text-muted-foreground">{transaction.queueNumber || "No queue"} • {transaction.processedBy}</p>
                    </div>
                    <p className="font-bold text-[#4a342a]">₱{transaction.total.toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{transaction.date} {transaction.time}</p>
                  <p className="text-xs text-muted-foreground">{paymentMethodLabel(transaction.paymentMethod)}</p>
                </button>
              ))
            )}
          </div>

          <div className="hidden lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f5f1ea]/45">
                  <th className="px-6 py-4 text-left font-semibold text-foreground">Transaction ID</th>
                  <th className="px-6 py-4 text-left font-semibold text-foreground">Queue</th>
                  <th className="px-6 py-4 text-left font-semibold text-foreground">Date</th>
                  <th className="px-6 py-4 text-left font-semibold text-foreground">Time</th>
                  <th className="px-6 py-4 text-left font-semibold text-foreground">Payment</th>
                  <th className="px-6 py-4 text-left font-semibold text-foreground">Cashier</th>
                  <th className="px-6 py-4 text-right font-semibold text-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      No transactions match this range or search query.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      onClick={() => setSelectedTransaction(transaction)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          setSelectedTransaction(transaction)
                        }
                      }}
                      tabIndex={0}
                      className="cursor-pointer border-b border-[#f5f1ea]/45 transition-colors hover:bg-[#f5f1ea]/30 focus:outline-none focus:ring-2 focus:ring-[#b2967d]/30 last:border-0"
                    >
                      <td className="px-6 py-4 font-medium text-[#4a342a]">{transaction.id}</td>
                      <td className="px-6 py-4 text-muted-foreground">{transaction.queueNumber || "—"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{transaction.date}</td>
                      <td className="px-6 py-4 text-muted-foreground">{transaction.time}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${transaction.paymentMethod === "cash" ? "bg-[#f5f1ea] text-[#4a342a]" : "bg-[#d7c9b8] text-[#7d5a44]"}`}>
                          {paymentMethodLabel(transaction.paymentMethod)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{transaction.processedBy}</td>
                      <td className="px-6 py-4 text-right font-bold text-[#4a342a]">₱{transaction.total.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <TransactionDetailsModal
          open={Boolean(selectedTransaction)}
          onOpenChange={(open) => {
            if (!open) setSelectedTransaction(null)
          }}
          transactionId={selectedTransaction?.id || null}
          fallbackTransaction={selectedTransaction}
        />
      </main>
    </div>
  )
}
