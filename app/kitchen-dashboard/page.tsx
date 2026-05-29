"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
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
  isTransactionInQueueDate,
  getTransactionQueueMetadata,
  normalizeQueueNumber,
  type QueueMetadata,
} from "@/lib/queue"
import { getCurrentUser, getDefaultRouteForRole, getTransactions, initializeSupabaseStore, logout, subscribeToTransactionSync, updateTransaction } from "@/lib/store"
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
    columnClass: "border-[#d8c6b4] bg-[linear-gradient(180deg,#fbf7f2_0%,#f4ebe1_100%)]",
    badgeClass: "border-[#caa98a] bg-[#f6ede3] text-[#7a5a47]",
    glowClass: "shadow-[0_0_0_1px_rgba(202,169,138,0.28),0_22px_44px_rgba(109,84,66,0.12)]",
    accentClass: "bg-[#b78a68]",
    emptyLabel: "No new orders waiting to be accepted.",
    iconClass: "bg-[#efe0d2] text-[#7a5a47]",
    viewAllClass: "text-[#8d6f5b]",
    cardRingClass: "border-[#dec7b0] shadow-[0_10px_28px_rgba(109,84,66,0.08)]",
  },
  preparing: {
    label: "Preparing",
    columnClass: "border-[#d7c9b8] bg-[linear-gradient(180deg,#fcf8f3_0%,#f2e7db_100%)]",
    badgeClass: "border-[#c79d7f] bg-[#f4e7da] text-[#7d5a44]",
    glowClass: "shadow-[0_0_0_1px_rgba(173,130,100,0.24),0_22px_44px_rgba(109,84,66,0.12)]",
    accentClass: "bg-[#a97757]",
    emptyLabel: "No orders are currently in preparation.",
    iconClass: "bg-[#ead8c7] text-[#7d5a44]",
    viewAllClass: "text-[#8d6f5b]",
    cardRingClass: "border-[#d8c0ab] shadow-[0_10px_28px_rgba(109,84,66,0.08)]",
  },
  ready: {
    label: "Ready for Pickup",
    columnClass: "border-[#d9cab9] bg-[linear-gradient(180deg,#fffaf4_0%,#f3e9de_100%)]",
    badgeClass: "border-[#c9b095] bg-[#fbf2e8] text-[#64483a]",
    glowClass: "shadow-[0_0_0_1px_rgba(188,159,130,0.24),0_22px_44px_rgba(109,84,66,0.12)]",
    accentClass: "bg-[#dcc0a5]",
    emptyLabel: "No completed prep waiting for pickup.",
    iconClass: "bg-[#f2e3d4] text-[#64483a]",
    viewAllClass: "text-[#8d6f5b]",
    cardRingClass: "border-[#dfc7ae] shadow-[0_10px_28px_rgba(109,84,66,0.08)]",
  },
  completed: {
    label: "Completed",
    columnClass: "border-[#ded4c8] bg-[linear-gradient(180deg,#ffffff_0%,#f5eee6_100%)]",
    badgeClass: "border-[#d4c3b2] bg-[#f7f1ea] text-[#6b5141]",
    glowClass: "shadow-[0_0_0_1px_rgba(212,195,178,0.22),0_22px_44px_rgba(109,84,66,0.1)]",
    accentClass: "bg-[#efe1d4]",
    emptyLabel: "No completed orders to review right now.",
    iconClass: "bg-[#f4ebe3] text-[#6b5141]",
    viewAllClass: "text-[#8d6f5b]",
    cardRingClass: "border-[#e1d0bf] shadow-[0_10px_28px_rgba(109,84,66,0.08)]",
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
  if (status === "ready" || status === "ready_for_pickup") return "ready"
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
  return (
    !transaction.voided &&
    transaction.orderStatus !== "voided" &&
    transaction.orderStatus !== "cancelled" &&
    isTransactionInQueueDate(transaction)
  )
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
    <section className={`flex h-full min-h-[26rem] flex-col overflow-hidden rounded-[24px] border ${style.columnClass}`}>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#dccdbf] bg-[rgba(255,250,245,0.94)] px-5 py-5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${style.iconClass}`}>
            <StageIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[1.02rem] font-extrabold uppercase tracking-[0.02em] text-[#5a4134]">{style.label}</h2>
          </div>
        </div>
        <span className={`min-w-10 rounded-xl px-3 py-1.5 text-center text-sm font-bold ${style.badgeClass}`}>
          {records.length}
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {records.length === 0 ? (
          <div className="flex min-h-[16rem] items-center justify-center rounded-[20px] border border-dashed border-[#dbcbbc] bg-[#fffdf9] px-6 text-center text-sm text-[#8b7568]">
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
                className={`w-full rounded-[18px] border bg-[linear-gradient(180deg,#fffdf9_0%,#f7efe7_100%)] p-4 text-left text-[#3d2a1f] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(109,84,66,0.12)] ${
                  isSelected
                    ? `${style.glowClass} ${style.cardRingClass}`
                    : `${style.cardRingClass} opacity-95`
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[2rem] font-black leading-none tracking-[-0.08em] text-[#4a342a]">
                      {record.queueNumberLabel}
                    </p>
                    <p className="mt-2 text-[0.98rem] text-[#866754]">{record.orderTypeLabel}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#5a4134]">{formatShortTime(record.placedAt)}</p>
                  </div>
                </div>

                <ul className="mt-4 space-y-2.5 text-[0.96rem] text-[#6f5c50]">
                  {record.transaction.items.slice(0, 3).map((item, index) => (
                    <li key={`${record.transaction.id}-${index}`} className="flex gap-3">
                      <span className="min-w-5 text-sm font-medium text-[#9b8575]">{item.quantity}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-[#3d2a1f]">{item.product.name}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-[#8b7568]">
                    <Clock3 className="h-3.5 w-3.5 text-[#a48066]" />
                    <span>{formatWaitLabel(record.waitMinutes)}</span>
                  </div>
                  <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.04em] ${isHeld ? "border-rose-200 bg-rose-50 text-rose-700" : style.badgeClass}`}>
                    {cardStatusLabel}
                  </span>
                </div>

                {primaryActionLabel ? (
                  <div className="mt-4 border-t border-[#ebdfd2] pt-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onStageAction(record)
                      }}
                      disabled={isProcessingPrimaryAction}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold text-white transition ${
                        stage === "new"
                          ? "bg-[#b78a68] hover:bg-[#a97757]"
                          : stage === "preparing"
                          ? "bg-[#8f664f] hover:bg-[#7d5a44]"
                          : "bg-[#6d4f40] hover:bg-[#7d5a44]"
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

      <div className="border-t border-[#dccdbf] bg-[rgba(255,250,245,0.92)] px-5 py-4 text-center">
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
  const isAdminUser = currentUser?.role === "admin"

  const handleLogout = useCallback(() => {
    logout()
    router.push("/")
  }, [router])

  const handlePrimaryNavigation = useCallback(() => {
    if (isAdminUser) {
      router.push(getDefaultRouteForRole("admin"))
      return
    }

    handleLogout()
  }, [handleLogout, isAdminUser, router])

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
    const unsubscribeTransactionSync = subscribeToTransactionSync(() => {
      setControlMessage("Realtime order sync received. Kitchen board updated.")
      void loadKitchenOrders()
    })

    return () => {
      unsubscribeTransactionSync()
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

      if (nextStatus === "preparing" && !nextQueueMeta.preparingStartedAt) {
        nextQueueMeta.preparingStartedAt = new Date().toISOString()
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
          `Order ${record.queueNumberLabel} is now Ready for Pickup.`,
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
    await updateQueueStatus(selectedRecord.transaction, "ready", `Order ${selectedRecord.queueNumberLabel} is now Ready for Pickup.`, { readyAt: new Date().toISOString() })
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
    <div className="min-h-screen bg-[#f7f1e8] text-[#4a342a]">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(223,205,190,0.55),transparent_24%),radial-gradient(circle_at_top_right,rgba(239,225,212,0.72),transparent_22%),linear-gradient(180deg,#f7f1e8_0%,#efe3d8_46%,#f6eee5_100%)]">
        <div className="mx-auto flex min-h-screen max-w-[1920px] flex-col px-4 py-4 lg:px-5 lg:py-5">
          <header className="rounded-[28px] border border-[#ddcfc1] bg-[linear-gradient(180deg,rgba(255,252,247,0.96),rgba(243,232,220,0.94))] px-5 py-4 shadow-[0_20px_42px_rgba(109,84,66,0.1)]">
            <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.45fr)_minmax(360px,0.95fr)] xl:items-center">
              <div className="flex items-center gap-4 xl:border-r xl:border-[#e4d8cc] xl:pr-6">
                <div className="rounded-[18px] border border-[#dfd1c4] bg-white/90 p-3 shadow-[0_12px_28px_rgba(109,84,66,0.08)]">
                  <Image src="/alfresco-logo.png" alt="Al Fresco Cafe" width={140} height={44} className="h-10 w-auto object-contain" priority />
                </div>
                <div>
                  <h1 className="text-[2rem] font-black leading-none tracking-[-0.05em] text-[#4a342a]">KITCHEN QUEUE</h1>
                  <p className="mt-1 text-base text-[#7d5a44]">Work with speed. Serve with pride.</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] border border-[#e2d7cc] bg-white/82 px-4 py-3.5 shadow-[0_14px_26px_rgba(109,84,66,0.07)]">
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="h-8 w-8 rounded-xl bg-[#f1e2d4] p-1.5 text-[#7d5a44]" />
                    <div>
                      <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#8d6f5b]">Total Orders</p>
                      <p className="mt-1 text-[2.2rem] font-black leading-none text-[#4a342a]">{totalOrders}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[20px] border border-[#e2d7cc] bg-white/82 px-4 py-3.5 shadow-[0_14px_26px_rgba(109,84,66,0.07)]">
                  <div className="flex items-center gap-3">
                    <ChefHat className="h-8 w-8 rounded-xl bg-[#ead8c7] p-1.5 text-[#7d5a44]" />
                    <div>
                      <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#8d6f5b]">Preparing</p>
                      <p className="mt-1 text-[2.2rem] font-black leading-none text-[#4a342a]">{recordsByStage.preparing.length}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[20px] border border-[#e2d7cc] bg-white/82 px-4 py-3.5 shadow-[0_14px_26px_rgba(109,84,66,0.07)]">
                  <div className="flex items-center gap-3">
                    <PackageCheck className="h-8 w-8 rounded-xl bg-[#f1e2d4] p-1.5 text-[#6d4f40]" />
                    <div>
                      <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#8d6f5b]">Ready</p>
                      <p className="mt-1 text-[2.2rem] font-black leading-none text-[#4a342a]">{recordsByStage.ready.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_88px]">
                <Button
                  type="button"
                  onClick={() => void loadKitchenOrders({ showLoading: true })}
                  disabled={isRefreshingOrders}
                  className="h-[4.4rem] justify-center rounded-[18px] border border-[#e0d5ca] bg-white/82 px-4 text-base font-bold text-[#4a342a] shadow-[0_14px_30px_rgba(109,84,66,0.08)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isRefreshingOrders ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh Queue
                </Button>
                <div className="flex items-center gap-3 rounded-[18px] border border-[#e0d5ca] bg-white/82 px-4 py-3 shadow-[0_14px_30px_rgba(109,84,66,0.08)] sm:col-span-2 2xl:col-span-1">
                  <Clock3 className="h-7 w-7 text-[#7d5a44]" />
                  <div>
                    <p className="text-[1.8rem] font-black leading-none tracking-[-0.04em] text-[#4a342a]">{formatClock(clockNow)}</p>
                    <p className="mt-0.5 text-sm text-[#8b7568]">{formatCalendar(clockNow)}</p>
                  </div>
                </div>
                <div className="flex h-[4.4rem] items-center justify-center rounded-[18px] border border-[#e0d5ca] bg-white/82 px-4 shadow-[0_14px_30px_rgba(109,84,66,0.08)]">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4e8dc]">
                    <Bell className="h-5 w-5 text-[#7d5a44]" />
                    <span className="absolute right-0 top-0 flex h-5 min-w-5 -translate-y-1/3 translate-x-1/3 items-center justify-center rounded-full bg-[#e11d48] px-1 text-[10px] font-bold text-white">
                      {notificationCount}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handlePrimaryNavigation}
                  className="h-[4.4rem] justify-center rounded-[18px] border border-[#d8c3b4] bg-[#f3e3d6] px-4 text-base font-bold text-[#7d5a44] shadow-[0_14px_30px_rgba(109,84,66,0.08)] hover:bg-[#efdccd]"
                >
                  {isAdminUser ? <ArrowLeft className="mr-2 h-4 w-4" /> : <LogOut className="mr-2 h-4 w-4" />}
                  {isAdminUser ? "Return to Dashboard" : "Logout"}
                </Button>
              </div>
            </div>
          </header>

          <main className="mt-4 grid flex-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_320px] 2xl:grid-cols-[minmax(0,1.5fr)_360px]">
            <div className="space-y-5">
              <LiveQueueBoard
                transactions={transactions}
                loading={isRefreshingOrders && transactions.length === 0}
                onRefresh={() => void loadKitchenOrders({ showLoading: true })}
                refreshDisabled={isRefreshingOrders}
                embedded
              />

              <section className="min-h-0 rounded-[26px] border border-[#ddd2c6] bg-[rgba(255,250,245,0.92)] p-4 shadow-[0_22px_46px_rgba(109,84,66,0.1)] lg:p-5">
                <div className="grid min-h-[48rem] auto-rows-fr items-stretch gap-4 xl:grid-cols-3 2xl:grid-cols-4">
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

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[20px] border border-[#ded2c7] bg-white/82 px-5 py-4 text-[#5a4134] shadow-[0_16px_30px_rgba(109,84,66,0.08)]">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-[#b78a68]" />
                    <p className="text-lg"><span className="font-extrabold uppercase">Tip:</span> Focus on preparing one order at a time for better quality.</p>
                  </div>
                </div>
                <div className="rounded-[20px] border border-[#ded2c7] bg-white/82 px-5 py-4 text-[#5a4134] shadow-[0_16px_30px_rgba(109,84,66,0.08)]">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-[#b78a68]" />
                    <p className="text-lg"><span className="font-extrabold uppercase">Today's Promo:</span> Buy 1 Get 1 on all iced beverages.</p>
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-[24px] border border-[#ddd1c5] bg-[linear-gradient(180deg,rgba(255,252,247,0.96),rgba(243,233,223,0.94))] p-5 shadow-[0_20px_42px_rgba(109,84,66,0.1)]">
                <div className="flex items-center justify-between gap-3 border-b border-[#e4d7cb] pb-4">
                  <p className="text-[1.02rem] font-extrabold uppercase tracking-[0.03em] text-[#4a342a]">Order Details</p>
                  <button type="button" className="text-[#8d6f5b]">
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>

                {selectedRecord ? (
                  <>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-[2.35rem] font-black tracking-[-0.08em] text-[#4a342a]">
                        {selectedRecord.queueNumberLabel}
                      </p>
                      <span className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase ${selectedRecord.stage === "preparing" ? "border-[#c79d7f] bg-[#f4e7da] text-[#7d5a44]" : STAGE_STYLES[selectedRecord.stage].badgeClass}`}>
                        {selectedStatusLabel}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 text-[0.98rem] text-[#7d5a44]">
                      <span>{selectedRecord.orderTypeLabel}</span>
                      <span>{formatShortTime(selectedRecord.placedAt)} ({formatWaitLabel(selectedRecord.waitMinutes)})</span>
                    </div>

                    <div className="mt-4 border-t border-[#e5d9cf] pt-4">
                      <ul className="space-y-4">
                        {selectedRecord.transaction.items.map((item, index) => (
                          <li key={`${selectedRecord.transaction.id}-detail-${index}`} className="flex gap-3 text-[#5a4134]">
                            <span className="min-w-6 text-lg font-medium text-[#8d6f5b]">{item.quantity}</span>
                            <div className="min-w-0">
                              <p className="text-[1.05rem] font-semibold text-[#4a342a]">{item.product.name}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {selectedRecord.userNote ? (
                      <div className="mt-4 border-t border-[#e5d9cf] pt-4">
                        <p className="text-sm text-[#6f5c50]">{selectedRecord.userNote}</p>
                      </div>
                    ) : null}

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <Button
                        onClick={selectedRecord.stage === "preparing" ? handleMarkReady : handleAcceptOrder}
                        disabled={
                          (selectedRecord.stage !== "new" && selectedRecord.stage !== "preparing") ||
                          Boolean(processingAction)
                        }
                        className={`h-12 rounded-xl text-base font-bold text-white ${selectedRecord.stage === "preparing" ? "bg-[#8f664f] hover:bg-[#7d5a44]" : "bg-[#b78a68] hover:bg-[#a97757]"}`}
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
                        className="h-12 rounded-xl bg-[#d85f5f] text-base font-bold text-white hover:bg-[#c54b4b]"
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
                        className="h-11 rounded-xl bg-[#ecdccd] text-base font-bold text-[#6d4f40] hover:bg-[#e2cfbf]"
                      >
                        {processingAction?.transactionId === selectedRecord.transaction.id && processingAction.nextStatus === "preparing" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Mark Preparing
                      </Button>
                      <Button
                        onClick={handleCompleteOrder}
                        disabled={selectedRecord.stage !== "ready" || Boolean(processingAction)}
                        className="h-11 rounded-xl bg-[#6d4f40] text-base font-bold text-white hover:bg-[#7d5a44]"
                      >
                        {processingAction?.transactionId === selectedRecord.transaction.id && processingAction.nextStatus === "completed" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Complete Order
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="mt-6 rounded-[18px] border border-dashed border-[#ded1c4] bg-white/70 p-6 text-center text-sm text-[#8b7568]">
                    Waiting for the first kitchen order to arrive from POS.
                  </div>
                )}
              </section>

              <section className="rounded-[24px] border border-[#ddd1c5] bg-[linear-gradient(180deg,rgba(255,252,247,0.96),rgba(243,233,223,0.94))] p-5 shadow-[0_20px_42px_rgba(109,84,66,0.1)]">
                <div className="flex items-center gap-3">
                  <UtensilsCrossed className="h-5 w-5 text-[#b78a68]" />
                  <h3 className="text-[1.05rem] font-extrabold uppercase tracking-[-0.02em] text-[#4a342a]">Kitchen Controls</h3>
                </div>

                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={handleCallNextQueue}
                    className="flex min-h-16 items-center gap-4 rounded-[18px] border border-[#e1d5c9] bg-white/78 px-4 py-3 text-left transition-colors hover:bg-white"
                  >
                    <Megaphone className="h-5 w-5 text-[#8f664f]" />
                    <div>
                      <p className="font-semibold text-[#4a342a]">Call Next Queue</p>
                      <p className="text-sm text-[#8b7568]">Call the next order number.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleBumpOrder}
                    className="flex min-h-16 items-center gap-4 rounded-[18px] border border-[#e1d5c9] bg-white/78 px-4 py-3 text-left transition-colors hover:bg-white"
                  >
                    <RefreshCw className="h-5 w-5 text-[#8f664f]" />
                    <div>
                      <p className="font-semibold text-[#4a342a]">Bump Order</p>
                      <p className="text-sm text-[#8b7568]">Move order to top.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleHoldOrder}
                    className="flex min-h-16 items-center gap-4 rounded-[18px] border border-[#e1d5c9] bg-white/78 px-4 py-3 text-left transition-colors hover:bg-white"
                  >
                    <PauseCircle className="h-5 w-5 text-[#8f664f]" />
                    <div>
                      <p className="font-semibold text-[#4a342a]">Hold Order</p>
                      <p className="text-sm text-[#8b7568]">Temporarily hold order.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleViewAllOrders}
                    className="flex min-h-16 items-center gap-4 rounded-[18px] border border-[#e1d5c9] bg-white/78 px-4 py-3 text-left transition-colors hover:bg-white"
                  >
                    <ListOrdered className="h-5 w-5 text-[#8f664f]" />
                    <div>
                      <p className="font-semibold text-[#4a342a]">View All Orders</p>
                      <p className="text-sm text-[#8b7568]">See all orders list.</p>
                    </div>
                  </button>
                </div>
              </section>

              <section className="rounded-[24px] border border-[#ddd1c5] bg-[linear-gradient(180deg,rgba(255,252,247,0.96),rgba(243,233,223,0.94))] p-5 shadow-[0_20px_42px_rgba(109,84,66,0.1)]">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[1.05rem] font-extrabold uppercase tracking-[-0.02em] text-[#4a342a]">Kitchen Status</h3>
                  <div className={`inline-flex items-center gap-2 text-sm font-semibold ${isOnline ? "text-[#7d5a44]" : "text-[#a35f5f]"}`}>
                    <Dot className="h-5 w-5" />
                    {isOnline ? "Online" : "Offline"}
                  </div>
                </div>

                <div className="mt-4 border-t border-[#e4d7cb] pt-4">
                  <div className="mb-3 h-1.5 w-24 rounded-full bg-[#b78a68]" />
                  <p className="text-[1rem] text-[#6f5c50]">Last sync: {formatClock(lastSyncAt)}</p>
                  <div className="mt-4 flex items-start gap-3 text-sm text-[#8b7568]">
                    {isOnline ? <Wifi className="mt-0.5 h-4 w-4 text-[#7d5a44]" /> : <WifiOff className="mt-0.5 h-4 w-4 text-[#a35f5f]" />}
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
