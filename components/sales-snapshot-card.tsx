"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

type SalesSnapshotKey = "daily" | "weekly" | "monthly" | "yearly"
type TrendDirection = "positive" | "negative" | "neutral"

type SalesSnapshotItem = {
  label: string
  value: number
  comparisonLabel: string
  trendLabel: string
  trendDirection: TrendDirection
  trendPercentage: number
  sparkline: number[]
  sparklineLabel: string
}

export type SalesSnapshotData = Record<SalesSnapshotKey, SalesSnapshotItem>

type SalesSnapshotCardProps = {
  data: SalesSnapshotData
  className?: string
}

const tabs: SalesSnapshotKey[] = ["daily", "weekly", "monthly", "yearly"]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value)
}

function useAnimatedValue(value: number, duration = 650) {
  const [animatedValue, setAnimatedValue] = useState(value)

  useEffect(() => {
    let frameId = 0
    let startTime = 0
    const startingValue = animatedValue

    const tick = (timestamp: number) => {
      if (!startTime) startTime = timestamp

      const progress = Math.min((timestamp - startTime) / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      const nextValue = startingValue + (value - startingValue) * easedProgress

      setAnimatedValue(nextValue)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick)
      }
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [value])

  return animatedValue
}

function Sparkline({ values }: { values: number[] }) {
  const chart = useMemo(() => {
    if (values.length === 0) {
      return {
        polylinePoints: "",
        areaPath: "",
        lastPoint: null as { x: number; y: number } | null,
      }
    }

    const width = 240
    const height = 68
    const padding = 6
    const max = Math.max(...values, 0)
    const min = Math.min(...values, 0)
    const range = max - min || 1
    const pointList = values.map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1)
      const y = height - padding - ((value - min) / range) * (height - padding * 2)
      return { x, y }
    })

    const polylinePoints = pointList.map((point) => `${point.x},${point.y}`).join(" ")
    const firstPoint = pointList[0]
    const lastPoint = pointList[pointList.length - 1]
    const linePath = pointList.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")

    return {
      polylinePoints,
      areaPath: `${linePath} L ${lastPoint.x} ${height - padding} L ${firstPoint.x} ${height - padding} Z`,
      lastPoint,
    }
  }, [values])

  if (values.length === 0 || !chart.polylinePoints) {
    return <div className="h-[68px] w-full rounded-2xl bg-[#f5f1ea]/40" />
  }

  return (
    <svg viewBox="0 0 240 68" className="h-[68px] w-full overflow-visible">
      <defs>
        <linearGradient id="sales-sparkline-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(74,52,42,0.28)" />
          <stop offset="100%" stopColor="rgba(74,52,42,0)" />
        </linearGradient>
      </defs>
      <path
        d={chart.areaPath}
        fill="url(#sales-sparkline-fill)"
      />
      <polyline
        fill="none"
        stroke="#4a342a"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={chart.polylinePoints}
      />
      {chart.lastPoint ? (
        <circle
          cx={chart.lastPoint.x}
          cy={chart.lastPoint.y}
          r="4.5"
          fill="#f5f1ea"
          stroke="#4a342a"
          strokeWidth="2"
        />
      ) : null}
    </svg>
  )
}

export function SalesSnapshotCard({ data, className }: SalesSnapshotCardProps) {
  const [activeTab, setActiveTab] = useState<SalesSnapshotKey>("daily")
  const activeMetric = data[activeTab]
  const animatedValue = useAnimatedValue(activeMetric.value)
  const TrendIcon =
    activeMetric.trendDirection === "positive"
      ? TrendingUp
      : activeMetric.trendDirection === "negative"
        ? TrendingDown
        : BarChart3

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[16px] border border-[#f5f1ea]/55 bg-[linear-gradient(140deg,rgba(245,241,234,0.58),rgba(215,201,184,0.3))] p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.72)] backdrop-blur-xl sm:p-6",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,241,234,0.52),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(178,150,125,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.14),rgba(245,241,234,0.2))]" />
      <div className="pointer-events-none absolute -right-10 top-0 h-32 w-32 rounded-full bg-[#b2967d]/12 blur-3xl" />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#f5f1ea]/65 bg-[#f5f1ea]/62 text-[#4a342a] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7d5a44]">Sales Snapshot</p>
              <p className="mt-1 text-sm text-[#7d5a44]/80">Focused revenue view with one timeframe at a time.</p>
            </div>
          </div>

          <ToggleGroup
            type="single"
            value={activeTab}
            onValueChange={(value) => {
              if (value) setActiveTab(value as SalesSnapshotKey)
            }}
            className="w-full rounded-full border border-[#f5f1ea]/60 bg-[#f5f1ea]/62 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:w-auto"
          >
            {tabs.map((tab) => (
              <ToggleGroupItem
                key={tab}
                value={tab}
                aria-label={`${data[tab].label} snapshot`}
                className="rounded-full px-3.5 py-2 text-xs font-semibold capitalize text-[#7d5a44] transition-all duration-200 data-[state=on]:bg-[#4a342a] data-[state=on]:text-[#f5f1ea] data-[state=on]:shadow-[0_10px_22px_rgba(74,52,42,0.2)] hover:bg-[#d7c9b8]/55 hover:text-[#4a342a] sm:px-4"
              >
                {tab}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="rounded-[14px] border border-[#f5f1ea]/55 bg-[linear-gradient(135deg,rgba(245,241,234,0.78),rgba(215,201,184,0.38))] px-4 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)] sm:px-5 sm:py-7">
          <div
            key={activeTab}
            className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 flex flex-col gap-5"
          >
            <div className="flex flex-col items-center text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7d5a44]/78 sm:text-sm">
                {activeMetric.label}
              </p>
              <p className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[#4a342a] sm:text-5xl lg:text-[3.25rem]">
                {formatCurrency(animatedValue)}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                    activeMetric.trendDirection === "positive" && "bg-[#dcefdc] text-[#2f7d32]",
                    activeMetric.trendDirection === "negative" && "bg-[#f6dddd] text-[#b33c3c]",
                    activeMetric.trendDirection === "neutral" && "bg-[#e8ddd2] text-[#7d5a44]",
                  )}
                >
                  <TrendIcon className="h-3.5 w-3.5" />
                  <span>{activeMetric.trendLabel}</span>
                </span>
                <span className="text-sm text-[#7d5a44]/78">{activeMetric.comparisonLabel}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[#f5f1ea]/58 bg-[#f5f1ea]/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
              <Sparkline values={activeMetric.sparkline} />
              <p className="mt-2 text-center text-xs text-[#7d5a44]/75">{activeMetric.sparklineLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
