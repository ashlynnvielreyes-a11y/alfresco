"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BellRing,
  CheckCheck,
  ChefHat,
  Filter,
  Search,
  ShieldAlert,
  UserRoundCheck,
  XCircle,
} from "lucide-react"

import { AuthGuard } from "@/components/auth-guard"
import { Sidebar } from "@/components/sidebar"
import { TransactionDetailsModal } from "@/components/transaction-details-modal"
import {
  buildQueueMetadataNote,
  canCompleteQueuedOrders,
  canManagePreparing,
  canPrioritizeQueue,
  getQueueOrderTypeLabel,
  getQueuePriorityLabel,
  getTransactionItemCount,
  getTransactionItemSummary,
  getTransactionOrderType,
  getTransactionQueueMetadata,
  type QueueOrderType,
  type QueuePriority,
} from "@/lib/queue"
import { getCurrentUser, getTransactions, initializeSupabaseStore, updateTransaction } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import type { AppUserRole, Transaction } from "@/lib/types"

type QueueFilter = "all" | "preparing" | "ready" | "completed" | "cancelled"

type QueueRecord = {
  transaction: Transaction
  queueMeta: ReturnType<typeof getTransactionQueueMetadata>
  waitMs: number
  itemCount: number
  itemSummary: string
  serviceLabel: string
  productMix: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value)
}

function parseTransactionDateTime(transaction: Transaction) {
  const baseDate = new Date(`${transaction.date}T00:00:00`)
  if (Number.isNaN(baseDate.getTime())) return new Date()

  const match = transaction.time.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i)
  if (!match) return baseDate

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3]?.toLowerCase()

  if (meridiem === "pm" && hours < 12) hours += 12
  if (meridiem === "am" && hours === 12) hours = 0

  baseDate.setHours(hours, minutes, 0, 0)
  return baseDate
}

