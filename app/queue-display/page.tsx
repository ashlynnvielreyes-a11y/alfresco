"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Clock3,
  Expand,
  Megaphone,
  PackageCheck,
  QrCode,
  RefreshCw,
  Store,
  Users,
} from "lucide-react"

import { AuthGuard } from "@/components/auth-guard"
import { getQueueOrderTypeLabel, getTransactionQueueMetadata, normalizeQueueNumber } from "@/lib/queue"
import { getTransactions, initializeSupabaseStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
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
    queueNumber: normalizeQueueNumber(transaction.queueNumber) || String(transaction.id).replace(/\D/g, ""),
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

function QueueCard({
  record,
  accent,
  statusLabel,
}: {
  record: QueueDisplayRecord
  accent: string
  statusLabel: string
}) {
  return (
    <article className="flex min-h-[clamp(9.5rem,19vh,12.5rem)] flex-col justify-between rounded-[clamp(1rem,1.7vw,1.35rem)] border border-black/8 bg-[linear-gradient(180deg,#ffffff_0%,#f7f7f7_100%)] px-[clamp(1rem,1.3vw,1.3rem)] py-[clamp(0.95rem,1.3vw,1.2rem)] shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
      <div className="text-center">
        <p className="text-[clamp(3rem,5vw,4.8rem)] font-black leading-none tracking-[-0.08em] text-[#0f172a]">
          {record.queueNumber}
        </p>
        <p className="mt-3 text-[clamp(1rem,1.55vw,1.45rem)] font-medium text-[#334155]">{record.timestampLabel}</p>
      </div>
      <p className={`mt-4 text-center text-[clamp(1.05rem,1.6vw,1.5rem)] font-bold ${accent}`}>{statusLabel}</p>
    </article>
  )
}

function QueueGridSection({
  title,
  accent,
  icon,
  records,
  statusLabel,
}: {
  title: string
  accent: string
  icon: React.ReactNode
  records: QueueDisplayRecord[]
  statusLabel: string
}) {
  return (
    <section className="flex min-h-0 flex-col px-[clamp(0.85rem,1.1vw,1.2rem)] py-[clamp(0.5rem,0.8vw,0.9rem)]">
      <div className="mb-[clamp(0.75rem,1vw,1rem)] flex items-center justify-center gap-4">
        <div className={accent}>{icon}</div>
        <h3 className={`text-[clamp(1.8rem,2.4vw,2.7rem)] font-black uppercase tracking-[-0.04em] ${accent}`}>
          {title}
        </h3>
      </div>
      <div className={`mb-[clamp(0.8rem,1vw,1rem)] h-[3px] rounded-full ${accent.replace("text-", "bg-")}`} />

      <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-[clamp(0.8rem,1vw,1rem)]">
        {records.map((record) => (
          <QueueCard key={`${record.transaction.id}-${record.stage}`} record={record} accent={accent} statusLabel={statusLabel} />
        ))}
        {records.length === 0 ? (
          <div className="col-span-2 flex min-h-[clamp(14rem,30vh,18rem)] items-center justify-center rounded-[1.25rem] border border-dashed border-black/10 bg-white/60 text-center text-[clamp(1rem,1.3vw,1.2rem)] text-[#64748b]">
            Waiting for live orders
          </div>
        ) : null}
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

  const preparingBoard = preparingRecords.slice(0, 6)
  const readyBoard = readyRecords.slice(nowServing?.stage === "ready" ? 1 : 0, nowServing?.stage === "ready" ? 7 : 6)

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

  const toggleFullscreen = async () => {
    if (typeof document === "undefined") return

    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    await document.documentElement.requestFullscreen()
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#4a342a] text-white">
      <div className="flex h-full w-full flex-col bg-[linear-gradient(180deg,#4a342a_0%,#4a342a_14%,#f7f4ef_14.2%,#f4f0ea_80%,#4a342a_80.2%,#4a342a_100%)] p-[clamp(0.35rem,0.65vw,0.75rem)]">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[clamp(1rem,1.2vw,1.4rem)] border border-[#d7c9b8]/18 bg-transparent shadow-[0_0_0_2px_rgba(215,201,184,0.08),0_24px_90px_rgba(74,52,42,0.35)]">
          <header className="grid min-h-[clamp(7.5rem,12vh,9.5rem)] grid-cols-[1.2fr_1fr_0.9fr] items-center gap-4 bg-[#4a342a] px-[clamp(1rem,1.8vw,2rem)] py-[clamp(0.85rem,1vw,1.1rem)]">
            <div className="flex items-center gap-[clamp(0.75rem,1vw,1rem)] border-r border-[#d7c9b8]/20 pr-[clamp(1rem,1.5vw,1.8rem)]">
              <div className="rounded-[1rem] bg-[#f5f1ea]/6 p-2">
                <Image src="/alfresco-logo.png" alt="Brew and Co." width={220} height={74} className="h-[clamp(3.1rem,4.5vw,4.4rem)] w-auto object-contain" priority />
              </div>
              <div>
                <p className="text-[clamp(2rem,2.9vw,3rem)] font-black tracking-[-0.04em] text-white">BREW &amp; CO.</p>
                <p className="text-[clamp(0.95rem,1.2vw,1.3rem)] uppercase tracking-[0.32em] text-[#d7c9b8]">Coffee House</p>
              </div>
            </div>

            <div className="text-center">
              <h1 className="text-[clamp(2.5rem,4vw,4.4rem)] font-black uppercase tracking-[-0.06em] text-white">
                Queue Status
              </h1>
            </div>

            <div className="flex items-center justify-end gap-[clamp(0.8rem,1vw,1rem)] border-l border-[#d7c9b8]/20 pl-[clamp(1rem,1.5vw,1.8rem)]">
              <Clock3 className="h-[clamp(2rem,2.7vw,2.8rem)] w-[clamp(2rem,2.7vw,2.8rem)] text-white" />
              <div>
                <p className="text-[clamp(2.2rem,3.2vw,3.6rem)] font-black leading-none tracking-[-0.05em] text-white">{displayTime}</p>
              </div>
              <div className="border-l border-[#d7c9b8]/20 pl-[clamp(0.8rem,1vw,1.1rem)] text-[clamp(1rem,1.35vw,1.55rem)] font-medium leading-[1.3] text-white">
                <p>{displayDate}</p>
                <p>{displayWeekday}</p>
              </div>
            </div>
          </header>

          <section className="grid min-h-0 flex-1 grid-cols-[minmax(21rem,0.95fr)_minmax(0,1.85fr)] gap-[clamp(1rem,1vw,1.2rem)] px-[clamp(0.9rem,1vw,1.1rem)] py-[clamp(0.9rem,1vw,1.1rem)]">
            <section className="flex min-h-0 flex-col rounded-[clamp(1rem,1.2vw,1.4rem)] bg-[radial-gradient(circle_at_center,#4a342a_0%,#5a4134_100%)] px-[clamp(1rem,1.3vw,1.4rem)] py-[clamp(1rem,1.4vw,1.5rem)] shadow-[inset_0_0_0_1px_rgba(245,241,234,0.08)]">
              <p className="text-center text-[clamp(1.9rem,2.8vw,3rem)] font-black uppercase tracking-[-0.04em] text-white">
                Now Serving
              </p>

              <div className="flex min-h-0 flex-1 flex-col justify-between pt-[clamp(1.2rem,1.5vw,1.8rem)]">
                {nowServing ? (
                  <>
                    <p className="text-center text-[clamp(7rem,14vw,12rem)] font-black leading-[0.9] tracking-[-0.09em] text-white">
                      {nowServing.queueNumber}
                    </p>

                    <div className="mt-[clamp(0.9rem,1vw,1.1rem)] flex items-center justify-center">
                      <div className="h-[4px] w-[88%] rounded-full bg-[radial-gradient(circle_at_center,#f5f1ea_0%,#d7c9b8_28%,rgba(215,201,184,0.18)_60%,transparent_100%)]" />
                    </div>

                    <div className="mt-[clamp(1rem,1.5vw,1.5rem)] text-center">
                      <p className="text-[clamp(2rem,2.8vw,3rem)] font-black uppercase tracking-[-0.04em] text-[#d7c9b8]">
                        {nowServing.orderTypeLabel === "To Serve" ? "To Serve" : "For Pickup"}
                      </p>
                    </div>

                    <div className="mt-[clamp(1rem,1.6vw,1.6rem)] flex items-center justify-center gap-4 text-white">
                      <Megaphone className="h-[clamp(2.2rem,3vw,3rem)] w-[clamp(2.2rem,3vw,3rem)] text-[#d7c9b8]" />
                      <p className="text-[clamp(1.8rem,2.6vw,2.7rem)] font-medium leading-[1.12]">
                        Please proceed
                        <br />
                        to the counter
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-center text-[clamp(1.3rem,1.8vw,1.7rem)] text-[#f0e6db]">
                    Waiting for the next queue number
                  </div>
                )}

                <div className="mt-[clamp(1rem,1.3vw,1.4rem)] rounded-[1rem] bg-[#f5f1ea]/8 px-[clamp(0.8rem,1vw,1rem)] py-[clamp(0.8rem,1vw,0.95rem)]">
                  <div className="flex items-center justify-center gap-3 text-[clamp(1.2rem,1.7vw,1.55rem)] font-semibold text-white">
                    <Store className="h-[clamp(1.5rem,1.9vw,1.8rem)] w-[clamp(1.5rem,1.9vw,1.8rem)]" />
                    <span>Main Branch</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid min-h-0 grid-cols-2 divide-x divide-black/8 rounded-[clamp(1rem,1.2vw,1.4rem)] bg-[linear-gradient(180deg,#f8f6f2_0%,#f5f2ec_100%)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]">
              <QueueGridSection
                title="Preparing"
                accent="text-[#7d5a44]"
                icon={<RefreshCw className="h-[clamp(2rem,2.3vw,2.5rem)] w-[clamp(2rem,2.3vw,2.5rem)]" />}
                records={preparingBoard}
                statusLabel="Preparing"
              />
              <QueueGridSection
                title="Ready for Pickup"
                accent="text-[#4a342a]"
                icon={<PackageCheck className="h-[clamp(2rem,2.3vw,2.5rem)] w-[clamp(2rem,2.3vw,2.5rem)]" />}
                records={readyBoard}
                statusLabel="Ready"
              />
            </section>
          </section>

          <footer className="grid min-h-[clamp(7rem,12vh,9rem)] grid-cols-[1fr_1fr_auto] items-center gap-[clamp(1rem,1.2vw,1.4rem)] bg-[#4a342a] px-[clamp(1rem,1.8vw,2rem)] py-[clamp(0.85rem,1vw,1.1rem)]">
            <div className="flex items-center gap-[clamp(0.9rem,1.1vw,1.2rem)] border-r border-dashed border-[#d7c9b8]/35 pr-[clamp(1rem,1.6vw,1.8rem)]">
              <div className="flex h-[clamp(3.2rem,4vw,4.4rem)] w-[clamp(3.2rem,4vw,4.4rem)] items-center justify-center rounded-full border-2 border-white">
                <Users className="h-[clamp(1.8rem,2.2vw,2.4rem)] w-[clamp(1.8rem,2.2vw,2.4rem)] text-white" />
              </div>
              <div>
                <p className="text-[clamp(1.7rem,2.2vw,2.5rem)] italic text-[#d7c9b8]">Thank you!</p>
                <p className="text-[clamp(1.2rem,1.55vw,1.55rem)] text-white">We appreciate your patience.</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-[clamp(0.9rem,1.1vw,1.2rem)] border-r border-dashed border-[#d7c9b8]/35 pr-[clamp(1rem,1.6vw,1.8rem)]">
              <Image src="/placeholder-logo.png" alt="Coffee cup" width={86} height={110} className="h-[clamp(4.8rem,7vh,6.3rem)] w-auto object-contain" />
              <div>
                <p className="text-[clamp(1.5rem,2vw,2rem)] font-black uppercase tracking-[-0.03em] text-[#d7c9b8]">Enjoy your coffee!</p>
                <p className="text-[clamp(1.15rem,1.5vw,1.5rem)] leading-[1.2] text-white">
                  Every cup is brewed
                  <br />
                  with passion.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-[clamp(0.8rem,1vw,1rem)] rounded-[1rem] border border-[#d7c9b8]/18 bg-[#f5f1ea]/6 px-[clamp(0.9rem,1vw,1rem)] py-[clamp(0.8rem,1vw,0.95rem)]">
              <div className="rounded-[0.85rem] bg-white p-2 text-[#0f172a]">
                <QrCode className="h-[clamp(4rem,5vw,5.5rem)] w-[clamp(4rem,5vw,5.5rem)]" />
              </div>
              <div>
                <p className="text-[clamp(1.4rem,1.9vw,1.9rem)] font-black uppercase tracking-[-0.03em] text-white">Scan to Order</p>
                <p className="text-[clamp(1.05rem,1.35vw,1.35rem)] leading-[1.22] text-white">
                  Order ahead and
                  <br />
                  skip the line!
                </p>
              </div>
            </div>
          </footer>

          <div className="flex items-center justify-between bg-[#5a4134] px-[clamp(0.75rem,1vw,1rem)] py-[clamp(0.35rem,0.45vw,0.45rem)] text-[clamp(0.75rem,0.9vw,0.9rem)] text-white">
            <div className="opacity-70">{fullscreenActive ? "Fullscreen active" : "Display mode active"}</div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void loadQueueBoard()}
                className="inline-flex items-center gap-2 rounded-full border border-[#d7c9b8]/18 bg-[#f5f1ea]/8 px-3 py-1.5 transition-colors hover:bg-[#f5f1ea]/12"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="inline-flex items-center gap-2 rounded-full border border-[#d7c9b8]/18 bg-[#f5f1ea]/8 px-3 py-1.5 transition-colors hover:bg-[#f5f1ea]/12"
              >
                <Expand className="h-3.5 w-3.5" />
                {fullscreenActive ? "Exit Fullscreen" : "Fullscreen"}
              </button>
              <p className="text-[clamp(0.9rem,1vw,1rem)]">All orders are updated in real-time</p>
              <span className="h-3.5 w-3.5 rounded-full bg-[#d7c9b8]" />
            </div>
          </div>
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
