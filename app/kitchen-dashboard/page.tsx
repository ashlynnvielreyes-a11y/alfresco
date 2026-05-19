"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bell,
  CheckCheck,
  ChevronRight,
  ChefHat,
  Clock3,
  Dot,
  GripVertical,
  Hand,
  LayoutGrid,
  MonitorSmartphone,
  PackageCheck,
  Sparkles,
  UtensilsCrossed,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react"

import { AuthGuard } from "@/components/auth-guard"
import { Button } from "@/components/ui/button"
import {
  buildQueueMetadataNote,
  getQueueUserNote,
  getTransactionQueueMetadata,
  type QueueMetadata,
} from "@/lib/queue"
import { getCurrentUser, getTransactions, initializeSupabaseStore, updateTransaction } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import type { CartItem, Transaction } from "@/lib/types"

type KitchenStage = "new" | "preparing" | "ready" | "completed"

type KitchenRecord = {
  transaction: Transaction
  queueMeta: QueueMetadata
  userNote: string | null
  placedAt: Date
  waitMinutes: number
  stage: KitchenStage
  orderTypeLabel: "Dine-in" | "Takeout" | "Pickup"
}

const HOLD_STORAGE_KEY = "alfresco_kds_held_orders"

const STAGE_STYLES: Record<
  KitchenStage,
  {
    label: string
    columnClass: string
    badgeClass: string
    glowClass: string
    accentClass: string
    emptyLabel: string
  }
> = {
  new: {
    label: "New Orders",
    columnClass: "border-[#2d66ff]/28 bg-[#0f1728]/88",
    badgeClass: "border-[#2d66ff]/45 bg-[#2d66ff]/16 text-[#8eb8ff]",
    glowClass: "shadow-[0_0_0_1px_rgba(45,102,255,0.2),0_18px_50px_rgba(15,84,255,0.2)]",
    accentClass: "bg-[#2d66ff]",
    emptyLabel: "No new orders waiting to be accepted.",
  },
  preparing: {
    label: "Preparing",
    columnClass: "border-[#ff9f43]/28 bg-[#101724]/88",
    badgeClass: "border-[#ff9f43]/45 bg-[#ff9f43]/16 text-[#ffc27a]",
    glowClass: "shadow-[0_0_0_1px_rgba(255,159,67,0.18),0_18px_50px_rgba(255,159,67,0.18)]",
    accentClass: "bg-[#ff9f43]",
    emptyLabel: "No orders are currently in preparation.",
  },
  ready: {
    label: "Ready for Pickup",
    columnClass: "border-[#22c55e]/28 bg-[#0f1728]/88",
    badgeClass: "border-[#22c55e]/45 bg-[#22c55e]/16 text-[#90f0b0]",
    glowClass: "shadow-[0_0_0_1px_rgba(34,197,94,0.18),0_18px_50px_rgba(34,197,94,0.18)]",
    accentClass: "bg-[#22c55e]",
    emptyLabel: "No completed prep waiting for pickup.",
  },
  completed: {
    label: "Completed",
    columnClass: "border-white/10 bg-[#101726]/88",
    badgeClass: "border-white/12 bg-white/8 text-[#cfd7e9]",
    glowClass: "shadow-[0_0_0_1px_rgba(148,163,184,0.16),0_18px_50px_rgba(15,23,42,0.18)]",
    accentClass: "bg-[#94a3b8]",
    emptyLabel: "No completed orders to review right now.",
  },
}

function parseTransactionDateTime(transaction: Transaction, placedAt?: string | null) {
  if (placedAt) {
    const parsedPlacedAt = new Date(placedAt)
    if (!Number.isNaN(parsedPlacedAt.getTime())) return parsedPlacedAt
  }

  const mergedValue = `${transaction.date} ${transaction.time}`
  const directParse = new Date(mergedValue)
  if (!Number.isNaN(directParse.getTime())) return directParse

  const fallbackDate = new Date(`${transaction.date}T00:00:00`)
  if (Number.isNaN(fallbackDate.getTime())) return new Date()

  const match = transaction.time.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i)
  if (!match) return fallbackDate

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3]?.toLowerCase()

  if (meridiem === "pm" && hours < 12) hours += 12
  if (meridiem === "am" && hours === 12) hours = 0

  fallbackDate.setHours(hours, minutes, 0, 0)
  return fallbackDate
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date)
}

