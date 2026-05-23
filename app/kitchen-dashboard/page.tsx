"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  Check,
  ChefHat,
  ClipboardList,
  Clock3,
  Dot,
  LayoutGrid,
  Loader2,
  LogOut,
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
import { LiveQueueBoard } from "@/components/live-queue-board"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import {
  buildQueueMetadataNote,
  getQueueUserNote,
  getTransactionQueueMetadata,
  normalizeQueueNumber,
  type QueueMetadata,
} from "@/lib/queue"
import { getCurrentUser, getTransactions, initializeSupabaseStore, logout, updateTransaction } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import type { CartItem, Transaction } from "@/lib/types"

type KitchenStage = "new" | "preparing" | "ready" | "completed"

type KitchenRecord = {
  transaction: Transaction
  queueNumberLabel: string
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
    columnClass: "border-[#b2967d]/35 bg-[#4a342a]",
    badgeClass: "border-[#b2967d]/45 bg-[#b2967d]/18 text-[#f5f1ea]",
    glowClass: "shadow-[0_0_0_1px_rgba(178,150,125,0.24),0_18px_50px_rgba(74,52,42,0.24)]",
    accentClass: "bg-[#b2967d]",
    emptyLabel: "No new orders waiting to be accepted.",
    iconClass: "bg-[#b2967d] text-[#f5f1ea]",
    viewAllClass: "text-[#d7c9b8]",
    cardRingClass: "border-[#b2967d] shadow-[0_0_0_1px_rgba(178,150,125,0.18),0_18px_34px_rgba(0,0,0,0.18)]",
  },
  preparing: {
    label: "Preparing",
    columnClass: "border-[#7d5a44]/35 bg-[#4a342a]",
    badgeClass: "border-[#7d5a44]/45 bg-[#7d5a44]/18 text-[#f5f1ea]",
    glowClass: "shadow-[0_0_0_1px_rgba(125,90,68,0.22),0_18px_50px_rgba(74,52,42,0.24)]",
    accentClass: "bg-[#7d5a44]",
    emptyLabel: "No orders are currently in preparation.",
    iconClass: "bg-[#7d5a44] text-[#f5f1ea]",
    viewAllClass: "text-[#d7c9b8]",
    cardRingClass: "border-[#7d5a44] shadow-[0_0_0_1px_rgba(125,90,68,0.18),0_18px_34px_rgba(0,0,0,0.18)]",
  },
  ready: {
    label: "Ready for Pickup",
    columnClass: "border-[#4a342a]/40 bg-[#4a342a]",
    badgeClass: "border-[#4a342a]/40 bg-[#d7c9b8]/70 text-[#4a342a]",
    glowClass: "shadow-[0_0_0_1px_rgba(74,52,42,0.22),0_18px_50px_rgba(74,52,42,0.24)]",
    accentClass: "bg-[#d7c9b8]",
    emptyLabel: "No completed prep waiting for pickup.",
    iconClass: "bg-[#d7c9b8] text-[#4a342a]",
    viewAllClass: "text-[#d7c9b8]",
    cardRingClass: "border-[#b2967d] shadow-[0_0_0_1px_rgba(178,150,125,0.16),0_18px_34px_rgba(0,0,0,0.18)]",
  },
  completed: {
    label: "Completed",
    columnClass: "border-[#d7c9b8]/25 bg-[#4a342a]",
    badgeClass: "border-[#d7c9b8]/25 bg-[#f5f1ea]/12 text-[#f5f1ea]",
    glowClass: "shadow-[0_0_0_1px_rgba(215,201,184,0.18),0_18px_50px_rgba(74,52,42,0.2)]",
    accentClass: "bg-[#f5f1ea]",
    emptyLabel: "No completed orders to review right now.",
    iconClass: "bg-[#f5f1ea] text-[#4a342a]",
    viewAllClass: "text-[#d7c9b8]",
    cardRingClass: "border-[#d7c9b8] shadow-[0_0_0_1px_rgba(215,201,184,0.16),0_18px_34px_rgba(0,0,0,0.18)]",
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
    queueNumberLabel: normalizeQueueNumber(transaction.queueNumber) || "----",
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
  onStageAction,
  processingAction,
}: {
  stage: KitchenStage
  records: KitchenRecord[]
  heldOrders: Set<string>
  selectedTransactionId: string | null
  onSelect: (transactionId: string) => void
  onStageAction: (record: KitchenRecord) => void
  processingAction: { transactionId: string; nextStatus: Transaction["orderStatus"] } | null
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
            const primaryActionLabel =
              stage === "new"
                ? "Start Preparing"
                : stage === "preparing"
                ? "Mark as Ready"
                : stage === "ready"
                ? "Complete Order"
                : null
            const nextStatus =
              stage === "new"
                ? "preparing"
                : stage === "preparing"
                ? "ready"
                : stage === "ready"
                ? "completed"
                : null
            const isProcessingPrimaryAction =
              Boolean(nextStatus) &&
              processingAction?.transactionId === record.transaction.id &&
              processingAction?.nextStatus === nextStatus

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
                      {record.queueNumberLabel}
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

                {primaryActionLabel ? (
                  <div className="mt-4 border-t border-slate-200 pt-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onStageAction(record)
                      }}
                      disabled={isProcessingPrimaryAction}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-white transition ${
                        stage === "new"
                          ? "bg-[#b2967d] hover:bg-[#9f846b]"
                          : stage === "preparing"
                          ? "bg-[#7d5a44] hover:bg-[#6a4b3a]"
                          : "bg-[#4a342a] hover:bg-[#7d5a44]"
                      } disabled:cursor-not-allowed disabled:opacity-70`}
                    >
                      {isProcessingPrimaryAction ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      <span>{primaryActionLabel}</span>
                    </button>
                  </div>
                ) : null}
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
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [clockNow, setClockNow] = useState(() => new Date())
  const [lastSyncAt, setLastSyncAt] = useState(() => new Date())
  const [isOnline, setIsOnline] = useState(true)
  const [heldOrderIds, setHeldOrderIds] = useState<string[]>([])
  const [controlMessage, setControlMessage] = useState("Realtime sync active with cashier POS and customer queue display.")
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false)
  const [processingAction, setProcessingAction] = useState<{ transactionId: string; nextStatus: Transaction["orderStatus"] } | null>(null)

  const currentUser = getCurrentUser()

  const handleLogout = useCallback(() => {
    logout()
    router.push("/")
  }, [router])

  const loadKitchenOrders = useCallback(async (options?: { showLoading?: boolean }) => {
    const shouldShowLoading = options?.showLoading ?? false

    if (shouldShowLoading) {
      setIsRefreshingOrders(true)
    }

    try {
      await initializeSupabaseStore()
      const nextTransactions = await getTransactions()
      const kitchenTransactions = nextTransactions.filter(shouldShowOnKitchenBoard)

      setTransactions(kitchenTransactions)
      setLastSyncAt(new Date())
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Refresh failed",
        description: error instanceof Error ? error.message : "The kitchen queue could not be refreshed.",
      })
    } finally {
      if (shouldShowLoading) {
        setIsRefreshingOrders(false)
      }
    }
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

  const applyTransactionLocally = useCallback(
    (transactionId: string, updates: Partial<Transaction>) => {
      setTransactions((currentTransactions) => {
        const nextTransactions = currentTransactions
          .map((transaction) =>
            transaction.id === transactionId
              ? ({
                  ...transaction,
                  ...updates,
                } satisfies Transaction)
              : transaction
          )
          .filter(shouldShowOnKitchenBoard)

        return nextTransactions
      })
    },
    []
  )

  const updateQueueStatus = useCallback(
    async (
      transaction: Transaction,
      nextStatus: Transaction["orderStatus"],
      successMessage: string,
      metadataPatch?: Partial<QueueMetadata>
    ) => {
      const queueMeta = getTransactionQueueMetadata(transaction)
      const nextQueueMeta: QueueMetadata = {
        ...queueMeta,
        ...metadataPatch,
        placedAt: queueMeta.placedAt || new Date().toISOString(),
      }

      const optimisticTransaction: Partial<Transaction> = {
        orderStatus: nextStatus,
        notes: buildQueueMetadataNote(nextQueueMeta, transaction.notes),
      }
      const previousTransaction = transaction

      setProcessingAction({ transactionId: transaction.id, nextStatus })
      applyTransactionLocally(transaction.id, optimisticTransaction)

      try {
        await updateTransaction(transaction.id, optimisticTransaction)
        setControlMessage(`Order ${normalizeQueueNumber(transaction.queueNumber) || "----"} moved to ${nextStatus}.`)
        setLastSyncAt(new Date())
        toast({
          title: "Order updated",
          description: successMessage,
        })
      } catch (error) {
        applyTransactionLocally(transaction.id, previousTransaction)
        setControlMessage(`Unable to update order ${normalizeQueueNumber(transaction.queueNumber) || "----"}.`)
        toast({
          variant: "destructive",
          title: "Update failed",
          description: error instanceof Error ? error.message : "The order status could not be updated.",
        })
      } finally {
        setProcessingAction((currentAction) =>
          currentAction?.transactionId === transaction.id && currentAction.nextStatus === nextStatus ? null : currentAction
        )
      }
    },
    [applyTransactionLocally]
  )

  const handleAdvanceStage = useCallback(
    async (record: KitchenRecord) => {
      if (record.stage === "new") {
        await updateQueueStatus(
          record.transaction,
          "preparing",
          `Order ${record.queueNumberLabel} is now Preparing.`,
          {
            assignedStaffName: currentUser?.username || record.queueMeta.assignedStaffName,
            assignedStaffRole: currentUser?.role || record.queueMeta.assignedStaffRole,
          }
        )
        return
      }

      if (record.stage === "preparing") {
        await updateQueueStatus(
          record.transaction,
          "ready",
          `Order ${record.queueNumberLabel} is now Ready to Serve.`,
          { readyAt: new Date().toISOString() }
        )
        return
      }

      if (record.stage === "ready") {
        await updateQueueStatus(
          record.transaction,
          "completed",
          `Order ${record.queueNumberLabel} has been completed.`,
          { completedAt: new Date().toISOString() }
        )
      }
    },
    [currentUser?.role, currentUser?.username, updateQueueStatus]
  )

  const handleAcceptOrder = useCallback(async () => {
    if (!selectedRecord) return

    await updateQueueStatus(selectedRecord.transaction, "preparing", `Order ${selectedRecord.queueNumberLabel} is now Preparing.`, {
      assignedStaffName: currentUser?.username || selectedRecord.queueMeta.assignedStaffName,
      assignedStaffRole: currentUser?.role || selectedRecord.queueMeta.assignedStaffRole,
    })
  }, [currentUser?.role, currentUser?.username, selectedRecord, updateQueueStatus])

  const handleMarkPreparing = useCallback(async () => {
    if (!selectedRecord) return

    await updateQueueStatus(selectedRecord.transaction, "preparing", `Order ${selectedRecord.queueNumberLabel} is now Preparing.`, {
      assignedStaffName: currentUser?.username || selectedRecord.queueMeta.assignedStaffName,
      assignedStaffRole: currentUser?.role || selectedRecord.queueMeta.assignedStaffRole,
    })
  }, [currentUser?.role, currentUser?.username, selectedRecord, updateQueueStatus])

  const handleMarkReady = useCallback(async () => {
    if (!selectedRecord) return
    await updateQueueStatus(selectedRecord.transaction, "ready", `Order ${selectedRecord.queueNumberLabel} is now Ready to Serve.`, { readyAt: new Date().toISOString() })
  }, [selectedRecord, updateQueueStatus])

  const handleCompleteOrder = useCallback(async () => {
    if (!selectedRecord) return
    await updateQueueStatus(selectedRecord.transaction, "completed", `Order ${selectedRecord.queueNumberLabel} has been completed.`, { completedAt: new Date().toISOString() })
  }, [selectedRecord, updateQueueStatus])

  const handleCancelOrder = useCallback(async () => {
    if (!selectedRecord) return
    const nextNotes = buildQueueMetadataNote(
      {
        ...selectedRecord.queueMeta,
        cancelledAt: new Date().toISOString(),
        placedAt: selectedRecord.queueMeta.placedAt || selectedRecord.placedAt.toISOString(),
      },
      selectedRecord.transaction.notes
    )
    const previousTransaction = selectedRecord.transaction

    setProcessingAction({ transactionId: selectedRecord.transaction.id, nextStatus: "cancelled" })
    applyTransactionLocally(selectedRecord.transaction.id, {
      orderStatus: "cancelled",
      notes: nextNotes,
    })

    try {
      await updateTransaction(selectedRecord.transaction.id, {
        orderStatus: "cancelled",
        notes: nextNotes,
      })
      setControlMessage(`Order ${selectedRecord.queueNumberLabel} was cancelled.`)
      setLastSyncAt(new Date())
      toast({
        title: "Order cancelled",
        description: `Order ${selectedRecord.queueNumberLabel} was removed from the active queue.`,
      })
    } catch (error) {
      applyTransactionLocally(selectedRecord.transaction.id, previousTransaction)
      toast({
        variant: "destructive",
        title: "Cancellation failed",
        description: error instanceof Error ? error.message : "The order could not be cancelled.",
      })
    } finally {
      setProcessingAction((currentAction) =>
        currentAction?.transactionId === selectedRecord.transaction.id && currentAction.nextStatus === "cancelled" ? null : currentAction
      )
    }
  }, [applyTransactionLocally, selectedRecord])

  const handleCallNextQueue = useCallback(() => {
    const nextRecord = recordsByStage.new[0] || recordsByStage.preparing[0] || recordsByStage.ready[0]
    if (!nextRecord) {
      setControlMessage("No active queue available to call right now.")
      return
    }

    setSelectedTransactionId(nextRecord.transaction.id)
    setControlMessage(`Calling queue ${nextRecord.queueNumberLabel}.`)
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

    setControlMessage(`Order ${selectedRecord.queueNumberLabel} bumped to the top.`)
    await loadKitchenOrders()
  }, [kitchenRecords, loadKitchenOrders, selectedRecord])

  const handleHoldOrder = useCallback(() => {
    if (!selectedRecord) return

    const nextSet = new Set(heldOrderIds)
    if (nextSet.has(selectedRecord.transaction.id)) {
      nextSet.delete(selectedRecord.transaction.id)
      setControlMessage(`Order ${selectedRecord.queueNumberLabel} removed from hold.`)
    } else {
      nextSet.add(selectedRecord.transaction.id)
      setControlMessage(`Order ${selectedRecord.queueNumberLabel} put on hold.`)
    }

    setHeldOrderIds(Array.from(nextSet))
  }, [heldOrderIds, selectedRecord])

  const handleViewAllOrders = useCallback(() => {
    setControlMessage("All kitchen stages are visible. Scroll horizontally or vertically to review every live order.")
  }, [])

  const selectedStatusLabel = selectedRecord ? getCardStatusLabel(selectedRecord.stage) : "No Status"

  return (
    <div className="min-h-screen bg-[#4a342a] text-white">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(178,150,125,0.22),transparent_24%),radial-gradient(circle_at_top_right,rgba(215,201,184,0.12),transparent_22%),linear-gradient(180deg,#4a342a_0%,#5a4134_45%,#4a342a_100%)]">
        <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col px-4 py-4">
          <header className="rounded-[22px] border border-[#d7c9b8]/20 bg-[linear-gradient(180deg,rgba(74,52,42,0.98),rgba(93,68,55,0.94))] px-4 py-3 shadow-[0_18px_48px_rgba(74,52,42,0.32)]">
            <div className="grid gap-3 xl:grid-cols-[auto_1fr_auto] xl:items-center">
              <div className="flex items-center gap-4 border-[#d7c9b8]/15 xl:border-r xl:pr-6">
                <div className="rounded-[16px] border border-[#d7c9b8]/18 bg-[#f5f1ea]/8 p-3">
                  <Image src="/alfresco-logo.png" alt="Al Fresco Cafe" width={140} height={44} className="h-10 w-auto object-contain" priority />
                </div>
                <div>
                  <h1 className="text-[2rem] font-black leading-none tracking-[-0.05em] text-white">KITCHEN QUEUE</h1>
                  <p className="mt-1 text-lg text-[#f0e6db]">Work with speed. Serve with pride.</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[16px] border border-[#d7c9b8]/18 bg-[#f5f1ea]/8 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="h-8 w-8 rounded-xl bg-[#f5f1ea]/10 p-1.5 text-[#f5f1ea]" />
                    <div>
                      <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#d7c9b8]">Total Orders</p>
                      <p className="mt-1 text-[2rem] font-black leading-none text-white">{totalOrders}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[16px] border border-[#d7c9b8]/18 bg-[#f5f1ea]/8 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ChefHat className="h-8 w-8 rounded-xl bg-[#7d5a44]/28 p-1.5 text-[#f5f1ea]" />
                    <div>
                      <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#d7c9b8]">Preparing</p>
                      <p className="mt-1 text-[2rem] font-black leading-none text-white">{recordsByStage.preparing.length}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[16px] border border-[#d7c9b8]/18 bg-[#f5f1ea]/8 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <PackageCheck className="h-8 w-8 rounded-xl bg-[#d7c9b8]/22 p-1.5 text-[#4a342a]" />
                    <div>
                      <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#d7c9b8]">Ready</p>
                      <p className="mt-1 text-[2rem] font-black leading-none text-white">{recordsByStage.ready.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row xl:justify-end">
                <Button
                  type="button"
                  onClick={() => void loadKitchenOrders({ showLoading: true })}
                  disabled={isRefreshingOrders}
                  className="h-[4.5rem] rounded-[16px] border border-[#d7c9b8]/18 bg-[#f5f1ea]/8 px-4 text-base font-bold text-white hover:bg-[#f5f1ea]/12 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isRefreshingOrders ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh Queue
                </Button>
                <div className="flex items-center gap-3 rounded-[16px] border border-[#d7c9b8]/18 bg-[#f5f1ea]/8 px-4 py-3">
                  <Clock3 className="h-7 w-7 text-white" />
                  <div>
                    <p className="text-[1.9rem] font-black leading-none tracking-[-0.04em] text-white">{formatClock(clockNow)}</p>
                    <p className="mt-1 text-sm text-[#f0e6db]">{formatCalendar(clockNow)}</p>
                  </div>
                </div>
                <div className="flex h-[4.5rem] items-center justify-center rounded-[16px] border border-[#d7c9b8]/18 bg-[#f5f1ea]/8 px-4">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f1ea]/10">
                    <Bell className="h-5 w-5 text-white" />
                    <span className="absolute right-0 top-0 flex h-5 min-w-5 -translate-y-1/3 translate-x-1/3 items-center justify-center rounded-full bg-[#e11d48] px-1 text-[10px] font-bold text-white">
                      {notificationCount}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleLogout}
                  className="h-[4.5rem] rounded-[16px] border border-[#d9b2a7]/22 bg-[#8c5a4c]/22 px-4 text-base font-bold text-[#f8e6de] hover:bg-[#9a6758]/28"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </header>

          <main className="mt-4 grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <LiveQueueBoard
                transactions={transactions}
                loading={isRefreshingOrders && transactions.length === 0}
                onRefresh={() => void loadKitchenOrders({ showLoading: true })}
                refreshDisabled={isRefreshingOrders}
                embedded
              />

              <section className="min-h-0 rounded-[22px] border border-[#d7c9b8]/16 bg-[#f5f1ea]/6 p-3 shadow-[0_20px_60px_rgba(74,52,42,0.28)]">
                <div className="grid min-h-[42rem] gap-3 xl:grid-cols-4">
                <StageColumn
                  stage="new"
                  records={recordsByStage.new}
                  heldOrders={heldOrders}
                  selectedTransactionId={selectedTransactionId}
                  onSelect={setSelectedTransactionId}
                  onStageAction={(record) => void handleAdvanceStage(record)}
                  processingAction={processingAction}
                />
                <StageColumn
                  stage="preparing"
                  records={recordsByStage.preparing}
                  heldOrders={heldOrders}
                  selectedTransactionId={selectedTransactionId}
                  onSelect={setSelectedTransactionId}
                  onStageAction={(record) => void handleAdvanceStage(record)}
                  processingAction={processingAction}
                />
                <StageColumn
                  stage="ready"
                  records={recordsByStage.ready}
                  heldOrders={heldOrders}
                  selectedTransactionId={selectedTransactionId}
                  onSelect={setSelectedTransactionId}
                  onStageAction={(record) => void handleAdvanceStage(record)}
                  processingAction={processingAction}
                />
                <StageColumn
                  stage="completed"
                  records={recordsByStage.completed}
                  heldOrders={heldOrders}
                  selectedTransactionId={selectedTransactionId}
                  onSelect={setSelectedTransactionId}
                  onStageAction={(record) => void handleAdvanceStage(record)}
                  processingAction={processingAction}
                />
                </div>
              </section>

              <section className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-[18px] border border-[#d7c9b8]/16 bg-[#5a4134] px-4 py-4 text-[#f5f1ea] shadow-[0_16px_40px_rgba(74,52,42,0.26)]">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-[#d7c9b8]" />
                    <p className="text-lg"><span className="font-extrabold uppercase">Tip:</span> Focus on preparing one order at a time for better quality.</p>
                  </div>
                </div>
                <div className="rounded-[18px] border border-[#d7c9b8]/16 bg-[#5a4134] px-4 py-4 text-[#f5f1ea] shadow-[0_16px_40px_rgba(74,52,42,0.26)]">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-[#d7c9b8]" />
                    <p className="text-lg"><span className="font-extrabold uppercase">Today's Promo:</span> Buy 1 Get 1 on all iced beverages.</p>
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[20px] border border-[#d7c9b8]/18 bg-[linear-gradient(180deg,rgba(74,52,42,0.98),rgba(93,68,55,0.96))] p-4 shadow-[0_20px_55px_rgba(74,52,42,0.34)]">
                <div className="flex items-center justify-between gap-3 border-b border-[#d7c9b8]/15 pb-4">
                  <p className="text-[1.05rem] font-extrabold uppercase tracking-[-0.02em] text-white">Order Details</p>
                  <button type="button" className="text-[#d7c9b8]">
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>

                {selectedRecord ? (
                  <>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-[2.35rem] font-black tracking-[-0.08em] text-[#f5f1ea]">
                        {selectedRecord.queueNumberLabel}
                      </p>
                      <span className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase ${selectedRecord.stage === "preparing" ? "border-[#d7c9b8]/35 bg-[#d7c9b8]/16 text-[#f5f1ea]" : STAGE_STYLES[selectedRecord.stage].badgeClass}`}>
                        {selectedStatusLabel}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-[1rem] text-[#f0e6db]">
                      <span>{selectedRecord.orderTypeLabel}</span>
                      <span>{formatShortTime(selectedRecord.placedAt)} ({formatWaitLabel(selectedRecord.waitMinutes)})</span>
                    </div>

                    <div className="mt-4 border-t border-[#d7c9b8]/15 pt-4">
                      <ul className="space-y-4">
                        {selectedRecord.transaction.items.map((item, index) => (
                          <li key={`${selectedRecord.transaction.id}-detail-${index}`} className="flex gap-3 text-[#f5f1ea]">
                            <span className="min-w-6 text-lg font-medium">{item.quantity}</span>
                            <div className="min-w-0">
                              <p className="text-[1.05rem] font-semibold text-white">{item.product.name}</p>
                              {getItemDescriptor(item) ? (
                                <p className="mt-1 text-sm leading-6 text-[#d7c9b8]">{getItemDescriptor(item)}</p>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4 border-t border-[#d7c9b8]/15 pt-4">
                      <p className="text-sm text-[#f5f1ea]">Note: {selectedRecord.userNote || "No special instructions."}</p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <Button
                        onClick={selectedRecord.stage === "preparing" ? handleMarkReady : handleAcceptOrder}
                        disabled={
                          (selectedRecord.stage !== "new" && selectedRecord.stage !== "preparing") ||
                          Boolean(processingAction)
                        }
                        className={`h-12 rounded-xl text-base font-bold text-white ${selectedRecord.stage === "preparing" ? "bg-[#7d5a44] hover:bg-[#6a4b3a]" : "bg-[#b2967d] hover:bg-[#9f846b]"}`}
                      >
                        {processingAction?.transactionId === selectedRecord.transaction.id &&
                        (processingAction.nextStatus === "preparing" || processingAction.nextStatus === "ready") ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {selectedRecord.stage === "preparing" ? "Mark as Ready" : "Start Preparing"}
                      </Button>
                      <Button
                        onClick={handleCancelOrder}
                        disabled={selectedRecord.stage === "completed" || Boolean(processingAction)}
                        className="h-12 rounded-xl bg-[#dc2626] text-base font-bold text-white hover:bg-[#b91c1c]"
                      >
                        {processingAction?.transactionId === selectedRecord.transaction.id && processingAction.nextStatus === "cancelled" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Cancel Order
                      </Button>
                    </div>

                    <div className="mt-3 grid gap-3">
                      <Button
                        onClick={handleMarkPreparing}
                        disabled={selectedRecord.stage !== "new" || Boolean(processingAction)}
                        className="h-11 rounded-xl bg-[#d7c9b8] text-base font-bold text-[#4a342a] hover:bg-[#cab8a3]"
                      >
                        {processingAction?.transactionId === selectedRecord.transaction.id && processingAction.nextStatus === "preparing" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Mark Preparing
                      </Button>
                      <Button
                        onClick={handleCompleteOrder}
                        disabled={selectedRecord.stage !== "ready" || Boolean(processingAction)}
                        className="h-11 rounded-xl bg-[#4a342a] text-base font-bold text-white hover:bg-[#7d5a44]"
                      >
                        {processingAction?.transactionId === selectedRecord.transaction.id && processingAction.nextStatus === "completed" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Complete Order
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="mt-6 rounded-[18px] border border-dashed border-[#d7c9b8]/18 bg-[#f5f1ea]/6 p-6 text-center text-sm text-[#f0e6db]">
                    Waiting for the first kitchen order to arrive from POS.
                  </div>
                )}
              </section>

              <section className="rounded-[20px] border border-[#d7c9b8]/18 bg-[linear-gradient(180deg,rgba(74,52,42,0.98),rgba(93,68,55,0.96))] p-4 shadow-[0_20px_55px_rgba(74,52,42,0.34)]">
                <div className="flex items-center gap-3">
                  <UtensilsCrossed className="h-5 w-5 text-[#d7c9b8]" />
                  <h3 className="text-[1.05rem] font-extrabold uppercase tracking-[-0.02em] text-white">Kitchen Controls</h3>
                </div>

                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={handleCallNextQueue}
                    className="flex min-h-16 items-center gap-4 rounded-[16px] border border-[#d7c9b8]/16 bg-[#f5f1ea]/7 px-4 py-3 text-left transition-colors hover:bg-[#f5f1ea]/12"
                  >
                    <Megaphone className="h-5 w-5 text-white" />
                    <div>
                      <p className="font-semibold text-white">Call Next Queue</p>
                      <p className="text-sm text-[#d7c9b8]">Call the next order number.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleBumpOrder}
                    className="flex min-h-16 items-center gap-4 rounded-[16px] border border-[#d7c9b8]/16 bg-[#f5f1ea]/7 px-4 py-3 text-left transition-colors hover:bg-[#f5f1ea]/12"
                  >
                    <RefreshCw className="h-5 w-5 text-white" />
                    <div>
                      <p className="font-semibold text-white">Bump Order</p>
                      <p className="text-sm text-[#d7c9b8]">Move order to top.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleHoldOrder}
                    className="flex min-h-16 items-center gap-4 rounded-[16px] border border-[#d7c9b8]/16 bg-[#f5f1ea]/7 px-4 py-3 text-left transition-colors hover:bg-[#f5f1ea]/12"
                  >
                    <PauseCircle className="h-5 w-5 text-white" />
                    <div>
                      <p className="font-semibold text-white">Hold Order</p>
                      <p className="text-sm text-[#d7c9b8]">Temporarily hold order.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleViewAllOrders}
                    className="flex min-h-16 items-center gap-4 rounded-[16px] border border-[#d7c9b8]/16 bg-[#f5f1ea]/7 px-4 py-3 text-left transition-colors hover:bg-[#f5f1ea]/12"
                  >
                    <ListOrdered className="h-5 w-5 text-white" />
                    <div>
                      <p className="font-semibold text-white">View All Orders</p>
                      <p className="text-sm text-[#d7c9b8]">See all orders list.</p>
                    </div>
                  </button>
                </div>
              </section>

              <section className="rounded-[20px] border border-[#d7c9b8]/18 bg-[linear-gradient(180deg,rgba(74,52,42,0.98),rgba(93,68,55,0.96))] p-4 shadow-[0_20px_55px_rgba(74,52,42,0.34)]">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[1.05rem] font-extrabold uppercase tracking-[-0.02em] text-white">Kitchen Status</h3>
                  <div className={`inline-flex items-center gap-2 text-sm font-semibold ${isOnline ? "text-[#d7c9b8]" : "text-[#f0e6db]"}`}>
                    <Dot className="h-5 w-5" />
                    {isOnline ? "Online" : "Offline"}
                  </div>
                </div>

                <div className="mt-4 border-t border-[#d7c9b8]/15 pt-4">
                  <div className="mb-3 h-1.5 w-24 rounded-full bg-[#b2967d]" />
                  <p className="text-[1rem] text-[#f0e6db]">Last sync: {formatClock(lastSyncAt)}</p>
                  <div className="mt-4 flex items-start gap-3 text-sm text-[#d7c9b8]">
                    {isOnline ? <Wifi className="mt-0.5 h-4 w-4 text-[#d7c9b8]" /> : <WifiOff className="mt-0.5 h-4 w-4 text-[#f0e6db]" />}
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
    <AuthGuard requiredRoles={["admin", "kitchen"]}>
      <KitchenDashboardContent />
    </AuthGuard>
  )
}
