"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowDownUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  FileSearch,
  Receipt,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react"

import { Sidebar } from "@/components/sidebar"
import { TransactionDetailsModal } from "@/components/transaction-details-modal"
import { createClient } from "@/lib/supabase/client"
import { getTransactionsByDateRange, getSalesTotalByDateRange, initializeSupabaseStore, subscribeToTransactionSync } from "@/lib/store"
import type { CartItem, ProductCategory, Transaction } from "@/lib/types"

type SortKey = "id" | "dateTime" | "cashier" | "paymentMethod" | "orderType" | "status" | "total"
type SortDirection = "asc" | "desc"
type StatusFilter = "all" | "pending" | "preparing" | "ready" | "completed" | "voided" | "cancelled"
type PaymentFilter = "all" | "cash" | "gcash"
type OrderTypeFilter = "all" | "Combo" | "Meal" | "Beverage" | "Mixed" | "Other"
type AdjustmentFilter = "all" | "clean" | "voided"

type TransactionRecord = {
  transaction: Transaction
  orderType: OrderTypeFilter
  status: Exclude<StatusFilter, "all">
  itemCount: number
  itemSummary: string
  searchableText: string
  timestampLabel: string
  timestampValue: number
  adjustmentLabel: string
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const

function getDefaultRange() {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 29)

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

function paymentMethodLabel(paymentMethod: Transaction["paymentMethod"]) {
  return paymentMethod === "gcash" ? "GCash" : "Cash"
}

function formatStatusLabel(status: TransactionRecord["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function getStatusTone(status: TransactionRecord["status"]) {
  switch (status) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "preparing":
      return "border-sky-200 bg-sky-50 text-sky-700"
    case "ready":
      return "border-violet-200 bg-violet-50 text-violet-700"
    case "voided":
      return "border-rose-200 bg-rose-50 text-rose-700"
    default:
      return "border-slate-200 bg-slate-50 text-slate-700"
  }
}

function getPaymentTone(paymentMethod: Transaction["paymentMethod"]) {
  return paymentMethod === "cash"
    ? "border-[#ded1c5] bg-[#fbf8f3] text-[#4a342a]"
    : "border-[#d7c9b8] bg-[#efe2d4] text-[#7d5a44]"
}

function transactionOrderType(transaction: Transaction): OrderTypeFilter {
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

function getTransactionStatus(transaction: Transaction): TransactionRecord["status"] {
  if (transaction.voided) return "voided"
  if (
    transaction.orderStatus === "pending" ||
    transaction.orderStatus === "new_order" ||
    transaction.orderStatus === "preparing" ||
    transaction.orderStatus === "ready" ||
    transaction.orderStatus === "ready_for_pickup" ||
    transaction.orderStatus === "cancelled"
  ) {
    if (transaction.orderStatus === "new_order") return "pending"
    if (transaction.orderStatus === "ready_for_pickup") return "ready"
    return transaction.orderStatus
  }
  return "completed"
}

function summarizeItems(items: CartItem[]) {
  const names = items.map((item) => item.product.name)
  if (names.length === 0) return "No items"
  if (names.length === 1) return names[0]
  return `${names[0]} +${names.length - 1} more`
}

function parseTransactionTimestamp(transaction: Transaction) {
  const directDateTime = new Date(`${transaction.date} ${transaction.time}`)
  if (!Number.isNaN(directDateTime.getTime())) return directDateTime.getTime()

  const fallbackDate = new Date(`${transaction.date}T00:00:00`)
  if (Number.isNaN(fallbackDate.getTime())) return 0

  const match = transaction.time.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (!match) return fallbackDate.getTime()

  let hours = Number(match[1])
  const minutes = Number(match[2] || 0)
  const seconds = Number(match[3] || 0)
  const meridiem = match[4]?.toLowerCase()

  if (meridiem === "pm" && hours < 12) hours += 12
  if (meridiem === "am" && hours === 12) hours = 0

  fallbackDate.setHours(hours, minutes, seconds, 0)
  return fallbackDate.getTime()
}

function transactionTimestampValue(transaction: Transaction) {
  return parseTransactionTimestamp(transaction)
}

function buildTransactionRecord(transaction: Transaction): TransactionRecord {
  const orderType = transactionOrderType(transaction)
  const status = getTransactionStatus(transaction)
  const itemCount = transaction.items.reduce((sum, item) => sum + item.quantity, 0)
  const itemSummary = summarizeItems(transaction.items)
  const adjustmentLabel = transaction.voided ? `Voided${transaction.voidedBy ? ` by ${transaction.voidedBy}` : ""}` : "No refund or void"

  return {
    transaction,
    orderType,
    status,
    itemCount,
    itemSummary,
    searchableText: [
      transaction.id,
      transaction.date,
      transaction.time,
      transaction.processedBy,
      paymentMethodLabel(transaction.paymentMethod),
      transaction.queueNumber || "",
      transaction.customerName || "",
      orderType,
      status,
      adjustmentLabel,
      transaction.items.map((item) => item.product.name).join(" "),
    ]
      .join(" ")
      .toLowerCase(),
    timestampLabel: `${transaction.date} ${transaction.time}`,
    timestampValue: transactionTimestampValue(transaction),
    adjustmentLabel,
  }
}

function compareRecords(left: TransactionRecord, right: TransactionRecord, sortKey: SortKey) {
  switch (sortKey) {
    case "id":
      return left.transaction.id.localeCompare(right.transaction.id)
    case "cashier":
      return left.transaction.processedBy.localeCompare(right.transaction.processedBy)
    case "paymentMethod":
      return paymentMethodLabel(left.transaction.paymentMethod).localeCompare(paymentMethodLabel(right.transaction.paymentMethod))
    case "orderType":
      return left.orderType.localeCompare(right.orderType)
    case "status":
      return left.status.localeCompare(right.status)
    case "total":
      return left.transaction.total - right.transaction.total
    default:
      if (left.timestampValue !== right.timestampValue) {
        return left.timestampValue - right.timestampValue
      }

      return left.transaction.id.localeCompare(right.transaction.id, undefined, { numeric: true, sensitivity: "base" })
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.URL.revokeObjectURL(url)
}

function buildCsv(records: TransactionRecord[]) {
  const headers = [
    "Transaction ID",
    "Date",
    "Time",
    "Ordered Items",
    "Item Count",
    "Cashier",
    "Payment Method",
    "Order Type",
    "Status",
    "Adjustment Tracking",
    "Queue Number",
    "Customer",
    "Total Amount",
  ]

  const rows = records.map(({ transaction, orderType, status, itemCount, adjustmentLabel }) => [
    transaction.id,
    transaction.date,
    transaction.time,
    transaction.items.map((item) => `${item.product.name} x${item.quantity}`).join(" | "),
    String(itemCount),
    transaction.processedBy,
    paymentMethodLabel(transaction.paymentMethod),
    orderType,
    formatStatusLabel(status),
    adjustmentLabel,
    transaction.queueNumber || "",
    transaction.customerName || "",
    transaction.total.toFixed(2),
  ])

  return [headers.join(","), ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))].join("\n")
}

function exportTransactionsToPdf(records: TransactionRecord[], fromDate: string, toDate: string) {
  const receiptRows = records
    .map(
      ({ transaction, orderType, status, itemSummary, adjustmentLabel }) => `
        <tr>
          <td>${transaction.id}</td>
          <td>${transaction.date} ${transaction.time}</td>
          <td>${itemSummary}</td>
          <td>${transaction.processedBy}</td>
          <td>${paymentMethodLabel(transaction.paymentMethod)}</td>
          <td>${orderType}</td>
          <td>${formatStatusLabel(status)}</td>
          <td>${adjustmentLabel}</td>
          <td style="text-align:right">${formatCurrency(transaction.total)}</td>
        </tr>
      `
    )
    .join("")

  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800")
  if (!printWindow) return

  printWindow.document.write(`
    <html>
      <head>
        <title>Sales History ${fromDate} to ${toDate}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #2f241d; margin: 32px; }
          h1 { margin: 0 0 8px; font-size: 28px; }
          p { margin: 0 0 18px; color: #6f6157; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d7c9b8; padding: 10px; vertical-align: top; }
          th { background: #f2ebe4; text-align: left; }
          .summary { margin: 18px 0 24px; padding: 14px 16px; background: #fbf8f3; border: 1px solid #ded1c5; }
        </style>
      </head>
      <body>
        <h1>AI Fresco POS Sales History</h1>
        <p>Transaction register from ${fromDate} to ${toDate}</p>
        <div class="summary">
          <strong>${records.length}</strong> filtered transactions exported on ${new Date().toLocaleString()}.
        </div>
        <table>
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Date & Time</th>
              <th>Ordered Items</th>
              <th>Cashier</th>
              <th>Payment</th>
              <th>Order Type</th>
              <th>Status</th>
              <th>Refund / Void</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${receiptRows}</tbody>
        </table>
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

export default function SalesHistoryPage() {
  const defaults = getDefaultRange()
  const [fromDate, setFromDate] = useState(defaults.fromDate)
  const [toDate, setToDate] = useState(defaults.toDate)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all")
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>("all")
  const [adjustmentFilter, setAdjustmentFilter] = useState<AdjustmentFilter>("all")
  const [sortKey, setSortKey] = useState<SortKey>("dateTime")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [rangeTotal, setRangeTotal] = useState(0)
  const [newlyPromotedTransactionId, setNewlyPromotedTransactionId] = useState<string | null>(null)
  const previousTopTransactionIdRef = useRef<string | null>(null)
  const hasLoadedInitialResultsRef = useRef(false)

  const loadData = useCallback(async () => {
    await initializeSupabaseStore()
    const startDate = new Date(fromDate)
    const endDate = new Date(toDate)

    if (startDate > endDate) return

    const [nextTransactions, nextRangeTotal] = await Promise.all([
      getTransactionsByDateRange(fromDate, toDate),
      getSalesTotalByDateRange(fromDate, toDate),
    ])

    const dedupedTransactions = Array.from(
      nextTransactions.reduce((map, transaction) => map.set(transaction.id, transaction), new Map<string, Transaction>()).values()
    ).sort((left, right) => {
      const timestampDifference = parseTransactionTimestamp(right) - parseTransactionTimestamp(left)
      if (timestampDifference !== 0) return timestampDifference

      return right.id.localeCompare(left.id, undefined, { numeric: true, sensitivity: "base" })
    })

    setTransactions(dedupedTransactions)
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
    const unsubscribeTransactionSync = subscribeToTransactionSync(() => {
      void loadData()
    })

    return () => {
      unsubscribeTransactionSync()
      void supabase.removeChannel(channel)
    }
  }, [loadData])

  const transactionRecords = useMemo(
    () => transactions.map((transaction) => buildTransactionRecord(transaction)),
    [transactions]
  )

  const filteredTransactions = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()

    return transactionRecords.filter((record) => {
      if (needle && !record.searchableText.includes(needle)) return false
      if (statusFilter !== "all" && record.status !== statusFilter) return false
      if (paymentFilter !== "all" && record.transaction.paymentMethod !== paymentFilter) return false
      if (orderTypeFilter !== "all" && record.orderType !== orderTypeFilter) return false
      if (adjustmentFilter === "clean" && record.transaction.voided) return false
      if (adjustmentFilter === "voided" && !record.transaction.voided) return false
      return true
    })
  }, [adjustmentFilter, orderTypeFilter, paymentFilter, searchQuery, statusFilter, transactionRecords])

  const sortedTransactions = useMemo(() => {
    const records = [...filteredTransactions]
    records.sort((left, right) => {
      const comparison = compareRecords(left, right, sortKey)
      return sortDirection === "asc" ? comparison : -comparison
    })
    return records
  }, [filteredTransactions, sortDirection, sortKey])

  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize))

  useEffect(() => {
    setPage(1)
  }, [searchQuery, statusFilter, paymentFilter, orderTypeFilter, adjustmentFilter, fromDate, toDate, pageSize])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedTransactions.slice(start, start + pageSize)
  }, [page, pageSize, sortedTransactions])

  useEffect(() => {
    const nextTopTransactionId = sortedTransactions[0]?.transaction.id || null

    if (!hasLoadedInitialResultsRef.current) {
      hasLoadedInitialResultsRef.current = true
      previousTopTransactionIdRef.current = nextTopTransactionId
      return
    }

    if (nextTopTransactionId && previousTopTransactionIdRef.current && nextTopTransactionId !== previousTopTransactionIdRef.current) {
      setNewlyPromotedTransactionId(nextTopTransactionId)
      const timeoutId = window.setTimeout(() => setNewlyPromotedTransactionId(null), 1600)
      previousTopTransactionIdRef.current = nextTopTransactionId
      return () => window.clearTimeout(timeoutId)
    }

    previousTopTransactionIdRef.current = nextTopTransactionId
  }, [sortedTransactions])

  const filteredRevenue = useMemo(
    () => filteredTransactions.reduce((sum, record) => sum + record.transaction.total, 0),
    [filteredTransactions]
  )

  const filteredItems = useMemo(
    () => filteredTransactions.reduce((sum, record) => sum + record.itemCount, 0),
    [filteredTransactions]
  )

  const completedTransactions = filteredTransactions.filter((record) => record.status === "completed").length
  const voidedTransactions = filteredTransactions.filter((record) => record.status === "voided").length
  const averageTicket = filteredTransactions.length > 0 ? filteredRevenue / filteredTransactions.length : 0
  const showingFrom = sortedTransactions.length === 0 ? 0 : (page - 1) * pageSize + 1
  const showingTo = Math.min(page * pageSize, sortedTransactions.length)

  const metricCards = [
    {
      label: "Filtered Revenue",
      value: formatCurrency(filteredRevenue),
      detail: `Base range total ${formatCurrency(rangeTotal)}`,
      tone: "from-[#4a342a] via-[#7d5a44] to-[#b2967d]",
      light: false,
    },
    {
      label: "Transactions",
      value: String(filteredTransactions.length),
      detail: `${completedTransactions} completed and ${voidedTransactions} voided records`,
      tone: "from-[#f5f1ea] via-[#e8ddd0] to-[#d4c0ad]",
      light: true,
    },
    {
      label: "Items Sold",
      value: String(filteredItems),
      detail: "Quantities across the current result set",
      tone: "from-[#6b4d3c] via-[#8d6850] to-[#d7c9b8]",
      light: false,
    },
    {
      label: "Average Ticket",
      value: formatCurrency(averageTicket),
      detail: `${showingFrom}-${showingTo} visible on page ${page}`,
      tone: "from-[#f8f4ef] via-[#e7d9ca] to-[#b2967d]",
      light: true,
    },
  ]

  const handleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortKey(nextKey)
    setSortDirection(nextKey === "dateTime" ? "desc" : "asc")
  }

  const exportToCSV = () => {
    downloadBlob(
      new Blob([buildCsv(sortedTransactions)], { type: "text/csv;charset=utf-8" }),
      `sales-history-${fromDate}-to-${toDate}.csv`
    )
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-y-auto p-4 pt-20 lg:p-6 lg:pt-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(125,90,68,0.16),transparent_58%)]" />
          <div className="absolute left-0 top-16 h-60 w-60 rounded-full bg-[#d9c4b2]/22 blur-3xl" />
          <div className="absolute bottom-10 right-6 h-72 w-72 rounded-full bg-[#ebe2d8]/40 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl space-y-4">
          <section className="rounded-[36px] border border-[#ebe2d8] bg-[linear-gradient(135deg,rgba(255,252,249,0.92),rgba(244,236,229,0.84))] p-6 shadow-[0_28px_70px_rgba(51,38,29,0.08)] backdrop-blur-xl lg:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7d5a44]">Transaction Management Module</p>
                <h1 className="mt-4 text-4xl font-semibold tracking-[-0.08em] text-[#4a342a] lg:text-[3.5rem]">
                  Sales History
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[#7d5a44]">
                  Review every transaction in one searchable workspace, track void activity, reprint receipts, and export operational records without leaving the AI Fresco POS flow.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#e3d6ca] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">
                    <Receipt className="h-3.5 w-3.5" />
                    Click any transaction for the detailed order view
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#e3d6ca] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Receipt reprint ready
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[25rem]">
                <div className="rounded-[24px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/72 p-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Date range</p>
                  <div className="mt-3 grid gap-3">
                    <label className="rounded-2xl border border-[#ded1c5] bg-white/70 px-3 py-2 text-sm text-[#4a342a]">
                      <span className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#7d5a44]">
                        <Calendar className="h-3.5 w-3.5" />
                        From
                      </span>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(event) => setFromDate(event.target.value)}
                        className="w-full bg-transparent outline-none"
                      />
                    </label>
                    <label className="rounded-2xl border border-[#ded1c5] bg-white/70 px-3 py-2 text-sm text-[#4a342a]">
                      <span className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#7d5a44]">
                        <Calendar className="h-3.5 w-3.5" />
                        To
                      </span>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(event) => setToDate(event.target.value)}
                        className="w-full bg-transparent outline-none"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/72 p-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Exports and sync</p>
                  <div className="mt-3 space-y-3">
                    <button
                      type="button"
                      onClick={exportToCSV}
                      className="flex w-full items-center justify-between rounded-2xl border border-[#ded1c5] bg-white/80 px-4 py-3 text-sm font-semibold text-[#4a342a] transition-colors hover:bg-white"
                    >
                      <span>Export CSV</span>
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => exportTransactionsToPdf(sortedTransactions, fromDate, toDate)}
                      className="flex w-full items-center justify-between rounded-2xl border border-[#ded1c5] bg-white/80 px-4 py-3 text-sm font-semibold text-[#4a342a] transition-colors hover:bg-white"
                    >
                      <span>Export PDF</span>
                      <FileDown className="h-4 w-4" />
                    </button>
                    <p className="text-xs uppercase tracking-[0.16em] text-[#7d5a44]/80">{lastSyncedAt ? lastSyncedAt.toLocaleTimeString() : ""}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metricCards.map((card) => (
              <article key={card.label} className={`rounded-[30px] bg-gradient-to-br ${card.tone} p-[1px] shadow-[0_24px_48px_rgba(123,111,25,0.10)]`}>
                <div className={`rounded-[29px] p-5 backdrop-blur-xl ${card.light ? "bg-[rgba(248,244,239,0.92)] text-[#4a342a]" : "bg-[rgba(74,52,42,0.88)] text-[#f5f1ea]"}`}>
                  <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.22em] ${card.light ? "text-[#7d5a44]" : "text-[#f5f1ea]/72"}`}>{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.06em]">{card.value}</p>
                </div>
              </article>
            ))}
          </section>

          <section className="rounded-[30px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/45 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl lg:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#4a342a]">Transaction register</h2>
                </div>

                <div className="relative w-full xl:max-w-md">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d5a44]" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search transaction, cashier, product, queue, customer, or status"
                    className="w-full rounded-2xl border border-[#ded1c5] bg-white/75 py-3 pl-11 pr-4 text-sm text-[#4a342a] outline-none shadow-[inset_0_1px_0_rgba(245,241,234,0.75)] transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-[22px] border border-[#ded1c5] bg-white/70 p-3">
                  <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#7d5a44]">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Status
                  </label>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="w-full bg-transparent text-sm text-[#4a342a] outline-none">
                    <option value="all">All statuses</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="voided">Voided</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="rounded-[22px] border border-[#ded1c5] bg-white/70 p-3">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#7d5a44]">Payment</label>
                  <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)} className="w-full bg-transparent text-sm text-[#4a342a] outline-none">
                    <option value="all">All payment methods</option>
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                  </select>
                </div>

                <div className="rounded-[22px] border border-[#ded1c5] bg-white/70 p-3">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#7d5a44]">Order type</label>
                  <select value={orderTypeFilter} onChange={(event) => setOrderTypeFilter(event.target.value as OrderTypeFilter)} className="w-full bg-transparent text-sm text-[#4a342a] outline-none">
                    <option value="all">All order types</option>
                    <option value="Combo">Combo</option>
                    <option value="Meal">Meal</option>
                    <option value="Beverage">Beverage</option>
                    <option value="Mixed">Mixed</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="rounded-[22px] border border-[#ded1c5] bg-white/70 p-3">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#7d5a44]">Refund / void</label>
                  <select value={adjustmentFilter} onChange={(event) => setAdjustmentFilter(event.target.value as AdjustmentFilter)} className="w-full bg-transparent text-sm text-[#4a342a] outline-none">
                    <option value="all">All records</option>
                    <option value="clean">No refund or void</option>
                    <option value="voided">Voided only</option>
                  </select>
                </div>

                <div className="rounded-[22px] border border-[#ded1c5] bg-white/70 p-3">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#7d5a44]">Rows per page</label>
                  <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])} className="w-full bg-transparent text-sm text-[#4a342a] outline-none">
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option} rows
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[30px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/45 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl">
            <div className="flex flex-col gap-3 border-b border-[#eadfd5] px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#fbf8f3] p-2.5 shadow-[0_10px_20px_rgba(74,52,42,0.08)]">
                  <FileSearch className="h-5 w-5 text-[#4a342a]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#4a342a]">Detailed sales records</h2>
                  <p className="text-sm text-[#7d5a44]">
                    Showing {showingFrom}-{showingTo} of {sortedTransactions.length} matching transactions.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#7d5a44]">
                <span className="rounded-full border border-[#ded1c5] bg-white/70 px-3 py-2">Sort: {sortKey} {sortDirection}</span>
                <span className="rounded-full border border-[#ded1c5] bg-white/70 px-3 py-2">Clickable rows</span>
              </div>
            </div>

            <div className="lg:hidden">
              {paginatedTransactions.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-[#7d5a44]">No transactions match this range or filter set.</div>
              ) : (
                <div className="divide-y divide-[#eadfd5] scroll-smooth">
                  {paginatedTransactions.map((record) => (
                    <button
                      key={record.transaction.id}
                      type="button"
                      onClick={() => setSelectedTransaction(record.transaction)}
                      className={`block min-h-[11.25rem] w-full px-5 py-4 text-left transition-all duration-500 hover:bg-white/35 ${
                        record.transaction.id === newlyPromotedTransactionId
                          ? "animate-[pulse_0.7s_ease-out_1] bg-[#fffaf4] shadow-[inset_0_0_0_1px_rgba(178,150,125,0.38)]"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#4a342a]">{record.transaction.id}</p>
                          <p className="mt-1 text-xs text-[#7d5a44]">{record.timestampLabel}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-[#4a342a]">{formatCurrency(record.transaction.total)}</p>
                      </div>
                      <p className="mt-3 text-sm text-[#4a342a]">{record.itemSummary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPaymentTone(record.transaction.paymentMethod)}`}>
                          {paymentMethodLabel(record.transaction.paymentMethod)}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(record.status)}`}>
                          {formatStatusLabel(record.status)}
                        </span>
                        <span className="rounded-full border border-[#ded1c5] bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-[#7d5a44]">
                          {record.orderType}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-[#7d5a44]">{record.transaction.processedBy} • {record.adjustmentLabel}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto scroll-smooth lg:block">
              <table className="min-w-full">
                <thead className="bg-white/35">
                  <tr className="border-b border-[#eadfd5]">
                    {[
                      ["id", "Transaction ID"],
                      ["dateTime", "Date & Time"],
                      ["cashier", "Cashier"],
                      ["paymentMethod", "Payment"],
                      ["orderType", "Order Type"],
                      ["status", "Status"],
                      ["total", "Total Amount"],
                    ].map(([key, label]) => (
                      <th key={key} className="px-6 py-4 text-left text-sm font-semibold text-[#4a342a]">
                        <button type="button" onClick={() => handleSort(key as SortKey)} className="inline-flex items-center gap-2 transition-colors hover:text-[#7d5a44]">
                          {label}
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </button>
                      </th>
                    ))}
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#4a342a]">Ordered Items</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#4a342a]">Refund / Void Tracking</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-16 text-center text-sm text-[#7d5a44]">
                        No transactions match this range or filter set.
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map((record) => (
                      <tr
                        key={record.transaction.id}
                        onClick={() => setSelectedTransaction(record.transaction)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setSelectedTransaction(record.transaction)
                          }
                        }}
                        tabIndex={0}
                        className={`cursor-pointer border-b border-[#eadfd5] transition-all duration-500 hover:bg-white/35 focus:bg-white/40 focus:outline-none last:border-0 ${
                          record.transaction.id === newlyPromotedTransactionId
                            ? "animate-[pulse_0.7s_ease-out_1] bg-[#fffaf4]"
                            : ""
                        }`}
                      >
                        <td className="px-6 py-4 align-top">
                          <p className="font-semibold text-[#4a342a]">{record.transaction.id}</p>
                          <p className="mt-1 text-xs text-[#7d5a44]">
                            {record.transaction.queueNumber || "No queue"} {record.transaction.customerName ? `• ${record.transaction.customerName}` : ""}
                          </p>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-[#7d5a44]">{record.timestampLabel}</td>
                        <td className="px-6 py-4 align-top text-sm text-[#7d5a44]">{record.transaction.processedBy}</td>
                        <td className="px-6 py-4 align-top">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getPaymentTone(record.transaction.paymentMethod)}`}>
                            {paymentMethodLabel(record.transaction.paymentMethod)}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-[#7d5a44]">{record.orderType}</td>
                        <td className="px-6 py-4 align-top">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusTone(record.status)}`}>
                            {formatStatusLabel(record.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top text-right text-sm font-semibold text-[#4a342a]">{formatCurrency(record.transaction.total)}</td>
                        <td className="px-6 py-4 align-top">
                          <p className="max-w-[18rem] text-sm text-[#4a342a]">{record.itemSummary}</p>
                          <p className="mt-1 text-xs text-[#7d5a44]">{record.itemCount} total item{record.itemCount === 1 ? "" : "s"}</p>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="max-w-[16rem]">
                            <p className={`text-sm font-medium ${record.transaction.voided ? "text-rose-700" : "text-[#7d5a44]"}`}>
                              {record.adjustmentLabel}
                            </p>
                            <p className="mt-1 text-xs text-[#7d5a44]">
                              {record.transaction.voidedAt ? `Recorded at ${new Date(record.transaction.voidedAt).toLocaleString()}` : "Refund records are not stored separately yet."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 border-t border-[#eadfd5] px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
              <div className="flex flex-wrap items-center gap-2 text-sm text-[#7d5a44]">
                <span className="rounded-full border border-[#ded1c5] bg-white/70 px-3 py-2">
                  Page {page} of {totalPages}
                </span>
                <span className="rounded-full border border-[#ded1c5] bg-white/70 px-3 py-2">
                  {sortedTransactions.length} result{sortedTransactions.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center gap-2 rounded-full border border-[#ded1c5] bg-white/80 px-4 py-2 text-sm font-semibold text-[#4a342a] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="inline-flex items-center gap-2 rounded-full border border-[#ded1c5] bg-white/80 px-4 py-2 text-sm font-semibold text-[#4a342a] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          {voidedTransactions > 0 ? (
            <section className="rounded-[28px] border border-rose-200/70 bg-rose-50/80 p-5 shadow-[0_18px_36px_rgba(127,29,29,0.06)] backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 text-rose-700" />
                <div>
                  <h3 className="text-base font-semibold text-rose-900">Void activity is visible in this range</h3>
                  <p className="mt-1 text-sm leading-6 text-rose-800">{voidedTransactions} voided transaction{voidedTransactions === 1 ? "" : "s"}</p>
                </div>
              </div>
            </section>
          ) : null}
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