function formatCalendar(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function formatShortTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function formatWaitLabel(minutes: number) {
  if (minutes <= 0) return "Just now"
  if (minutes === 1) return "1 min ago"
  return `${minutes} mins ago`
}

function getItemDescriptor(item: CartItem) {
  const descriptors: string[] = []

  if (item.temperature) {
    descriptors.push(item.temperature === "hot" ? "Hot" : "Cold")
  }

  if (item.addOns?.length) {
    descriptors.push(item.addOns.map((addOn) => addOn.name).join(", "))
  }

  if (item.notes?.trim()) {
    descriptors.push(item.notes.trim())
  }

  return descriptors.join(" / ")
}

function resolveKitchenStage(status?: Transaction["orderStatus"]): KitchenStage {
  if (status === "completed") return "completed"
  if (status === "ready") return "ready"
  if (status === "preparing") return "preparing"
  return "new"
}

function resolveOrderTypeLabel(transaction: Transaction, queueMeta: QueueMetadata) {
  const note = getQueueUserNote(transaction.notes)?.toLowerCase() || ""

  if (queueMeta.orderType === "pickup" || note.includes("pickup")) return "Pickup"
  if (note.includes("takeout") || note.includes("take out")) return "Takeout"
  return "Dine-in"
}

function shouldShowOnKitchenBoard(transaction: Transaction) {
  return !transaction.voided && transaction.orderStatus !== "voided" && transaction.orderStatus !== "cancelled"
}

function buildKitchenRecord(transaction: Transaction, now: Date): KitchenRecord {
  const queueMeta = getTransactionQueueMetadata(transaction)
  const placedAt = parseTransactionDateTime(transaction, queueMeta.placedAt)
  const waitMinutes = Math.max(0, Math.floor((now.getTime() - placedAt.getTime()) / 60000))

  return {
    transaction,
    queueMeta,
    userNote: getQueueUserNote(transaction.notes),
    placedAt,
    waitMinutes,
    stage: resolveKitchenStage(transaction.orderStatus),
    orderTypeLabel: resolveOrderTypeLabel(transaction, queueMeta),
  }
}

function StageColumn({
  stage,
  records,
  heldOrders,
  selectedTransactionId,
  onSelect,
}: {
  stage: KitchenStage
  records: KitchenRecord[]
  heldOrders: Set<string>
  selectedTransactionId: string | null
  onSelect: (transactionId: string) => void
}) {
  const style = STAGE_STYLES[stage]

  return (
    <section
      className={`flex min-h-[24rem] flex-col rounded-[28px] border p-4 backdrop-blur-xl ${style.columnClass}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${style.accentClass} shadow-[0_0_18px_currentColor]`} />
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-white">{style.label}</h2>
            <p className="text-xs uppercase tracking-[0.18em] text-[#8ea0c4]">{records.length} orders</p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${style.badgeClass}`}>
          Live
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {records.length === 0 ? (
          <div className="flex min-h-[16rem] items-center justify-center rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] px-6 text-center text-sm text-[#94a3b8]">
            {style.emptyLabel}
          </div>
        ) : (
          records.map((record) => {
            const isSelected = selectedTransactionId === record.transaction.id
            const isHeld = heldOrders.has(record.transaction.id)

            return (
              <button
                key={record.transaction.id}
                type="button"
                onClick={() => onSelect(record.transaction.id)}
                className={`w-full rounded-[24px] border bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] p-5 text-left text-[#0f172a] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_56px_rgba(15,23,42,0.18)] ${
                  isSelected
                    ? `${style.glowClass} border-white`
                    : "border-white/70 shadow-[0_18px_38px_rgba(15,23,42,0.12)]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[2.35rem] font-black leading-none tracking-[-0.08em] text-[#091224]">
                      {record.transaction.queueNumber || record.transaction.id.slice(-4)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                      <span className={`rounded-full border px-2.5 py-1 ${style.badgeClass}`}>{style.label}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-slate-700">
                        {record.orderTypeLabel}
                      </span>
                      {isHeld ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">On Hold</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#0f172a]">{formatShortTime(record.placedAt)}</p>
                    <p className="mt-2 text-xs font-medium text-slate-500">{formatWaitLabel(record.waitMinutes)}</p>
                  </div>
                </div>

                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {record.transaction.items.map((item, index) => (
                    <li key={`${record.transaction.id}-${index}`} className="flex gap-3">
                      <span className="min-w-6 text-sm font-semibold text-slate-400">{item.quantity}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">{item.product.name}</p>
                        {getItemDescriptor(item) ? (
                          <p className="mt-0.5 text-xs leading-5 text-slate-500">{getItemDescriptor(item)}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-200 pt-4">
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Customer Notes</p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {record.userNote || "No special instructions."}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                </div>
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}

function KitchenDashboardContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [clockNow, setClockNow] = useState(() => new Date())
  const [lastSyncAt, setLastSyncAt] = useState(() => new Date())
  const [isOnline, setIsOnline] = useState(true)
  const [heldOrderIds, setHeldOrderIds] = useState<string[]>([])
  const [controlMessage, setControlMessage] = useState("Realtime sync active with cashier POS and customer queue display.")

  const currentUser = getCurrentUser()

  const loadKitchenOrders = useCallback(async () => {
    await initializeSupabaseStore()
    const nextTransactions = await getTransactions()
    const kitchenTransactions = nextTransactions.filter(shouldShowOnKitchenBoard)

    setTransactions(kitchenTransactions)
    setLastSyncAt(new Date())
  }, [])

  useEffect(() => {
    void loadKitchenOrders()
  }, [loadKitchenOrders])

  useEffect(() => {
    const timerId = window.setInterval(() => setClockNow(new Date()), 1000)
    return () => window.clearInterval(timerId)
  }, [])

  useEffect(() => {
    const savedHeldOrders = window.localStorage.getItem(HOLD_STORAGE_KEY)
    if (savedHeldOrders) {
      try {
        setHeldOrderIds(JSON.parse(savedHeldOrders) as string[])
      } catch {
        setHeldOrderIds([])
      }
    }

    const syncOnlineState = () => setIsOnline(window.navigator.onLine)
    syncOnlineState()
    window.addEventListener("online", syncOnlineState)
    window.addEventListener("offline", syncOnlineState)

    return () => {
      window.removeEventListener("online", syncOnlineState)
      window.removeEventListener("offline", syncOnlineState)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(heldOrderIds))
  }, [heldOrderIds])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("kitchen-dashboard-transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        setControlMessage("New cashier activity received. Kitchen board synchronized.")
        void loadKitchenOrders()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadKitchenOrders])

  const kitchenRecords = useMemo(
    () =>
      transactions
        .map((transaction) => buildKitchenRecord(transaction, clockNow))
        .sort((left, right) => left.placedAt.getTime() - right.placedAt.getTime()),
    [clockNow, transactions]
  )

  const recordsByStage = useMemo(
    () => ({
      new: kitchenRecords.filter((record) => record.stage === "new"),
      preparing: kitchenRecords.filter((record) => record.stage === "preparing"),
      ready: kitchenRecords.filter((record) => record.stage === "ready"),
      completed: kitchenRecords.filter((record) => record.stage === "completed").slice(-12).reverse(),
    }),
    [kitchenRecords]
  )

  const selectedRecord =
    kitchenRecords.find((record) => record.transaction.id === selectedTransactionId) ||
    recordsByStage.new[0] ||
    recordsByStage.preparing[0] ||
    recordsByStage.ready[0] ||
    recordsByStage.completed[0] ||
    null

  useEffect(() => {
    if (!selectedRecord) {
      setSelectedTransactionId(null)
      return
    }

    if (selectedTransactionId !== selectedRecord.transaction.id) {
      setSelectedTransactionId(selectedRecord.transaction.id)
    }
  }, [selectedRecord, selectedTransactionId])

  const heldOrders = useMemo(() => new Set(heldOrderIds), [heldOrderIds])

  const totalOrders = recordsByStage.new.length + recordsByStage.preparing.length + recordsByStage.ready.length
  const notificationCount = recordsByStage.new.length + recordsByStage.ready.length

  const updateQueueStatus = useCallback(
    async (transaction: Transaction, nextStatus: Transaction["orderStatus"], metadataPatch?: Partial<QueueMetadata>) => {
      const queueMeta = getTransactionQueueMetadata(transaction)
      const nextQueueMeta: QueueMetadata = {
        ...queueMeta,
        ...metadataPatch,
        placedAt: queueMeta.placedAt || new Date().toISOString(),
      }

      await updateTransaction(transaction.id, {
        orderStatus: nextStatus,
        notes: buildQueueMetadataNote(nextQueueMeta, transaction.notes),
      })

      setControlMessage(`Order ${transaction.queueNumber || transaction.id} moved to ${nextStatus}.`)
      await loadKitchenOrders()
    },
    [loadKitchenOrders]
  )

  const handleAcceptOrder = useCallback(async () => {
    if (!selectedRecord) return

    await updateQueueStatus(selectedRecord.transaction, "preparing", {
      assignedStaffName: currentUser?.username || selectedRecord.queueMeta.assignedStaffName,
      assignedStaffRole: currentUser?.role || selectedRecord.queueMeta.assignedStaffRole,
    })
  }, [currentUser?.role, currentUser?.username, selectedRecord, updateQueueStatus])

  const handleMarkPreparing = useCallback(async () => {
    if (!selectedRecord) return

    await updateQueueStatus(selectedRecord.transaction, "preparing", {
      assignedStaffName: currentUser?.username || selectedRecord.queueMeta.assignedStaffName,
      assignedStaffRole: currentUser?.role || selectedRecord.queueMeta.assignedStaffRole,
    })
  }, [currentUser?.role, currentUser?.username, selectedRecord, updateQueueStatus])

  const handleMarkReady = useCallback(async () => {
    if (!selectedRecord) return
    await updateQueueStatus(selectedRecord.transaction, "ready", { readyAt: new Date().toISOString() })
  }, [selectedRecord, updateQueueStatus])

  const handleCompleteOrder = useCallback(async () => {
    if (!selectedRecord) return
    await updateQueueStatus(selectedRecord.transaction, "completed", { completedAt: new Date().toISOString() })
  }, [selectedRecord, updateQueueStatus])

  const handleCancelOrder = useCallback(async () => {
    if (!selectedRecord) return

    await updateTransaction(selectedRecord.transaction.id, {
      orderStatus: "cancelled",
      notes: buildQueueMetadataNote(
        {
          ...selectedRecord.queueMeta,
          cancelledAt: new Date().toISOString(),
          placedAt: selectedRecord.queueMeta.placedAt || selectedRecord.placedAt.toISOString(),
        },
        selectedRecord.transaction.notes
      ),
    })

    setControlMessage(`Order ${selectedRecord.transaction.queueNumber || selectedRecord.transaction.id} was cancelled.`)
    await loadKitchenOrders()
  }, [loadKitchenOrders, selectedRecord])

  const handleCallNextQueue = useCallback(() => {
    const nextRecord = recordsByStage.new[0] || recordsByStage.preparing[0] || recordsByStage.ready[0]
    if (!nextRecord) {
      setControlMessage("No active queue available to call right now.")
      return
    }

    setSelectedTransactionId(nextRecord.transaction.id)
    setControlMessage(`Calling queue ${nextRecord.transaction.queueNumber || nextRecord.transaction.id}.`)
  }, [recordsByStage.new, recordsByStage.preparing, recordsByStage.ready])

  const handleBumpOrder = useCallback(async () => {
    if (!selectedRecord) return

    const earliestPlacedAt = kitchenRecords.reduce((earliest, record) => {
      return record.placedAt.getTime() < earliest ? record.placedAt.getTime() : earliest
    }, selectedRecord.placedAt.getTime())

    await updateTransaction(selectedRecord.transaction.id, {
      notes: buildQueueMetadataNote(
        {
          ...selectedRecord.queueMeta,
          placedAt: new Date(earliestPlacedAt - 60_000).toISOString(),
        },
        selectedRecord.transaction.notes
      ),
    })

    setControlMessage(`Order ${selectedRecord.transaction.queueNumber || selectedRecord.transaction.id} bumped to the top.`)
    await loadKitchenOrders()
  }, [kitchenRecords, loadKitchenOrders, selectedRecord])

  const handleHoldOrder = useCallback(() => {
    if (!selectedRecord) return

    const nextSet = new Set(heldOrderIds)
    if (nextSet.has(selectedRecord.transaction.id)) {
      nextSet.delete(selectedRecord.transaction.id)
      setControlMessage(`Order ${selectedRecord.transaction.queueNumber || selectedRecord.transaction.id} removed from hold.`)
    } else {
      nextSet.add(selectedRecord.transaction.id)
      setControlMessage(`Order ${selectedRecord.transaction.queueNumber || selectedRecord.transaction.id} put on hold.`)
    }

    setHeldOrderIds(Array.from(nextSet))
  }, [heldOrderIds, selectedRecord])

  const handleViewAllOrders = useCallback(() => {
    setControlMessage("All kitchen stages are visible. Scroll horizontally or vertically to review every live order.")
  }, [])

  return (
    <div className="min-h-screen bg-[#08101d] text-white">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(45,102,255,0.18),transparent_24%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_20%),linear-gradient(180deg,#08101d_0%,#0b1525_42%,#0d1828_100%)]">
        <div className="mx-auto flex min-h-screen max-w-[1920px] flex-col px-4 py-4 sm:px-5 lg:px-6">
          <header className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,20,35,0.94),rgba(10,17,30,0.9))] px-5 py-5 shadow-[0_22px_65px_rgba(2,8,23,0.45)] backdrop-blur-xl">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="flex items-center gap-4 rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-3">
                  <div className="rounded-[18px] border border-white/10 bg-white/5 p-3">
                    <Image src="/alfresco-logo.png" alt="Al Fresco Cafe" width={144} height={48} className="h-10 w-auto object-contain" priority />
                  </div>
                  <div>
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[#8da3c9]">Coffee Shop KDS</p>
                    <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-white sm:text-[2rem]">
                      Kitchen Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-[#a6b4cf]">
                      Fullscreen production board for cashier-to-kitchen queue synchronization.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <LayoutGrid className="h-5 w-5 text-[#8eb8ff]" />
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8da3c9]">Total Orders</p>
                        <p className="mt-1 text-3xl font-black tracking-[-0.06em] text-white">{totalOrders}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ChefHat className="h-5 w-5 text-[#ffc27a]" />
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8da3c9]">Preparing</p>
                        <p className="mt-1 text-3xl font-black tracking-[-0.06em] text-white">{recordsByStage.preparing.length}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PackageCheck className="h-5 w-5 text-[#90f0b0]" />
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8da3c9]">Ready</p>
                        <p className="mt-1 text-3xl font-black tracking-[-0.06em] text-white">{recordsByStage.ready.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row xl:items-center">
                <div className="rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Clock3 className="h-5 w-5 text-white" />
                    <div>
                      <p className="text-2xl font-black tracking-[-0.04em] text-white">{formatClock(clockNow)}</p>
                      <p className="text-sm text-[#a6b4cf]">{formatCalendar(clockNow)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-3">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06]">
                    <Bell className="h-5 w-5 text-white" />
                    <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold text-white">
                      {notificationCount}
                    </span>
                  </div>
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8da3c9]">Alerts</p>
                    <p className="mt-1 text-sm text-white">New and ready queue changes are highlighted live.</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="mt-4 grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
            <section className="min-h-0 rounded-[30px] border border-white/10 bg-white/[0.03] p-3 shadow-[0_20px_60px_rgba(2,8,23,0.34)] backdrop-blur-xl">
              <div className="grid min-h-[calc(100vh-13rem)] gap-3 xl:grid-cols-4">
                <StageColumn
                  stage="new"
                  records={recordsByStage.new}
                  heldOrders={heldOrders}
                  selectedTransactionId={selectedTransactionId}
                  onSelect={setSelectedTransactionId}
                />
                <StageColumn
                  stage="preparing"
                  records={recordsByStage.preparing}
                  heldOrders={heldOrders}
                  selectedTransactionId={selectedTransactionId}
                  onSelect={setSelectedTransactionId}
                />
                <StageColumn
                  stage="ready"
                  records={recordsByStage.ready}
                  heldOrders={heldOrders}
                  selectedTransactionId={selectedTransactionId}
                  onSelect={setSelectedTransactionId}
                />
                <StageColumn
                  stage="completed"
                  records={recordsByStage.completed}
                  heldOrders={heldOrders}
                  selectedTransactionId={selectedTransactionId}
                  onSelect={setSelectedTransactionId}
                />
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,30,0.96),rgba(9,15,26,0.94))] p-5 shadow-[0_22px_60px_rgba(2,8,23,0.4)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8da3c9]">Order Details</p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-white">
                      {selectedRecord ? selectedRecord.transaction.queueNumber || selectedRecord.transaction.id : "No Order"}
                    </h2>
                  </div>
                  {selectedRecord ? (
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${STAGE_STYLES[selectedRecord.stage].badgeClass}`}>
                      {STAGE_STYLES[selectedRecord.stage].label}
                    </span>
                  ) : null}
                </div>

                {selectedRecord ? (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-[20px] border border-white/8 bg-white/[0.04] p-3">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8da3c9]">Order Type</p>
                        <p className="mt-2 text-base font-semibold text-white">{selectedRecord.orderTypeLabel}</p>
                      </div>
                      <div className="rounded-[20px] border border-white/8 bg-white/[0.04] p-3">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8da3c9]">Placed</p>
                        <p className="mt-2 text-base font-semibold text-white">{formatShortTime(selectedRecord.placedAt)}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8da3c9]">Items</p>
                        <p className="text-sm text-[#d7e0f2]">{selectedRecord.transaction.items.length} lines</p>
                      </div>
                      <ul className="mt-4 space-y-3">
                        {selectedRecord.transaction.items.map((item, index) => (
                          <li key={`${selectedRecord.transaction.id}-detail-${index}`} className="rounded-[18px] border border-white/8 bg-[#0c1524] px-3 py-3">
                            <div className="flex items-start gap-3">
                              <span className="rounded-xl bg-white/6 px-2 py-1 text-sm font-bold text-white">{item.quantity}</span>
                              <div className="min-w-0">
                                <p className="font-semibold text-white">{item.product.name}</p>
                                {getItemDescriptor(item) ? (
                                  <p className="mt-1 text-sm leading-6 text-[#9fb0cf]">{getItemDescriptor(item)}</p>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#8da3c9]">Customer Notes</p>
                      <p className="mt-3 text-sm leading-6 text-[#d7e0f2]">
                        {selectedRecord.userNote || "No special preparation instructions were added for this order."}
                      </p>
                    </div>

                    <div className="mt-5 grid gap-3">
                      <Button
                        onClick={handleAcceptOrder}
                        disabled={selectedRecord.stage !== "new"}
                        className="h-12 rounded-2xl bg-[#2d66ff] text-base font-semibold text-white shadow-[0_16px_30px_rgba(45,102,255,0.28)] hover:bg-[#2057ec]"
                      >
                        <Hand className="h-4 w-4" />
                        Accept Order
                      </Button>
                      <Button
                        onClick={handleMarkPreparing}
                        disabled={selectedRecord.stage !== "new"}
                        className="h-12 rounded-2xl bg-[#ff9f43] text-base font-semibold text-[#111827] shadow-[0_16px_30px_rgba(255,159,67,0.24)] hover:bg-[#ffb35f]"
                      >
                        <ChefHat className="h-4 w-4" />
                        Mark Preparing
                      </Button>
                      <Button
                        onClick={handleMarkReady}
                        disabled={selectedRecord.stage !== "preparing"}
                        className="h-12 rounded-2xl bg-[#22c55e] text-base font-semibold text-white shadow-[0_16px_30px_rgba(34,197,94,0.25)] hover:bg-[#1dac52]"
                      >
                        <PackageCheck className="h-4 w-4" />
                        Mark Ready
                      </Button>
                      <Button
                        onClick={handleCompleteOrder}
                        disabled={selectedRecord.stage !== "ready"}
                        className="h-12 rounded-2xl bg-[#94a3b8] text-base font-semibold text-[#0f172a] shadow-[0_16px_30px_rgba(148,163,184,0.2)] hover:bg-[#aab7c9]"
                      >
                        <CheckCheck className="h-4 w-4" />
                        Complete Order
                      </Button>
                      <Button
                        onClick={handleCancelOrder}
                        disabled={selectedRecord.stage === "completed"}
                        className="h-12 rounded-2xl bg-[#dc2626] text-base font-semibold text-white shadow-[0_16px_30px_rgba(220,38,38,0.22)] hover:bg-[#c11f1f]"
                      >
                        <XCircle className="h-4 w-4" />
                        Cancel Order
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="mt-6 rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] p-6 text-center text-sm text-[#9fb0cf]">
                    Waiting for the first kitchen order to arrive from POS.
                  </div>
                )}
              </section>

              <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,30,0.96),rgba(9,15,26,0.94))] p-5 shadow-[0_22px_60px_rgba(2,8,23,0.4)] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <UtensilsCrossed className="h-5 w-5 text-[#8eb8ff]" />
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8da3c9]">Kitchen Controls</p>
                    <h3 className="mt-1 text-xl font-black tracking-[-0.04em] text-white">Service Actions</h3>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={handleCallNextQueue}
                    className="flex min-h-16 items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
                  >
                    <Bell className="h-5 w-5 text-white" />
                    <div>
                      <p className="font-semibold text-white">Call Next Queue</p>
                      <p className="text-sm text-[#9fb0cf]">Highlight the next order for pickup or prep.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleBumpOrder}
                    className="flex min-h-16 items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
                  >
                    <GripVertical className="h-5 w-5 text-white" />
                    <div>
                      <p className="font-semibold text-white">Bump Order</p>
                      <p className="text-sm text-[#9fb0cf]">Move the selected order to the top of the board.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleHoldOrder}
                    className="flex min-h-16 items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
                  >
                    <Clock3 className="h-5 w-5 text-white" />
                    <div>
                      <p className="font-semibold text-white">Hold Order</p>
                      <p className="text-sm text-[#9fb0cf]">Temporarily flag the selected order for follow-up.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleViewAllOrders}
                    className="flex min-h-16 items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
                  >
                    <MonitorSmartphone className="h-5 w-5 text-white" />
                    <div>
                      <p className="font-semibold text-white">View All Orders</p>
                      <p className="text-sm text-[#9fb0cf]">Review every queue stage on the live kitchen board.</p>
                    </div>
                  </button>
                </div>
              </section>

              <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,30,0.96),rgba(9,15,26,0.94))] p-5 shadow-[0_22px_60px_rgba(2,8,23,0.4)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8da3c9]">Kitchen Status</p>
                    <h3 className="mt-1 text-xl font-black tracking-[-0.04em] text-white">Realtime Sync</h3>
                  </div>
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${isOnline ? "border-[#22c55e]/35 bg-[#22c55e]/12 text-[#90f0b0]" : "border-rose-500/35 bg-rose-500/12 text-rose-300"}`}>
                    {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                    {isOnline ? "Online" : "Offline"}
                  </div>
                </div>

                <div className="mt-4 space-y-3 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-4 w-4 text-[#8eb8ff]" />
                    <p className="text-sm leading-6 text-[#d7e0f2]">{controlMessage}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#9fb0cf]">
                    <Dot className="h-5 w-5 text-[#22c55e]" />
                    Last sync: {formatClock(lastSyncAt)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#9fb0cf]">
                    <CheckCheck className="h-4 w-4 text-[#90f0b0]" />
                    Queue statuses propagate to the customer queue display through the shared transaction stream.
                  </div>
                </div>
              </section>
            </aside>
          </main>
        </div>
      </div>
    </div>
  )
}

export default function KitchenDashboardPage() {
  return (
    <AuthGuard requiredPermission="queue">
      <KitchenDashboardContent />
    </AuthGuard>
  )
}
