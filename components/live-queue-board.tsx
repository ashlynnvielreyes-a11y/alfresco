"use client"

import Link from "next/link"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, ChefHat, Clock3, Expand, LayoutDashboard, Loader2, Minimize, RefreshCw, ShoppingCart, Store, Tv2, Users } from "lucide-react"

import { getLocalDateKey, getQueueOrderTypeLabel, getTransactionQueueMetadata, isTransactionInQueueDate, normalizeQueueNumber } from "@/lib/queue"
import type { Transaction } from "@/lib/types"

type DisplayStage = "preparing" | "ready" | "serving"

type QueueDisplayRecord = {
  transaction: Transaction
  stage: DisplayStage
  queueNumber: string
  orderTypeLabel: string
  placedAtValue: number
  timestampLabel: string
}

function parseTransactionDateTime(transaction: Transaction) {
  const queueMeta = getTransactionQueueMetadata(transaction)

  if (queueMeta.placedAt) {
    const parsedPlacedAt = new Date(queueMeta.placedAt)
    if (!Number.isNaN(parsedPlacedAt.getTime())) return parsedPlacedAt
  }

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

function formatQueueNumberDisplay(value: string | null | undefined) {
  const normalized = normalizeQueueNumber(value)
  if (!normalized) return "----"
  return normalized.padStart(4, "0")
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
  const placedAt = parseTransactionDateTime(transaction)

  return {
    transaction,
    stage,
    queueNumber: formatQueueNumberDisplay(transaction.queueNumber) || String(transaction.id).replace(/\D/g, ""),
    orderTypeLabel: getQueueOrderTypeLabel(queueMeta.orderType),
    placedAtValue: placedAt.getTime(),
    timestampLabel: placedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
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

function QueueCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-[1.35rem] border border-white/55 bg-white/85 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${
        compact ? "min-h-[7.75rem]" : "min-h-[10rem]"
      }`}
    >
      <div className="h-4 w-20 rounded-full bg-[#eadfd5]" />
      <div className="mt-4 h-10 w-28 rounded-2xl bg-[#efe4da]" />
      <div className="mt-3 h-4 w-24 rounded-full bg-[#f2e9e0]" />
      <div className="mt-5 h-4 w-32 rounded-full bg-[#eadfd5]" />
    </div>
  )
}

function QueueCard({
  record,
  accentClass,
  compact = false,
}: {
  record: QueueDisplayRecord
  accentClass: string
  compact?: boolean
}) {
  return (
    <article
      className={`group flex h-full min-w-0 flex-col justify-between rounded-[1.35rem] border border-black/8 bg-[linear-gradient(180deg,#ffffff_0%,#f7f7f7_100%)] px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.12)] transition-all duration-300 animate-in fade-in zoom-in-95 ${
        compact ? "min-h-[8.25rem]" : "min-h-[10rem]"
      }`}
    >
      <div className="min-w-0 text-center">
        <p
          className={`truncate font-black leading-none tracking-[-0.08em] text-[#0f172a] ${
            compact ? "text-[clamp(2.1rem,3.4vw,3.2rem)]" : "text-[clamp(2.6rem,5vw,4.6rem)]"
          }`}
        >
          {record.queueNumber}
        </p>
        <p className={`mt-2 text-[#334155] ${compact ? "text-sm" : "text-[clamp(0.95rem,1.4vw,1.2rem)]"}`}>{record.timestampLabel}</p>
      </div>

      <div className="mt-4 min-w-0 text-center">
        <p className={`truncate font-bold uppercase tracking-[0.08em] ${accentClass} ${compact ? "text-sm" : "text-[clamp(1rem,1.5vw,1.35rem)]"}`}>
          {record.orderTypeLabel}
        </p>
      </div>
    </article>
  )
}

function EmptyState({
  title,
  description,
  compact = false,
}: {
  title: string
  description: string
  compact?: boolean
}) {
  return (
    <div
      className={`col-span-full flex items-center justify-center rounded-[1.35rem] border border-dashed border-black/10 bg-white/60 px-6 text-center text-[#64748b] ${
        compact ? "min-h-[9.5rem]" : "min-h-[14rem]"
      }`}
    >
      <div>
        <p className="text-lg font-semibold text-[#4a342a]">{title}</p>
        <p className="mt-2 text-sm">{description}</p>
      </div>
    </div>
  )
}

function QueueSection({
  title,
  accentClass,
  accentBarClass,
  accentBadgeClass,
  records,
  loading,
  compact = false,
  emptyTitle,
  emptyDescription,
}: {
  title: string
  accentClass: string
  accentBarClass: string
  accentBadgeClass: string
  records: QueueDisplayRecord[]
  loading: boolean
  compact?: boolean
  emptyTitle: string
  emptyDescription: string
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-[1.6rem] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,243,238,0.96))] p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className={`text-center font-black uppercase tracking-[-0.04em] ${accentClass} ${compact ? "text-xl" : "text-[clamp(1.4rem,2vw,2.2rem)]"}`}>
          {title}
        </h3>
        <span className={`rounded-full border bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${accentBadgeClass}`}>
          {records.length}
        </span>
      </div>

      <div className={`mt-3 h-[3px] rounded-full ${accentBarClass}`} />

      <div className={`mt-4 grid flex-1 auto-rows-fr gap-3 ${compact ? "grid-cols-2 xl:grid-cols-3" : "grid-cols-2 2xl:grid-cols-3"}`}>
        {loading ? (
          Array.from({ length: compact ? 3 : 6 }).map((_, index) => <QueueCardSkeleton key={`${title}-skeleton-${index}`} compact={compact} />)
        ) : records.length > 0 ? (
          records.map((record) => <QueueCard key={`${record.transaction.id}-${record.stage}`} record={record} accentClass={accentClass} compact={compact} />)
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} compact={compact} />
        )}
      </div>
    </section>
  )
}

