"use client"

import { useEffect, useMemo, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { AlertTriangle, PackageX } from "lucide-react"
import {
  initializeSupabaseStore,
  getExpirationLogs,
  getProductExpirationLogs,
  getIngredients,
  getProducts,
  checkIngredientAvailability,
} from "@/lib/store"
import type { ExpirationLog, Ingredient, Product, ProductExpirationLog } from "@/lib/types"

function formatDate(date?: string | null) {
  if (!date) return "Unknown"
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return "Unknown"
  return parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateTime(date?: string | null) {
  if (!date) return "Unknown"
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return "Unknown"
  return parsedDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function ExpirationLogsPage() {
  const [expirationLogs, setExpirationLogs] = useState<ExpirationLog[]>([])
  const [productExpirationLogs, setProductExpirationLogs] = useState<ProductExpirationLog[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    const loadData = async () => {
      await initializeSupabaseStore()
      setExpirationLogs(getExpirationLogs())
      setProductExpirationLogs(getProductExpirationLogs())
      setIngredients(getIngredients())
      setProducts(getProducts())
    }

    void loadData()
  }, [])

  const expiredProducts = useMemo(() => {
    return products
      .map((product) => {
        const result = checkIngredientAvailability(product, 1, ingredients)
        const expiredReasons = result.missingIngredients.filter((reason) => reason.toLowerCase().includes("expired"))
        if (expiredReasons.length === 0) return null

        return {
          product,
          expiredReasons,
        }
      })
      .filter((entry): entry is { product: Product; expiredReasons: string[] } => Boolean(entry))
  }, [products, ingredients])

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-hidden p-4 pt-20 lg:p-6 lg:pt-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-10 h-64 w-64 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
          <div className="absolute right-8 top-24 h-52 w-52 rounded-full bg-[#7d5a44]/10 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="mb-6 flex flex-col gap-3 lg:mb-8">
            <h1 className="text-2xl font-bold text-[#4a342a] lg:text-3xl">Expiration Logs</h1>
            <p className="text-sm text-muted-foreground lg:text-base">
              View expired ingredient batches and the menu items blocked by them.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-[#f5f1ea]/55 bg-[rgba(245,241,234,0.78)] p-4 shadow-[0_18px_40px_rgba(74,52,42,0.08)] backdrop-blur-xl lg:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#4a342a]">Expired Products</h2>
                  <p className="text-sm text-muted-foreground">Menu items currently unavailable because of expired ingredients.</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  {expiredProducts.length} item{expiredProducts.length === 1 ? "" : "s"}
                </span>
              </div>

              {expiredProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-8 text-center text-sm text-muted-foreground">
                  No menu items are blocked by expired ingredients right now.
                </div>
              ) : (
                <div className="space-y-3">
                  {expiredProducts.map(({ product, expiredReasons }) => (
                    <div key={product.id} className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{product.name}</p>
                          <p className="text-xs text-red-700">{product.category}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                          <PackageX className="h-3.5 w-3.5" />
                          Unavailable
                        </span>
                      </div>
                      <div className="mt-3 space-y-1">
                        {expiredReasons.map((reason) => (
                          <p key={`${product.id}-${reason}`} className="text-sm text-red-700">
                            {reason}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[#f5f1ea]/55 bg-[rgba(245,241,234,0.78)] p-4 shadow-[0_18px_40px_rgba(74,52,42,0.08)] backdrop-blur-xl lg:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#4a342a]">Expired Product History</h2>
                  <p className="text-sm text-muted-foreground">Historical menu items affected when ingredient batches expired.</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-[#7d5a44] px-3 py-1 text-xs font-semibold text-[#f5f1ea]">
                  {productExpirationLogs.length} log{productExpirationLogs.length === 1 ? "" : "s"}
                </span>
              </div>

              {productExpirationLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-8 text-center text-sm text-muted-foreground">
                  No historical expired product logs recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {productExpirationLogs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-[#d7c9b8]/70 bg-[#f5f1ea]/82 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{log.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.productCategory} • blocked by {log.ingredientName}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                          <PackageX className="h-3.5 w-3.5" />
                          Logged
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-4">
                        <p>
                          Ingredient Batch
                          <span className="mt-1 block font-medium text-foreground">{log.batchId}</span>
                        </p>
                        <p>
                          Expired Qty
                          <span className="mt-1 block font-medium text-foreground">{log.quantity}</span>
                        </p>
                        <p>
                          Expired On
                          <span className="mt-1 block font-medium text-foreground">{formatDate(log.expirationDate)}</span>
                        </p>
                        <p>
                          Logged At
                          <span className="mt-1 block font-medium text-foreground">{formatDateTime(log.loggedAt)}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[#f5f1ea]/55 bg-[rgba(245,241,234,0.78)] p-4 shadow-[0_18px_40px_rgba(74,52,42,0.08)] backdrop-blur-xl lg:p-6 xl:col-span-2">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#4a342a]">Expired Ingredient Logs</h2>
                  <p className="text-sm text-muted-foreground">Recorded expired FIFO batches from inventory.</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-[#4a342a] px-3 py-1 text-xs font-semibold text-[#f5f1ea]">
                  {expirationLogs.length} log{expirationLogs.length === 1 ? "" : "s"}
                </span>
              </div>

              {expirationLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-8 text-center text-sm text-muted-foreground">
                  No expired ingredient logs recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {expirationLogs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-[#d7c9b8]/70 bg-[#f5f1ea]/82 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{log.ingredientName}</p>
                          <p className="text-xs text-muted-foreground">{log.batchId}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Expired
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                        <p>
                          Quantity
                          <span className="mt-1 block font-medium text-foreground">{log.quantity}</span>
                        </p>
                        <p>
                          Expired On
                          <span className="mt-1 block font-medium text-foreground">{formatDate(log.expirationDate)}</span>
                        </p>
                        <p>
                          Logged At
                          <span className="mt-1 block font-medium text-foreground">{formatDateTime(log.loggedAt)}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