function formatTimer(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function getDelayTone(waitMs: number) {
  const minutes = waitMs / 60000
  if (minutes >= 15) return "bg-red-100 text-red-700"
  if (minutes >= 8) return "bg-amber-100 text-amber-700"
  return "bg-emerald-100 text-emerald-700"
}

function getStatusTone(status: Transaction["orderStatus"]) {
  switch (status) {
    case "ready":
      return "bg-violet-100 text-violet-700"
    case "completed":
      return "bg-emerald-100 text-emerald-700"
    case "cancelled":
      return "bg-rose-100 text-rose-700"
    case "pending":
      return "bg-amber-100 text-amber-700"
    default:
      return "bg-sky-100 text-sky-700"
  }
}

function formatStatus(status: Transaction["orderStatus"]) {
  if (!status) return "Preparing"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function paymentStatusLabel(transaction: Transaction) {
  return transaction.voided ? "Voided" : "Paid"
}

function shouldIncludeInQueue(transaction: Transaction) {
  return !transaction.voided && transaction.orderStatus !== "voided"
}

function buildQueueRecord(transaction: Transaction, now: number): QueueRecord {
  const queueMeta = getTransactionQueueMetadata(transaction)
  const placedAt = queueMeta.placedAt ? new Date(queueMeta.placedAt) : parseTransactionDateTime(transaction)
  const waitMs = now - placedAt.getTime()

  return {
    transaction,
    queueMeta,
    waitMs,
    itemCount: getTransactionItemCount(transaction.items),
    itemSummary: getTransactionItemSummary(transaction.items),
    serviceLabel: getQueueOrderTypeLabel(queueMeta.orderType),
    productMix: getTransactionOrderType(transaction),
  }
}

function StageColumn({
  title,
  description,
  records,
  emptyLabel,
  role,
  onOpen,
  onAssign,
  onMarkReady,
  onComplete,
  onCancel,
  onPriorityChange,
  onOrderTypeChange,
}: {
  title: string
  description: string
  records: QueueRecord[]
  emptyLabel: string
  role: AppUserRole
  onOpen: (transaction: Transaction) => void
  onAssign: (transaction: Transaction) => void
  onMarkReady: (transaction: Transaction) => void
  onComplete: (transaction: Transaction) => void
  onCancel: (transaction: Transaction) => void
  onPriorityChange: (transaction: Transaction, priority: QueuePriority) => void
  onOrderTypeChange: (transaction: Transaction, orderType: QueueOrderType) => void
}) {
  const mayManagePreparing = canManagePreparing(role)
  const mayComplete = canCompleteQueuedOrders(role)
  const mayPrioritize = canPrioritizeQueue(role)

  return (
    <section className="rounded-[30px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/45 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#7d5a44]">{title}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#4a342a]">{records.length} active orders</h2>
          <p className="mt-2 text-sm leading-6 text-[#7d5a44]">{description}</p>
        </div>
        <span className="rounded-full border border-[#d7c9b8] bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#7d5a44]">
          Live
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {records.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-10 text-center text-sm text-[#7d5a44]">
            {emptyLabel}
          </div>
        ) : (
          records.map((record) => (
            <article
              key={record.transaction.id}
              className="rounded-[24px] border border-[#d7c9b8]/60 bg-[#f5f1ea]/78 p-4 text-left shadow-[0_18px_36px_rgba(74,52,42,0.06)] transition-colors hover:bg-[#fbf8f3]"
            >
              <button
                type="button"
                onClick={() => onOpen(record.transaction)}
                className="block w-full text-left"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#4a342a] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#f5f1ea]">
                        Queue {record.transaction.queueNumber || record.transaction.id}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(record.transaction.orderStatus)}`}>
                        {formatStatus(record.transaction.orderStatus)}
                      </span>
                      <span className="rounded-full bg-[#efe2d4] px-3 py-1 text-xs font-semibold text-[#7d5a44]">
                        {getQueuePriorityLabel(record.queueMeta.priority)}
                      </span>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-[#4a342a]">
                      {record.transaction.customerName || "Walk-in customer"}
                    </p>
                    <p className="mt-1 text-sm text-[#7d5a44]">
                      {record.itemSummary} • {record.itemCount} item{record.itemCount === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getDelayTone(record.waitMs)}`}>
                      {formatTimer(record.waitMs)}
                    </span>
                    <p className="mt-3 text-sm font-semibold text-[#4a342a]">{formatCurrency(record.transaction.total)}</p>
                    <p className="text-xs text-[#7d5a44]">{paymentStatusLabel(record.transaction)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-[#7d5a44] md:grid-cols-2">
                  <div className="rounded-2xl bg-white/65 px-3 py-2">
                    <span className="font-semibold text-[#4a342a]">Order type:</span> {record.serviceLabel}
                  </div>
                  <div className="rounded-2xl bg-white/65 px-3 py-2">
                    <span className="font-semibold text-[#4a342a]">Assigned staff:</span> {record.queueMeta.assignedStaffName || "Unassigned"}
                  </div>
                  <div className="rounded-2xl bg-white/65 px-3 py-2">
                    <span className="font-semibold text-[#4a342a]">Product mix:</span> {record.productMix}
                  </div>
                  <div className="rounded-2xl bg-white/65 px-3 py-2">
                    <span className="font-semibold text-[#4a342a]">Placed:</span> {record.queueMeta.placedAt ? new Date(record.queueMeta.placedAt).toLocaleTimeString() : `${record.transaction.date} ${record.transaction.time}`}
                  </div>
                </div>
              </button>

              {(mayPrioritize || mayManagePreparing || mayComplete) ? (
                <div className="mt-4 flex flex-col gap-3">
                  {mayPrioritize ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="rounded-2xl border border-[#d7c9b8] bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#7d5a44]">
                        Priority
                        <select
                          value={record.queueMeta.priority}
                          onChange={(event) => onPriorityChange(record.transaction, event.target.value as QueuePriority)}
                          className="mt-2 w-full bg-transparent text-sm font-medium text-[#4a342a] outline-none"
                        >
                          <option value="normal">Normal</option>
                          <option value="rush">Rush</option>
                          <option value="vip">VIP</option>
                        </select>
                      </label>
                      <label className="rounded-2xl border border-[#d7c9b8] bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#7d5a44]">
                        Service
                        <select
                          value={record.queueMeta.orderType}
                          onChange={(event) => onOrderTypeChange(record.transaction, event.target.value as QueueOrderType)}
                          className="mt-2 w-full bg-transparent text-sm font-medium text-[#4a342a] outline-none"
                        >
                          <option value="to-serve">To Serve</option>
                          <option value="pickup">Pickup</option>
                        </select>
                      </label>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {mayManagePreparing ? (
                      <button
                        type="button"
                        onClick={() => onAssign(record.transaction)}
                        className="inline-flex items-center gap-2 rounded-full border border-[#d7c9b8] bg-white/85 px-4 py-2 text-sm font-semibold text-[#4a342a] transition-colors hover:bg-white"
                      >
                        <UserRoundCheck className="h-4 w-4" />
                        {record.queueMeta.assignedStaffName ? "Reassign me" : "Assign me"}
                      </button>
                    ) : null}

                    {mayManagePreparing && record.transaction.orderStatus === "preparing" ? (
                      <button
                        type="button"
                        onClick={() => onMarkReady(record.transaction)}
                        className="inline-flex items-center gap-2 rounded-full bg-[#4a342a] px-4 py-2 text-sm font-semibold text-[#f5f1ea] transition-colors hover:bg-[#7d5a44]"
                      >
                        <ChefHat className="h-4 w-4" />
                        Mark ready
                      </button>
                    ) : null}

                    {mayComplete && record.transaction.orderStatus === "ready" ? (
                      <button
                        type="button"
                        onClick={() => onComplete(record.transaction)}
                        className="inline-flex items-center gap-2 rounded-full bg-[#2f7d32] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#256829]"
                      >
                        <CheckCheck className="h-4 w-4" />
                        Complete handoff
                      </button>
                    ) : null}

                    {(role === "admin" || role === "cashier") &&
                    record.transaction.orderStatus !== "completed" &&
                    record.transaction.orderStatus !== "cancelled" ? (
                      <button
                        type="button"
                        onClick={() => onCancel(record.transaction)}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                      >
                        <XCircle className="h-4 w-4" />
                        Cancel order
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function QueueManagementContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<QueueFilter>("all")
  const [now, setNow] = useState(Date.now())
  const currentUser = getCurrentUser()
  const currentRole = (currentUser?.role || "cashier") as AppUserRole
  const previousStatusMap = useRef<Map<string, Transaction["orderStatus"]>>(new Map())

  const loadQueue = useCallback(async () => {
    await initializeSupabaseStore()
    const nextTransactions = await getTransactions()
    setTransactions(nextTransactions.filter(shouldIncludeInQueue))
  }, [])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("queue-management-transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        void loadQueue()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadQueue])

  useEffect(() => {
    if (!("Notification" in window)) return

    const nextMap = new Map<string, Transaction["orderStatus"]>()
    transactions.forEach((transaction) => {
      const previousStatus = previousStatusMap.current.get(transaction.id)
      if (previousStatus && previousStatus !== "ready" && transaction.orderStatus === "ready") {
        if (Notification.permission === "granted") {
          new Notification("Order ready", {
            body: `${transaction.queueNumber || transaction.id} is ready for ${getQueueOrderTypeLabel(getTransactionQueueMetadata(transaction).orderType)}.`,
            tag: `queue-ready:${transaction.id}`,
          })
        } else if (Notification.permission === "default") {
          void Notification.requestPermission()
        }
      }

      nextMap.set(transaction.id, transaction.orderStatus)
    })

    previousStatusMap.current = nextMap
  }, [transactions])

  const queueRecords = useMemo(
    () => transactions.map((transaction) => buildQueueRecord(transaction, now)),
    [now, transactions]
  )

  const filteredRecords = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()

    return queueRecords.filter((record) => {
      if (statusFilter !== "all" && record.transaction.orderStatus !== statusFilter) return false
      if (!needle) return true

      return [
        record.transaction.id,
        record.transaction.queueNumber || "",
        record.transaction.customerName || "",
        record.transaction.processedBy,
        record.itemSummary,
        record.serviceLabel,
        record.productMix,
        record.queueMeta.assignedStaffName || "",
        getQueuePriorityLabel(record.queueMeta.priority),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    })
  }, [queueRecords, searchQuery, statusFilter])

  const preparingOrders = useMemo(
    () =>
      filteredRecords
        .filter((record) => record.transaction.orderStatus === "preparing" || record.transaction.orderStatus === "pending")
        .sort((left, right) => right.waitMs - left.waitMs),
    [filteredRecords]
  )

  const readyOrders = useMemo(
    () =>
      filteredRecords
        .filter((record) => record.transaction.orderStatus === "ready")
        .sort((left, right) => right.waitMs - left.waitMs),
    [filteredRecords]
  )

  const completedToday = filteredRecords.filter((record) => record.transaction.orderStatus === "completed").length
  const cancelledToday = filteredRecords.filter((record) => record.transaction.orderStatus === "cancelled").length
  const delayedOrders = filteredRecords.filter((record) => record.waitMs >= 15 * 60 * 1000).length

  const updateQueueTransaction = useCallback(
    async (
      transaction: Transaction,
      nextStatus: Transaction["orderStatus"],
      metadataPatch?: Partial<ReturnType<typeof getTransactionQueueMetadata>>
    ) => {
      const queueMeta = getTransactionQueueMetadata(transaction)
      const nextMeta = {
        ...queueMeta,
        ...metadataPatch,
      }

      await updateTransaction(transaction.id, {
        orderStatus: nextStatus,
        notes: buildQueueMetadataNote(nextMeta, transaction.notes),
      })

      await loadQueue()
    },
    [loadQueue]
  )

  const handleAssignToCurrentUser = async (transaction: Transaction) => {
    if (!currentUser) return

    await updateQueueTransaction(transaction, transaction.orderStatus || "preparing", {
      assignedStaffName: currentUser.username,
      assignedStaffRole: currentRole,
    })
  }

  const handleMarkReady = async (transaction: Transaction) => {
    await updateQueueTransaction(transaction, "ready", {
      readyAt: new Date().toISOString(),
    })
  }

  const handleComplete = async (transaction: Transaction) => {
    await updateQueueTransaction(transaction, "completed", {
      completedAt: new Date().toISOString(),
    })
  }

  const handleCancel = async (transaction: Transaction) => {
    await updateQueueTransaction(transaction, "cancelled", {
      cancelledAt: new Date().toISOString(),
    })
  }

  const handlePriorityChange = async (transaction: Transaction, priority: QueuePriority) => {
    await updateQueueTransaction(transaction, transaction.orderStatus || "preparing", { priority })
  }

  const handleOrderTypeChange = async (transaction: Transaction, orderType: QueueOrderType) => {
    await updateQueueTransaction(transaction, transaction.orderStatus || "preparing", { orderType })
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-y-auto p-4 pt-20 lg:p-6 lg:pt-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(125,90,68,0.16),transparent_58%)]" />
          <div className="absolute left-0 top-12 h-60 w-60 rounded-full bg-[#d9c4b2]/22 blur-3xl" />
          <div className="absolute bottom-12 right-10 h-72 w-72 rounded-full bg-[#ebe2d8]/42 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl space-y-4">
          <section className="rounded-[36px] border border-[#ebe2d8] bg-[linear-gradient(135deg,rgba(255,252,249,0.92),rgba(244,236,229,0.84))] p-6 shadow-[0_28px_70px_rgba(51,38,29,0.08)] backdrop-blur-xl lg:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7d5a44]">Order Fulfillment Module</p>
                <h1 className="mt-4 text-4xl font-semibold tracking-[-0.08em] text-[#4a342a] lg:text-[3.5rem]">
                  Queue Management
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[#7d5a44]">
                  Paid POS orders flow here automatically in real time so baristas, cashiers, managers, and admins can keep preparation, handoff, and service moving without refreshing the page.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[30rem]">
                <div className="rounded-[24px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/72 p-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Preparing</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-[#4a342a]">{preparingOrders.length}</p>
                  <p className="mt-2 text-sm text-[#7d5a44]">Orders currently being assembled.</p>
                </div>
                <div className="rounded-[24px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/72 p-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Ready</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-[#4a342a]">{readyOrders.length}</p>
                  <p className="mt-2 text-sm text-[#7d5a44]">Ready for pickup or table service.</p>
                </div>
                <div className="rounded-[24px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/72 p-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Delayed</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-[#4a342a]">{delayedOrders}</p>
                  <p className="mt-2 text-sm text-[#7d5a44]">Orders waiting 15 minutes or longer.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/45 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08)] backdrop-blur-xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Completed Today</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[#4a342a]">{completedToday}</p>
            </article>
            <article className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/45 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08)] backdrop-blur-xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Cancelled</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[#4a342a]">{cancelledToday}</p>
            </article>
            <article className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/45 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08)] backdrop-blur-xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Role View</p>
              <p className="mt-3 text-xl font-semibold tracking-[-0.04em] text-[#4a342a]">{currentRole.replace("_", " ")}</p>
            </article>
            <article className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/45 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08)] backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <BellRing className="h-5 w-5 text-[#7d5a44]" />
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Notifications</p>
                  <p className="mt-2 text-sm text-[#4a342a]">
                    Ready-order alerts use browser notifications when permission is granted.
                  </p>
                </div>
              </div>
            </article>
          </section>

          <section className="rounded-[30px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/45 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08)] backdrop-blur-xl">
            <div className="grid gap-3 xl:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d5a44]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by queue number, customer, item, staff, priority, or order type"
                  className="w-full rounded-2xl border border-[#ded1c5] bg-white/80 py-3 pl-11 pr-4 text-sm text-[#4a342a] outline-none shadow-[inset_0_1px_0_rgba(245,241,234,0.75)] transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
                />
              </div>
              <label className="rounded-2xl border border-[#ded1c5] bg-white/80 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#7d5a44]">
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as QueueFilter)}
                  className="mt-2 w-full bg-transparent text-sm font-medium text-[#4a342a] outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="preparing">Preparing</option>
                  <option value="ready">Ready</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <StageColumn
              title="Preparing Queue"
              description="Freshly paid orders land here automatically from POS for barista or kitchen preparation."
              records={preparingOrders}
              emptyLabel="No orders are currently being prepared."
              role={currentRole}
              onOpen={setSelectedTransaction}
              onAssign={handleAssignToCurrentUser}
              onMarkReady={handleMarkReady}
              onComplete={handleComplete}
              onCancel={handleCancel}
              onPriorityChange={handlePriorityChange}
              onOrderTypeChange={handleOrderTypeChange}
            />
            <StageColumn
              title="Ready for Pickup / To Serve"
              description="Orders move here as soon as preparation is finished and stay visible until handoff is completed."
              records={readyOrders}
              emptyLabel="No orders are waiting for pickup or service."
              role={currentRole}
              onOpen={setSelectedTransaction}
              onAssign={handleAssignToCurrentUser}
              onMarkReady={handleMarkReady}
              onComplete={handleComplete}
              onCancel={handleCancel}
              onPriorityChange={handlePriorityChange}
              onOrderTypeChange={handleOrderTypeChange}
            />
          </section>

          {currentRole === "manager" || currentRole === "inventory_staff" ? (
            <section className="rounded-[28px] border border-amber-200/70 bg-amber-50/70 p-5 shadow-[0_18px_36px_rgba(120,53,15,0.05)]">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" />
                <div>
                  <h3 className="text-base font-semibold text-amber-900">Manager monitor mode</h3>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    This view highlights queue pressure, delays, and handoff readiness. Managers can monitor the workflow live while status-changing actions remain reserved for cashiers, baristas, and admins.
                  </p>
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

export default function QueueManagementPage() {
  return (
    <AuthGuard requiredPermission="queue">
      <QueueManagementContent />
    </AuthGuard>
  )
}
