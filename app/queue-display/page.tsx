"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Clock3, CupSoda, Expand, RefreshCw, Sparkles } from "lucide-react"

import { AuthGuard } from "@/components/auth-guard"
import { getQueueOrderTypeLabel, getTransactionQueueMetadata } from "@/lib/queue"
import { getTransactions, initializeSupabaseStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import type { Transaction } from "@/lib/types"

type DisplayStage = "preparing" | "ready" | "serving"

type QueueDisplayRecord = {
  transaction: Transaction
  stage: DisplayStage
  queueNumber: string
  customerLabel: string
  orderTypeLabel: string
  placedAtValue: number
  timestampLabel: string
  itemsLabel: string
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

function getQueueStage(transaction: Transaction, now: number): DisplayStage | null {
  if (transaction.voided || transaction.orderStatus === "voided" || transaction.orderStatus === "cancelled") {
    return null
  }

  if (transaction.orderStatus === "ready") return "ready"
  if (transaction.orderStatus === "preparing" || transaction.orderStatus === "pending") return "preparing"

  if (transaction.orderStatus === "completed") {
    const queueMeta = getTransactionQueueMetadata(transaction)
    const completedAt = queueMeta.completedAt
      ? new Date(queueMeta.completedAt).getTime()
      : parseTransactionDateTime(transaction).getTime()

    if (now - completedAt <= 10 * 60 * 1000) return "serving"
  }

  return null
}

function buildDisplayRecord(transaction: Transaction, now: number): QueueDisplayRecord | null {
  const stage = getQueueStage(transaction, now)
  if (!stage) return null

  const queueMeta = getTransactionQueueMetadata(transaction)
  const placedAt = queueMeta.placedAt ? new Date(queueMeta.placedAt) : parseTransactionDateTime(transaction)

  return {
    transaction,
    stage,
    queueNumber: String(transaction.queueNumber || transaction.id).replace(/^#/, ""),
    customerLabel: transaction.customerName || "Walk-in customer",
    orderTypeLabel: getQueueOrderTypeLabel(queueMeta.orderType),
    placedAtValue: placedAt.getTime(),
    timestampLabel: placedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    itemsLabel: transaction.items.map((item) => `${item.product.name} x${item.quantity}`).join(" | "),
  }
}

function sortQueueRecords(records: QueueDisplayRecord[]) {
  return [...records].sort((left, right) => {
    const leftQueue = Number.parseInt(left.queueNumber, 10)
    const rightQueue = Number.parseInt(right.queueNumber, 10)

    if (Number.isFinite(leftQueue) && Number.isFinite(rightQueue) && leftQueue !== rightQueue) {
      return leftQueue - rightQueue
    }

    return left.placedAtValue - right.placedAtValue
  })
}

function QueueColumn({
  title,
  records,
  tone,
  emptyLabel,
}: {
  title: string
  records: QueueDisplayRecord[]
  tone: string
  emptyLabel: string
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-black/18 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold tracking-[-0.05em] text-white md:text-2xl">{title}</h3>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${tone}`}>
          {records.length} active
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {records.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-[#d9cfc4]">
            {emptyLabel}
          </div>
        ) : (
          records.map((record) => (
            <article
              key={`${record.transaction.id}-${record.stage}`}
              className="rounded-[1.6rem] border border-white/10 bg-white/7 px-4 py-4 shadow-[0_14px_36px_rgba(0,0,0,0.18)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-4xl font-semibold tracking-[-0.08em] text-white md:text-5xl">{record.queueNumber}</p>
                  <p className="mt-2 text-lg font-semibold tracking-[-0.04em] text-[#fff3e7]">{record.customerLabel}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/18 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#e7dacd]">
                  {record.orderTypeLabel}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-[#ded3c8]">{record.itemsLabel}</p>
              <div className="mt-4 flex items-center justify-between text-sm text-[#d6cbbf]">
                <span>Queued at</span>
                <span className="font-semibold text-white">{record.timestampLabel}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function QueueDisplayContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [now, setNow] = useState(Date.now())
  const [fullscreenActive, setFullscreenActive] = useState(false)

  const loadQueueBoard = useCallback(async () => {
    await initializeSupabaseStore()
    const nextTransactions = await getTransactions()
    setTransactions(nextTransactions)
  }, [])

  useEffect(() => {
    void loadQueueBoard()
  }, [loadQueueBoard])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("queue-display-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        void loadQueueBoard()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadQueueBoard])

  useEffect(() => {
    const syncFullscreen = () => setFullscreenActive(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", syncFullscreen)
    return () => document.removeEventListener("fullscreenchange", syncFullscreen)
  }, [])

  const displayRecords = useMemo(() => {
    const records = transactions
      .map((transaction) => buildDisplayRecord(transaction, now))
      .filter((record): record is QueueDisplayRecord => Boolean(record))

    return sortQueueRecords(records)
  }, [now, transactions])

  const readyRecords = displayRecords.filter((record) => record.stage === "ready")
  const preparingRecords = displayRecords.filter((record) => record.stage === "preparing")
  const servingRecords = displayRecords.filter((record) => record.stage === "serving")
  const nowServing = readyRecords[0] || servingRecords[0] || preparingRecords[0] || null

  const preparingBoard = preparingRecords.slice(0, 8)
  const readyBoard = readyRecords.slice(nowServing?.stage === "ready" ? 1 : 0, nowServing?.stage === "ready" ? 9 : 8)
  const recentServingBoard = servingRecords.slice(nowServing?.stage === "serving" ? 1 : 0, nowServing?.stage === "serving" ? 5 : 4)

  const displayDate = new Date(now).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  const displayTime = new Date(now).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  const toggleFullscreen = async () => {
    if (typeof document === "undefined") return

    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    await document.documentElement.requestFullscreen()
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#120f0d] text-[#f7f0e8]">
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(178,150,125,0.24),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.16),transparent_22%),linear-gradient(135deg,#1a1512_0%,#231a16_40%,#0f1720_100%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:4rem_4rem]" />

        <div className="relative z-10 flex min-h-screen flex-col p-4 md:p-6 xl:p-8">
          <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/6 px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl md:flex-row md:items-center md:justify-between md:px-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.38em] text-[#d9c4b2]">AI Fresco Queue Display</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.07em] text-[#fff7f0] md:text-5xl">
                Live Queue Board
              </h1>
              <p className="mt-2 text-sm text-[#d8cec3] md:text-base">
                Real-time queue status for customers across preparation, pickup, and current calls.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.26em] text-[#cbb8a8]">{displayDate}</p>
                <p className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-white md:text-3xl">{displayTime}</p>
              </div>
              <button
                type="button"
                onClick={() => void loadQueueBoard()}
                className="inline-flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-5 text-sm font-semibold text-[#fff7f0] transition-colors hover:bg-white/12"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="inline-flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-[#f3e0cf]/12 px-5 text-sm font-semibold text-[#fff7f0] transition-colors hover:bg-[#f3e0cf]/18"
              >
                <Expand className="h-4 w-4" />
                {fullscreenActive ? "Exit Fullscreen" : "Fullscreen"}
              </button>
            </div>
          </header>

          <section className="mt-4 grid flex-1 gap-4 xl:grid-cols-[1.08fr_1fr]">
            <section className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl md:p-8">
              <div className="absolute right-[-3rem] top-[-3rem] h-40 w-40 rounded-full bg-[#d8bba4]/14 blur-3xl" />
              <div className="absolute bottom-[-2rem] left-[-2rem] h-44 w-44 rounded-full bg-[#34d399]/10 blur-3xl" />

              <div className="relative z-10 flex h-full flex-col justify-between">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#d8c4b3]">Now Serving</p>
                    <p className="mt-3 max-w-md text-base leading-7 text-[#e6ddd5] md:text-lg">
                      Please proceed to the counter when your queue number appears here.
                    </p>
                  </div>
                  <div className="hidden rounded-3xl border border-white/10 bg-white/8 p-4 md:flex md:items-center md:gap-3">
                    <CupSoda className="h-8 w-8 text-[#f3d7bf]" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.26em] text-[#ccb8a7]">Active Board</p>
                      <p className="mt-1 text-lg font-semibold tracking-[-0.04em] text-white">
                        {readyRecords.length} ready | {preparingRecords.length} preparing
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-1 flex-col justify-center">
                  {nowServing ? (
                    <div className="rounded-[2rem] border border-white/12 bg-black/20 px-6 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:px-8 md:py-10">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-emerald-400/18 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100 ring-1 ring-emerald-300/25">
                          {nowServing.stage === "preparing"
                            ? "Preparing"
                            : nowServing.stage === "ready"
                              ? "Ready for Pickup"
                              : "Serving"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#f2e8dc]">
                          {nowServing.orderTypeLabel}
                        </span>
                      </div>

                      <p className="mt-6 text-sm uppercase tracking-[0.28em] text-[#d2c2b4]">Queue Number</p>
                      <p className="mt-4 text-[5rem] font-semibold leading-none tracking-[-0.12em] text-white md:text-[7rem] xl:text-[9rem]">
                        {nowServing.queueNumber}
                      </p>
                      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                          <p className="text-2xl font-semibold tracking-[-0.05em] text-[#fff7f0] md:text-3xl">
                            {nowServing.customerLabel}
                          </p>
                          <p className="mt-2 text-base text-[#dccfc4] md:text-lg">
                            {nowServing.itemsLabel}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.24em] text-[#ccb8a7]">Queued at</p>
                          <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-white">{nowServing.timestampLabel}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[2rem] border border-dashed border-white/14 bg-black/16 px-6 py-12 text-center">
                      <Sparkles className="mx-auto h-10 w-10 text-[#e2c8b1]" />
                      <p className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-white md:text-4xl">No active queue calls right now</p>
                      <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-[#d8cdc3] md:text-lg">
                        New paid POS orders will appear here automatically and stay synchronized across every display.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Preparing", value: preparingRecords.length, tone: "text-sky-100 bg-sky-300/12 border-sky-200/16" },
                    { label: "Ready", value: readyRecords.length, tone: "text-emerald-100 bg-emerald-300/12 border-emerald-200/16" },
                    { label: "Serving", value: servingRecords.length, tone: "text-amber-50 bg-amber-300/12 border-amber-200/16" },
                  ].map((metric) => (
                    <article key={metric.label} className={`rounded-[1.6rem] border px-4 py-4 ${metric.tone}`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em]">{metric.label}</p>
                      <p className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-white">{metric.value}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-4">
              <QueueColumn
                title="Preparing"
                records={preparingBoard}
                tone="bg-sky-300/16 text-sky-100 ring-1 ring-sky-200/20"
                emptyLabel="No queue numbers are currently being prepared."
              />
              <QueueColumn
                title="Ready for Pickup"
                records={readyBoard}
                tone="bg-emerald-400/18 text-emerald-100 ring-1 ring-emerald-300/25"
                emptyLabel="No queue numbers are waiting for pickup."
              />
              <QueueColumn
                title="Recently Serving"
                records={recentServingBoard}
                tone="bg-amber-300/18 text-amber-50 ring-1 ring-amber-200/25"
                emptyLabel="No recently served orders are being shown."
              />
            </section>
          </section>

          <footer className="mt-4 rounded-[1.8rem] border border-white/10 bg-black/16 px-5 py-4 text-sm text-[#ddd2c7] shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p>
                Queue numbers are generated at checkout, updated by kitchen staff in the kitchen dashboard, and synchronized here automatically in real time.
              </p>
              <div className="flex items-center gap-3 text-[#f2e5d9]">
                <Clock3 className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.24em]">Live synchronization active</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </main>
  )
}

export default function QueueDisplayPage() {
  return (
    <AuthGuard requiredPermission="queue">
      <QueueDisplayContent />
    </AuthGuard>
  )
}
