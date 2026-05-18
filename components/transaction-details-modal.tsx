"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, ReceiptText, ShieldAlert } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useIsMobile } from "@/components/ui/use-mobile"
import { createClient } from "@/lib/supabase/client"
import { fetchTransactionDetails, type TransactionDetails } from "@/lib/transaction-details"
import type { Transaction } from "@/lib/types"

function currency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value)
}

function paymentMethodLabel(value: TransactionDetails["paymentMethod"]) {
  return value === "gcash" ? "GCash" : "Cash"
}

function formatStatus(value: TransactionDetails["orderStatus"]) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDisplayValue(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "—"
}

interface TransactionDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionId: string | null
  fallbackTransaction?: Transaction | null
}

function TransactionDetailsContent({
  details,
  error,
  loading,
}: {
  details: TransactionDetails | null
  error: string | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-[22px] border border-[#d7c9b8] bg-[#f5f1ea]/75 p-5">
          <div className="flex items-center gap-3 text-[#7d5a44]">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm font-medium">Loading transaction details...</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea]/60" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[22px] border border-red-200 bg-red-50/90 p-5 text-red-700">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5" />
          <div>
            <p className="font-semibold">Unable to load transaction details</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!details) return null

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea]/75 p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Transaction ID</p>
          <p className="mt-2 text-sm font-semibold text-[#4a342a]">{details.transactionId}</p>
        </div>
        <div className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea]/75 p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Queue number</p>
          <p className="mt-2 text-sm font-semibold text-[#4a342a]">{formatDisplayValue(details.queueNumber)}</p>
        </div>
        <div className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea]/75 p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Customer</p>
          <p className="mt-2 text-sm font-semibold text-[#4a342a]">{formatDisplayValue(details.customerName)}</p>
        </div>
        <div className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea]/75 p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Order status</p>
          <p className="mt-2 text-sm font-semibold text-[#4a342a]">{formatStatus(details.orderStatus)}</p>
        </div>
      </div>

      <div className="rounded-[24px] border border-[#d7c9b8] bg-[#f5f1ea]/78">
        <div className="flex items-center justify-between gap-3 border-b border-[#d7c9b8] px-4 py-4">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Receipt view</p>
            <p className="mt-1 text-sm text-[#7d5a44]">
              {details.date} at {details.time} • {details.cashierName}
            </p>
          </div>
          <span className="rounded-full bg-[#4a342a] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#f5f1ea]">
            {paymentMethodLabel(details.paymentMethod)}
          </span>
        </div>

        <div className="max-h-[46vh] space-y-3 overflow-y-auto px-4 py-4">
          {details.items.map((item) => (
            <div key={item.id} className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#4a342a]">{item.itemName}</p>
                  <p className="mt-1 text-sm text-[#7d5a44]">
                    {item.quantity} × {currency(item.itemPrice)}
                  </p>
                  {item.comboName ? <p className="mt-1 text-xs text-[#7d5a44]">Combo: {item.comboName}</p> : null}
                  {item.modifierSummary ? <p className="mt-1 text-xs text-[#7d5a44]">Modifiers: {item.modifierSummary}</p> : null}
                  {item.addOns.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.addOns.map((addOn) => (
                        <span key={addOn.id} className="rounded-full border border-[#d7c9b8] bg-[#f5f1ea]/80 px-2.5 py-1 text-[11px] font-medium text-[#7d5a44]">
                          + {addOn.name} × {addOn.quantity}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {item.notes ? <p className="mt-2 text-xs italic text-[#7d5a44]">Note: {item.notes}</p> : null}
                </div>
                <p className="shrink-0 text-sm font-semibold text-[#4a342a]">{currency(item.totalPrice)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[22px] border border-[#d7c9b8] bg-[#f5f1ea]/75 p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">Notes and processing</p>
          <div className="mt-3 space-y-2 text-sm text-[#7d5a44]">
            <p><span className="font-semibold text-[#4a342a]">Cashier:</span> {details.cashierName}</p>
            <p><span className="font-semibold text-[#4a342a]">Payment:</span> {paymentMethodLabel(details.paymentMethod)}</p>
            <p><span className="font-semibold text-[#4a342a]">Instructions:</span> {formatDisplayValue(details.notes)}</p>
            <p><span className="font-semibold text-[#4a342a]">Data source:</span> {details.source}</p>
          </div>
        </div>

        <div className="rounded-[22px] border border-[#d7c9b8] bg-[#f5f1ea]/75 p-4">
          <div className="space-y-2 text-sm text-[#7d5a44]">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-[#4a342a]">{currency(details.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Discounts</span>
              <span className="font-semibold text-[#4a342a]">-{currency(details.discountAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Taxes</span>
              <span className="font-semibold text-[#4a342a]">{currency(details.taxAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cash received</span>
              <span className="font-semibold text-[#4a342a]">{currency(details.cashReceived)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Change</span>
              <span className="font-semibold text-[#4a342a]">{currency(details.changeAmount)}</span>
            </div>
            <div className="border-t border-dashed border-[#d7c9b8] pt-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-[#4a342a]">Total amount</span>
                <span className="text-base font-bold text-[#4a342a]">{currency(details.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TransactionDetailsModal({
  open,
  onOpenChange,
  transactionId,
  fallbackTransaction,
}: TransactionDetailsModalProps) {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<TransactionDetails | null>(null)

  useEffect(() => {
    if (!open || !transactionId) return

    let isMounted = true

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const nextDetails = await fetchTransactionDetails(transactionId, fallbackTransaction)
        if (isMounted) {
          setDetails(nextDetails)
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Unexpected error")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void load()

    const supabase = createClient()
    const channel = supabase
      .channel(`transaction-details-${transactionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => void load())
      .subscribe()

    return () => {
      isMounted = false
      void supabase.removeChannel(channel)
    }
  }, [fallbackTransaction, open, transactionId])

  useEffect(() => {
    if (!open) {
      setError(null)
      setLoading(false)
    }
  }, [open])

  const body = useMemo(
    () => <TransactionDetailsContent details={details} error={error} loading={loading} />,
    [details, error, loading]
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh] rounded-t-[28px] border-[#f5f1ea]/60 bg-[rgba(245,241,234,0.98)] text-[#4a342a]">
          <DrawerHeader className="px-5 pb-2 pt-5 text-left">
            <DrawerTitle className="flex items-center gap-2 text-xl font-bold text-[#4a342a]">
              <ReceiptText className="h-5 w-5" />
              Transaction details
            </DrawerTitle>
            <DrawerDescription className="text-[#7d5a44]">
              Itemized receipt view with live transaction updates.
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-5 pb-5">{body}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5" />
            Transaction details
          </DialogTitle>
          <DialogDescription>
            Itemized receipt view with live transaction updates.
          </DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}