type LiveQueueBoardProps = {
  transactions: Transaction[]
  loading?: boolean
  onRefresh?: () => void
  refreshDisabled?: boolean
  embedded?: boolean
}

const queueReturnLinks = [
  { href: "/pos", label: "POS", icon: ShoppingCart },
  { href: "/dashboard", label: "Admin Dashboard", icon: LayoutDashboard },
  { href: "/kitchen-dashboard", label: "Kitchen Dashboard", icon: ChefHat },
] as const

export function LiveQueueBoard({
  transactions,
  loading = false,
  onRefresh,
  refreshDisabled = false,
  embedded = false,
}: LiveQueueBoardProps) {
  const [now, setNow] = useState(Date.now())
  const [fullscreenActive, setFullscreenActive] = useState(false)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (embedded) return

    const syncFullscreen = () => setFullscreenActive(Boolean(document.fullscreenElement))
    syncFullscreen()
    document.addEventListener("fullscreenchange", syncFullscreen)
    return () => document.removeEventListener("fullscreenchange", syncFullscreen)
  }, [embedded])

  const displayRecords = useMemo(() => {
    const currentQueueDateKey = getLocalDateKey(new Date(now))
    const records = transactions
      .filter((transaction) => isTransactionInQueueDate(transaction, currentQueueDateKey))
      .map((transaction) => buildDisplayRecord(transaction, now))
      .filter((record): record is QueueDisplayRecord => Boolean(record))

    return sortQueueRecords(records)
  }, [now, transactions])

  const readyRecords = displayRecords.filter((record) => record.stage === "ready")
  const preparingRecords = displayRecords.filter((record) => record.stage === "preparing")
  const servingRecords = displayRecords.filter((record) => record.stage === "serving")
  const nowServing = readyRecords[0] || servingRecords[0] || preparingRecords[0] || null

  const preparingBoard = preparingRecords.slice(0, embedded ? 4 : 6)
  const readyBoard = readyRecords.slice(nowServing?.stage === "ready" ? 1 : 0, nowServing?.stage === "ready" ? (embedded ? 5 : 7) : embedded ? 4 : 6)
  const displayDate = new Date(now).toLocaleDateString([], {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const displayWeekday = new Date(now).toLocaleDateString([], {
    weekday: "long",
  })
  const displayTime = new Date(now).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })

  const toggleFullscreen = useCallback(async () => {
    if (embedded || typeof document === "undefined") return

    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    await document.documentElement.requestFullscreen()
  }, [embedded])

  if (embedded) {
    return (
      <section className="rounded-[24px] border border-[#ddd2c7] bg-[rgba(255,250,245,0.9)] p-4 shadow-[0_18px_38px_rgba(109,84,66,0.1)] lg:p-5">
        <div className="mb-4 grid gap-4 rounded-[22px] border border-[#e3d8cd] bg-[linear-gradient(180deg,#fffdf9_0%,#f4e9df_100%)] p-5 xl:grid-cols-[minmax(0,1.2fr)_auto] xl:items-center">
          <div>
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.22em] text-[#8d6f5b]">Live Queue Monitor</p>
            <h2 className="mt-2 text-[clamp(2rem,2.4vw,2.8rem)] font-black tracking-[-0.04em] text-[#4a342a]">Queue Display</h2>
            <p className="mt-1 text-sm text-[#7d5a44]">Now Serving, Preparing, and Ready for Pickup in one live view.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-[#ddd0c5] bg-white/88 px-4 py-3 text-[#4a342a] shadow-[0_12px_24px_rgba(109,84,66,0.06)]">
              <p className="text-xs uppercase tracking-[0.16em] text-[#8d6f5b]">Time</p>
              <p className="mt-1 text-2xl font-black tracking-[-0.04em]">{displayTime}</p>
            </div>
            <div className="rounded-2xl border border-[#ddd0c5] bg-white/88 px-4 py-3 text-[#4a342a] shadow-[0_12px_24px_rgba(109,84,66,0.06)]">
              <p className="text-xs uppercase tracking-[0.16em] text-[#8d6f5b]">Date</p>
              <p className="mt-1 text-sm font-semibold">{displayWeekday}</p>
              <p className="text-sm text-[#7d5a44]">{displayDate}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1.16fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-[1.6rem] border border-[#dccdbe] bg-[linear-gradient(180deg,#fbf7f2_0%,#f1e4d7_100%)] p-5 text-[#4a342a] shadow-[0_16px_30px_rgba(109,84,66,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-black uppercase tracking-[-0.04em] text-[#4a342a]">Now Serving</h3>
              <Tv2 className="h-5 w-5 text-[#8d6f5b]" />
            </div>
            <div className="mt-4 min-h-[15rem]">
              {loading ? (
                <div className="rounded-[1.35rem] bg-white/80 p-4">
                  <div className="h-4 w-24 rounded-full bg-[#ead8c7]" />
                  <div className="mt-4 h-14 w-36 rounded-3xl bg-[#f1e3d5]" />
                  <div className="mt-4 h-4 w-28 rounded-full bg-[#ead8c7]" />
                </div>
              ) : nowServing ? (
                <div className="rounded-[1.35rem] bg-white/88 p-5 text-center animate-in fade-in zoom-in-95 shadow-[0_12px_24px_rgba(109,84,66,0.06)]">
                  <p className="truncate text-[clamp(3.4rem,6vw,5.2rem)] font-black leading-none tracking-[-0.08em] text-[#4a342a]">{nowServing.queueNumber}</p>
                  <p className="mt-3 text-lg font-bold uppercase tracking-[0.1em] text-[#8d6f5b]">{nowServing.orderTypeLabel}</p>
                  <p className="mt-2 text-sm text-[#7d5a44]">Updated {nowServing.timestampLabel}</p>
                </div>
              ) : (
                <div className="rounded-[1.35rem] bg-white/88 p-6 text-center text-sm text-[#7d5a44]">
                  No queue is being served right now.
                </div>
              )}
            </div>
          </section>

            <QueueSection
              title="Preparing"
              accentClass="text-[#7d5a44]"
              accentBarClass="bg-[#7d5a44]"
              accentBadgeClass="border-[#c6af9f] text-[#7d5a44]"
              records={preparingBoard}
              loading={loading}
              compact
            emptyTitle="No orders in preparation"
            emptyDescription="New kitchen orders will appear here automatically."
          />
            <QueueSection
              title="Ready for Pickup"
              accentClass="text-[#4a342a]"
              accentBarClass="bg-[#4a342a]"
              accentBadgeClass="border-[#b2967d] text-[#4a342a]"
              records={readyBoard}
              loading={loading}
              compact
            emptyTitle="No pickup-ready orders"
            emptyDescription="Orders marked ready will move here in real time."
          />
        </div>
      </section>
    )
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#2a211c] text-[#3d2a1f]">
      <div className={`flex h-full w-full flex-col bg-[radial-gradient(circle_at_top,rgba(215,201,184,0.35),transparent_22%),linear-gradient(180deg,#2a211c_0%,#3d2a1f_10%,#f7f2eb_10.2%,#f5efe6_86%,#362821_86.2%,#2a211c_100%)] ${
        fullscreenActive ? "p-[clamp(0.25rem,0.5vw,0.55rem)]" : "p-[clamp(0.45rem,0.75vw,0.85rem)]"
      }`}>
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[clamp(1rem,1.2vw,1.4rem)] border border-[#d7c9b8]/60 shadow-[0_0_0_2px_rgba(255,250,244,0.2),0_24px_90px_rgba(42,33,28,0.28)]">
          <header className="grid min-h-[clamp(7.5rem,12vh,9.5rem)] grid-cols-1 gap-4 bg-[linear-gradient(180deg,#f9f5ef_0%,#efe2d4_100%)] px-[clamp(1rem,1.8vw,2rem)] py-[clamp(0.85rem,1vw,1.1rem)] xl:grid-cols-[1fr_auto_1fr] xl:items-center">
            <div className="flex items-center justify-center gap-4 xl:justify-start">
              <div className="rounded-[1.35rem] border border-[#d7c9b8] bg-white px-4 py-3 shadow-[0_18px_36px_rgba(74,52,42,0.12)]">
                <Image src="/alfresco-logo.png" alt="Al Fresco Cafe" width={220} height={74} className="h-[clamp(3rem,4.5vw,4.2rem)] w-auto object-contain" priority />
              </div>
              <div className="text-center xl:text-left">
                <p className="text-[clamp(1.6rem,2.4vw,2.6rem)] font-black tracking-[-0.04em] text-[#3d2a1f]">AL FRESCO</p>
                <p className="text-[clamp(0.85rem,1.1vw,1.15rem)] uppercase tracking-[0.28em] text-[#8a6a57]">Coffee Shop Queue</p>
              </div>
            </div>

            <div className="text-center">
              <p className="text-[0.82rem] font-bold uppercase tracking-[0.28em] text-[#8a6a57]">Queue Status</p>
              <h1 className="mt-2 text-[clamp(2.3rem,4vw,4.3rem)] font-black uppercase tracking-[-0.06em] text-[#3d2a1f]">Now Serving Board</h1>
            </div>

            <div className="flex flex-col items-center justify-center gap-2 rounded-[1.35rem] border border-[#d7c9b8] bg-white/70 px-4 py-3 text-center shadow-[0_16px_32px_rgba(74,52,42,0.08)] xl:items-end xl:text-right">
              <div className="flex items-center gap-3">
                <Clock3 className="h-[clamp(1.8rem,2.4vw,2.5rem)] w-[clamp(1.8rem,2.4vw,2.5rem)] text-[#4a342a]" />
                <p className="text-[clamp(2rem,3vw,3.2rem)] font-black leading-none tracking-[-0.05em] text-[#3d2a1f]">{displayTime}</p>
              </div>
              <div className="text-[clamp(0.95rem,1.25vw,1.35rem)] font-medium text-[#6a4e3d]">
                <p>{displayWeekday}</p>
                <p>{displayDate}</p>
              </div>
            </div>
          </header>

          <section className={`grid min-h-0 flex-1 gap-4 px-[clamp(0.9rem,1vw,1.1rem)] py-[clamp(0.9rem,1vw,1.1rem)] ${
            fullscreenActive ? "xl:grid-cols-[minmax(24rem,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)]" : "xl:grid-cols-[minmax(22rem,0.95fr)_minmax(0,1fr)_minmax(0,1fr)]"
          }`}>
            <section className="flex min-h-0 flex-col rounded-[1.6rem] bg-[radial-gradient(circle_at_center,#4a342a_0%,#5a4134_100%)] px-5 py-5 shadow-[inset_0_0_0_1px_rgba(245,241,234,0.08)]">
              <p className="text-center text-[clamp(1.7rem,2.5vw,2.8rem)] font-black uppercase tracking-[-0.04em] text-white">
                Now Serving
              </p>

              <div className="flex min-h-0 flex-1 flex-col justify-between pt-5">
                {loading ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="w-full rounded-[1.6rem] bg-white/8 p-6 text-center">
                      <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#d7c9b8]" />
                      <p className="mt-4 text-lg text-[#f0e6db]">Loading live queue...</p>
                    </div>
                  </div>
                ) : nowServing ? (
                  <>
                    <div className="rounded-[1.6rem] bg-white/8 px-4 py-6 text-center animate-in fade-in zoom-in-95">
                      <p className="truncate text-[clamp(5rem,12vw,10rem)] font-black leading-[0.92] tracking-[-0.09em] text-white">
                        {nowServing.queueNumber}
                      </p>
                      <p className="mt-4 text-[clamp(1.35rem,2vw,2rem)] font-black uppercase tracking-[0.08em] text-[#d7c9b8]">
                        {nowServing.orderTypeLabel}
                      </p>
                      <p className="mt-2 text-[clamp(1rem,1.35vw,1.2rem)] text-[#f0e6db]">Please proceed to the counter</p>
                    </div>

                    <div className="mt-5 rounded-[1.2rem] bg-[#f5f1ea]/8 px-4 py-4">
                      <div className="flex items-center justify-center gap-3 text-[clamp(1rem,1.45vw,1.25rem)] font-semibold text-white">
                        <Store className="h-5 w-5 text-[#d7c9b8]" />
                        <span>Main Branch</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-[1.6rem] bg-white/8 px-6 text-center text-[clamp(1.1rem,1.5vw,1.4rem)] text-[#f0e6db]">
                    No active queue yet. New orders will appear here automatically.
                  </div>
                )}
              </div>
            </section>

            <QueueSection
              title="Preparing"
              accentClass="text-[#7d5a44]"
              accentBarClass="bg-[#7d5a44]"
              accentBadgeClass="border-[#c6af9f] text-[#7d5a44]"
              records={preparingBoard}
              loading={loading}
              emptyTitle="Nothing is being prepared"
              emptyDescription="Cashier and kitchen updates will move orders here automatically."
            />
            <QueueSection
              title="Ready for Pickup"
              accentClass="text-[#4a342a]"
              accentBarClass="bg-[#4a342a]"
              accentBadgeClass="border-[#b2967d] text-[#4a342a]"
              records={readyBoard}
              loading={loading}
              emptyTitle="Nothing is ready for pickup"
              emptyDescription="Completed kitchen orders will appear here instantly."
            />
          </section>

          <footer className="grid min-h-[5.25rem] grid-cols-1 items-center gap-4 bg-[linear-gradient(180deg,#3d2a1f_0%,#2a211c_100%)] px-[clamp(1rem,1.8vw,2rem)] py-3 xl:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-start">
              <div className="flex items-center justify-center gap-3 text-center xl:justify-start xl:text-left">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#f5f1ea]">
                  <Users className="h-6 w-6 text-[#f5f1ea]" />
                </div>
                <div>
                  <p className="text-xl italic text-[#d7c9b8]">Thank you for your patience</p>
                  <p className="text-sm text-white">All queue updates are synchronized in real time.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 xl:justify-start">
                {queueReturnLinks.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="inline-flex items-center gap-2 rounded-full border border-[#d7c9b8]/35 bg-[#f5f1ea]/10 px-4 py-2 text-sm font-medium text-[#f5f1ea] transition-colors hover:bg-[#f5f1ea]/18"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 text-[#d7c9b8]" />
                      <Icon className="h-3.5 w-3.5 text-[#d7c9b8]" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 xl:justify-end">
              <button
                type="button"
                onClick={onRefresh}
                disabled={!onRefresh || refreshDisabled}
                className="inline-flex items-center gap-2 rounded-full border border-[#d7c9b8]/18 bg-[#f5f1ea]/8 px-4 py-2 text-sm transition-colors hover:bg-[#f5f1ea]/12 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshDisabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="inline-flex items-center gap-2 rounded-full border border-[#d7c9b8]/18 bg-[#f5f1ea]/8 px-4 py-2 text-sm transition-colors hover:bg-[#f5f1ea]/12"
              >
                {fullscreenActive ? <Minimize className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
                {fullscreenActive ? "Exit Fullscreen" : "Fullscreen"}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </main>
  )
}
