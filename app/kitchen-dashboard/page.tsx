"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bell,
  Check,
  ChefHat,
  ClipboardList,
  Clock3,
  Dot,
  LayoutGrid,
  ListOrdered,
  Megaphone,
  PauseCircle,
  PackageCheck,
  RefreshCw,
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
    iconClass: string
    viewAllClass: string
    cardRingClass: string
  }
> = {
  new: {
    label: "New Orders",
    columnClass: "border-[#1b4fc7]/35 bg-[#0d1523]",
    badgeClass: "border-[#2d66ff]/45 bg-[#2d66ff]/16 text-[#8eb8ff]",
    glowClass: "shadow-[0_0_0_1px_rgba(45,102,255,0.2),0_18px_50px_rgba(15,84,255,0.2)]",
    accentClass: "bg-[#2d66ff]",
    emptyLabel: "No new orders waiting to be accepted.",
    iconClass: "bg-[#2d66ff] text-white",
    viewAllClass: "text-[#4d94ff]",
    cardRingClass: "border-[#2d66ff] shadow-[0_0_0_1px_rgba(45,102,255,0.18),0_18px_34px_rgba(0,0,0,0.18)]",
  },
  preparing: {
    label: "Preparing",
    columnClass: "border-[#b76417]/35 bg-[#0d1523]",
    badgeClass: "border-[#ff9f43]/45 bg-[#ff9f43]/16 text-[#ffc27a]",
    glowClass: "shadow-[0_0_0_1px_rgba(255,159,67,0.18),0_18px_50px_rgba(255,159,67,0.18)]",
    accentClass: "bg-[#ff9f43]",
    emptyLabel: "No orders are currently in preparation.",
    iconClass: "bg-[#ff8c1a] text-white",
    viewAllClass: "text-[#ffad4d]",
    cardRingClass: "border-[#ff9f43] shadow-[0_0_0_1px_rgba(255,159,67,0.18),0_18px_34px_rgba(0,0,0,0.18)]",
  },
  ready: {
    label: "Ready for Pickup",
    columnClass: "border-[#1e8f45]/35 bg-[#0d1523]",
    badgeClass: "border-[#22c55e]/45 bg-[#22c55e]/16 text-[#90f0b0]",
    glowClass: "shadow-[0_0_0_1px_rgba(34,197,94,0.18),0_18px_50px_rgba(34,197,94,0.18)]",
    accentClass: "bg-[#22c55e]",
    emptyLabel: "No completed prep waiting for pickup.",
    iconClass: "bg-[#1faa43] text-white",
    viewAllClass: "text-[#51d174]",
    cardRingClass: "border-[#22c55e] shadow-[0_0_0_1px_rgba(34,197,94,0.18),0_18px_34px_rgba(0,0,0,0.18)]",
  },
  completed: {
    label: "Completed",
    columnClass: "border-white/12 bg-[#0d1523]",
    badgeClass: "border-white/12 bg-white/8 text-[#cfd7e9]",
    glowClass: "shadow-[0_0_0_1px_rgba(148,163,184,0.16),0_18px_50px_rgba(15,23,42,0.18)]",
    accentClass: "bg-[#94a3b8]",
    emptyLabel: "No completed orders to review right now.",
    iconClass: "bg-[#4b5563] text-white",
    viewAllClass: "text-[#b8c2d8]",
    cardRingClass: "border-[#485468] shadow-[0_0_0_1px_rgba(148,163,184,0.15),0_18px_34px_rgba(0,0,0,0.18)]",
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

function getStageIcon(stage: KitchenStage) {
  switch (stage) {
    case "new":
      return ClipboardList
    case "preparing":
      return ChefHat
    case "ready":
      return PackageCheck
    case "completed":
      return Check
  }
}

function getCardStatusLabel(stage: KitchenStage) {
  switch (stage) {
    case "new":
      return "Accept"
    case "preparing":
      return "Preparing"
    case "ready":
      return "Ready"
    case "completed":
      return "Completed"
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
  const StageIcon = getStageIcon(stage)

  return (
    <section className={`flex min-h-[24rem] flex-col rounded-[22px] border shadow-[0_24px_60px_rgba(2,8,23,0.28)] ${style.columnClass}`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${style.iconClass}`}>
            <StageIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[1.05rem] font-extrabold uppercase tracking-[-0.02em] text-white">{style.label}</h2>
          </div>
        </div>
        <span className={`min-w-9 rounded-xl px-3 py-1.5 text-center text-sm font-bold ${style.iconClass}`}>
          {records.length}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {records.length === 0 ? (
          <div className="flex min-h-[16rem] items-center justify-center rounded-[18px] border border-dashed border-white/12 bg-white/[0.03] px-6 text-center text-sm text-[#94a3b8]">
            {style.emptyLabel}
          </div>
        ) : (
          records.map((record) => {
            const isSelected = selectedTransactionId === record.transaction.id
            const isHeld = heldOrders.has(record.transaction.id)
            const cardStatusLabel = isHeld ? "Hold" : getCardStatusLabel(stage)

            return (
              <button
                key={record.transaction.id}
                type="button"
                onClick={() => onSelect(record.transaction.id)}
                className={`w-full rounded-[16px] border-2 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 text-left text-[#0f172a] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_56px_rgba(15,23,42,0.18)] ${
                  isSelected
                    ? `${style.glowClass} ${style.cardRingClass}`
                    : `${style.cardRingClass} opacity-95`
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[2.1rem] font-black leading-none tracking-[-0.08em] text-[#091224]">
                      {record.transaction.queueNumber || record.transaction.id.slice(-4)}
                    </p>
                    <p className="mt-2 text-[1rem] text-slate-600">{record.orderTypeLabel}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#0f172a]">{formatShortTime(record.placedAt)}</p>
                  </div>
                </div>

                <ul className="mt-4 space-y-2 text-[0.98rem] text-slate-700">
                  {record.transaction.items.slice(0, 3).map((item, index) => (
                    <li key={`${record.transaction.id}-${index}`} className="flex gap-3">
                      <span className="min-w-5 text-sm font-medium text-slate-500">{item.quantity}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">{item.product.name}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>{formatWaitLabel(record.waitMinutes)}</span>
                  </div>
                  <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.04em] ${isHeld ? "border-rose-200 bg-rose-50 text-rose-700" : style.badgeClass}`}>
                    {cardStatusLabel}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>

      <div className="border-t border-white/8 px-4 py-4 text-center">
        <button type="button" className={`text-base font-semibold ${style.viewAllClass}`}>
          View all ({records.length})
        </button>
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

  const selectedStatusLabel = selectedRecord ? getCardStatusLabel(selectedRecord.stage) : "No Status"

  return (
    <div className="min-h-screen bg-[#060d18] text-white">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(36,75,186,0.18),transparent_24%),radial-gradient(circle_at_top_right,rgba(31,170,67,0.12),transparent_22%),linear-gradient(180deg,#060d18_0%,#0a1321_45%,#0b1422_100%)]">
        <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col px-4 py-4">
          <header className="rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(13,21,35,0.98),rgba(11,18,30,0.94))] px-4 py-3 shadow-[0_18px_48px_rgba(2,8,23,0.4)]">
            <div className="grid gap-3 xl:grid-cols-[auto_1fr_auto] xl:items-center">
              <div className="flex items-center gap-4 border-white/10 xl:border-r xl:pr-6">
                <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-3">
                  <Image src="/alfresco-logo.png" alt="Al Fresco Cafe" width={140} height={44} className="h-10 w-auto object-contain" priority />
                </div>
                <div>
                  <h1 className="text-[2rem] font-black leading-none tracking-[-0.05em] text-white">KITCHEN QUEUE</h1>
                  <p className="mt-1 text-lg text-[#b3c0d8]">Work with speed. Serve with pride.</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[16px] border border-white/8 bg-white/[0.04] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="h-8 w-8 rounded-xl bg-white/5 p-1.5 text-[#d6e4ff]" />
                    <div>
                      <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#8da3c9]">Total Orders</p>
                      <p className="mt-1 text-[2rem] font-black leading-none text-white">{totalOrders}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[16px] border border-white/8 bg-white/[0.04] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ChefHat className="h-8 w-8 rounded-xl bg-[#ff9f43]/15 p-1.5 text-[#ff9f43]" />
                    <div>
                      <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#8da3c9]">Preparing</p>
                      <p className="mt-1 text-[2rem] font-black leading-none text-white">{recordsByStage.preparing.length}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[16px] border border-white/8 bg-white/[0.04] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <PackageCheck className="h-8 w-8 rounded-xl bg-[#22c55e]/15 p-1.5 text-[#22c55e]" />
                    <div>
                      <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#8da3c9]">Ready</p>
                      <p className="mt-1 text-[2rem] font-black leading-none text-white">{recordsByStage.ready.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row xl:justify-end">
                <div className="flex items-center gap-3 rounded-[16px] border border-white/8 bg-white/[0.04] px-4 py-3">
                  <Clock3 className="h-7 w-7 text-white" />
                  <div>
                    <p className="text-[1.9rem] font-black leading-none tracking-[-0.04em] text-white">{formatClock(clockNow)}</p>
                    <p className="mt-1 text-sm text-[#b3c0d8]">{formatCalendar(clockNow)}</p>
                  </div>
                </div>
                <div className="flex h-[4.5rem] items-center justify-center rounded-[16px] border border-white/8 bg-white/[0.04] px-4">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06]">
                    <Bell className="h-5 w-5 text-white" />
                    <span className="absolute right-0 top-0 flex h-5 min-w-5 -translate-y-1/3 translate-x-1/3 items-center justify-center rounded-full bg-[#e11d48] px-1 text-[10px] font-bold text-white">
                      {notificationCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="mt-4 grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <section className="min-h-0 rounded-[22px] border border-white/8 bg-white/[0.02] p-3 shadow-[0_20px_60px_rgba(2,8,23,0.34)]">
                <div className="grid min-h-[calc(100vh-16.5rem)] gap-3 xl:grid-cols-4">
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

              <section className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-[18px] border border-white/8 bg-[#0d1523] px-4 py-4 text-[#dce6f7] shadow-[0_16px_40px_rgba(2,8,23,0.26)]">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-[#facc15]" />
                    <p className="text-lg"><span className="font-extrabold uppercase">Tip:</span> Focus on preparing one order at a time for better quality.</p>
                  </div>
                </div>
                <div className="rounded-[18px] border border-white/8 bg-[#0d1523] px-4 py-4 text-[#dce6f7] shadow-[0_16px_40px_rgba(2,8,23,0.26)]">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-[#f59e0b]" />
                    <p className="text-lg"><span className="font-extrabold uppercase">Today's Promo:</span> Buy 1 Get 1 on all iced beverages.</p>
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,21,35,0.98),rgba(11,18,30,0.96))] p-4 shadow-[0_20px_55px_rgba(2,8,23,0.4)]">
                <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
                  <p className="text-[1.05rem] font-extrabold uppercase tracking-[-0.02em] text-white">Order Details</p>
                  <button type="button" className="text-[#9fb0cf]">
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>

                {selectedRecord ? (
                  <>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-[2.35rem] font-black tracking-[-0.08em] text-[#ff9f43]">
                        {selectedRecord.transaction.queueNumber || selectedRecord.transaction.id}
                      </p>
                      <span className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase ${selectedRecord.stage === "preparing" ? "border-[#ff9f43]/40 bg-[#ff9f43]/18 text-[#ffc27a]" : STAGE_STYLES[selectedRecord.stage].badgeClass}`}>
                        {selectedStatusLabel}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-[1rem] text-[#d7e0f2]">
                      <span>{selectedRecord.orderTypeLabel}</span>
                      <span>{formatShortTime(selectedRecord.placedAt)} ({formatWaitLabel(selectedRecord.waitMinutes)})</span>
                    </div>

                    <div className="mt-4 border-t border-white/8 pt-4">
                      <ul className="space-y-4">
                        {selectedRecord.transaction.items.map((item, index) => (
                          <li key={`${selectedRecord.transaction.id}-detail-${index}`} className="flex gap-3 text-[#dbe6f8]">
                            <span className="min-w-6 text-lg font-medium">{item.quantity}</span>
                            <div className="min-w-0">
                              <p className="text-[1.05rem] font-semibold text-white">{item.product.name}</p>
                              {getItemDescriptor(item) ? (
                                <p className="mt-1 text-sm leading-6 text-[#a5b5d0]">{getItemDescriptor(item)}</p>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4 border-t border-white/8 pt-4">
                      <p className="text-sm text-[#dbe6f8]">Note: {selectedRecord.userNote || "No special instructions."}</p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <Button
                        onClick={selectedRecord.stage === "preparing" ? handleMarkReady : handleAcceptOrder}
                        disabled={selectedRecord.stage !== "new" && selectedRecord.stage !== "preparing"}
                        className={`h-12 rounded-xl text-base font-bold text-white ${selectedRecord.stage === "preparing" ? "bg-[#16a34a] hover:bg-[#15803d]" : "bg-[#2563eb] hover:bg-[#1d4ed8]"}`}
                      >
                        {selectedRecord.stage === "preparing" ? "Mark Ready" : "Accept Order"}
                      </Button>
                      <Button
                        onClick={handleCancelOrder}
                        disabled={selectedRecord.stage === "completed"}
                        className="h-12 rounded-xl bg-[#dc2626] text-base font-bold text-white hover:bg-[#b91c1c]"
                      >
                        Cancel Order
                      </Button>
                    </div>

                    <div className="mt-3 grid gap-3">
                      <Button
                        onClick={handleMarkPreparing}
                        disabled={selectedRecord.stage !== "new"}
                        className="h-11 rounded-xl bg-[#ff9f43] text-base font-bold text-[#0f172a] hover:bg-[#ffb35f]"
                      >
                        Mark Preparing
                      </Button>
                      <Button
                        onClick={handleCompleteOrder}
                        disabled={selectedRecord.stage !== "ready"}
                        className="h-11 rounded-xl bg-[#64748b] text-base font-bold text-white hover:bg-[#475569]"
                      >
                        Complete Order
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="mt-6 rounded-[18px] border border-dashed border-white/12 bg-white/[0.03] p-6 text-center text-sm text-[#9fb0cf]">
                    Waiting for the first kitchen order to arrive from POS.
                  </div>
                )}
              </section>

              <section className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,21,35,0.98),rgba(11,18,30,0.96))] p-4 shadow-[0_20px_55px_rgba(2,8,23,0.4)]">
                <div className="flex items-center gap-3">
                  <UtensilsCrossed className="h-5 w-5 text-white" />
                  <h3 className="text-[1.05rem] font-extrabold uppercase tracking-[-0.02em] text-white">Kitchen Controls</h3>
                </div>

                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={handleCallNextQueue}
                    className="flex min-h-16 items-center gap-4 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
                  >
                    <Megaphone className="h-5 w-5 text-white" />
                    <div>
                      <p className="font-semibold text-white">Call Next Queue</p>
                      <p className="text-sm text-[#9fb0cf]">Call the next order number.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleBumpOrder}
                    className="flex min-h-16 items-center gap-4 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
                  >
                    <RefreshCw className="h-5 w-5 text-white" />
                    <div>
                      <p className="font-semibold text-white">Bump Order</p>
                      <p className="text-sm text-[#9fb0cf]">Move order to top.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleHoldOrder}
                    className="flex min-h-16 items-center gap-4 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
                  >
                    <PauseCircle className="h-5 w-5 text-white" />
                    <div>
                      <p className="font-semibold text-white">Hold Order</p>
                      <p className="text-sm text-[#9fb0cf]">Temporarily hold order.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleViewAllOrders}
                    className="flex min-h-16 items-center gap-4 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
                  >
                    <ListOrdered className="h-5 w-5 text-white" />
                    <div>
                      <p className="font-semibold text-white">View All Orders</p>
                      <p className="text-sm text-[#9fb0cf]">See all orders list.</p>
                    </div>
                  </button>
                </div>
              </section>

              <section className="rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,21,35,0.98),rgba(11,18,30,0.96))] p-4 shadow-[0_20px_55px_rgba(2,8,23,0.4)]">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[1.05rem] font-extrabold uppercase tracking-[-0.02em] text-white">Kitchen Status</h3>
                  <div className={`inline-flex items-center gap-2 text-sm font-semibold ${isOnline ? "text-[#22c55e]" : "text-rose-300"}`}>
                    <Dot className="h-5 w-5" />
                    {isOnline ? "Online" : "Offline"}
                  </div>
                </div>

                <div className="mt-4 border-t border-white/8 pt-4">
                  <div className="mb-3 h-1.5 w-24 rounded-full bg-[#16a34a]" />
                  <p className="text-[1rem] text-[#d7e0f2]">Last sync: {formatClock(lastSyncAt)}</p>
                  <div className="mt-4 flex items-start gap-3 text-sm text-[#9fb0cf]">
                    {isOnline ? <Wifi className="mt-0.5 h-4 w-4 text-[#22c55e]" /> : <WifiOff className="mt-0.5 h-4 w-4 text-rose-300" />}
                    <p>{controlMessage}</p>
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
