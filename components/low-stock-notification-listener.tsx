"use client"

import { useCallback, useEffect, useRef } from "react"
import { toast } from "@/hooks/use-toast"
import { getCurrentUser, getIngredients, getInventoryAlerts, initializeSupabaseStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"

const LOW_STOCK_THRESHOLD = 10
const LOW_STOCK_NOTIFIED_KEY = "alfresco_low_stock_notified_ids"
const LOW_STOCK_PERMISSION_REQUESTED_KEY = "alfresco_low_stock_permission_requested"

function isEligibleRole(role: string | undefined) {
  return role === "admin" || role === "inventory_staff"
}

function buildLowStockMessage(names: string[]) {
  if (names.length === 1) {
    return `${names[0]} is low on stock.`
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are low on stock.`
  }

  return `${names[0]}, ${names[1]}, and ${names.length - 2} more items are low on stock.`
}

function readNotifiedIds() {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(LOW_STOCK_NOTIFIED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === "number") : []
  } catch {
    return []
  }
}

function writeNotifiedIds(ids: number[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(LOW_STOCK_NOTIFIED_KEY, JSON.stringify(ids))
}

export function LowStockNotificationListener() {
  const isCheckingRef = useRef(false)

  const checkLowStock = useCallback(async () => {
    const currentUser = getCurrentUser()
    if (!currentUser || !isEligibleRole(currentUser.role)) return
    if (isCheckingRef.current) return

    isCheckingRef.current = true

    try {
      await initializeSupabaseStore()

      const alerts = getInventoryAlerts(getIngredients(), { lowStockThreshold: LOW_STOCK_THRESHOLD })
      const lowStockIngredients = alerts.lowStockIngredients
      const lowStockIds = lowStockIngredients.map((ingredient) => ingredient.id)
      const previousIds = readNotifiedIds()
      const newLowStockIngredients = lowStockIngredients.filter((ingredient) => !previousIds.includes(ingredient.id))

      writeNotifiedIds(lowStockIds)

      if (newLowStockIngredients.length === 0) return

      const lowStockNames = newLowStockIngredients.map((ingredient) => ingredient.name)
      const notificationBody = buildLowStockMessage(lowStockNames)

      toast({
        title: "Low stock alert",
        description: notificationBody,
      })

      if (typeof window === "undefined" || !("Notification" in window)) return

      if (Notification.permission === "default" && !window.localStorage.getItem(LOW_STOCK_PERMISSION_REQUESTED_KEY)) {
        window.localStorage.setItem(LOW_STOCK_PERMISSION_REQUESTED_KEY, "true")
        try {
          await Notification.requestPermission()
        } catch {
          // Ignore permission prompt failures and keep toast fallback.
        }
      }

      if (Notification.permission === "granted") {
        new Notification("Al Fresco low stock alert", {
          body: notificationBody,
          tag: `low-stock:${lowStockIds.sort((left, right) => left - right).join(",")}`,
        })
      }
    } finally {
      isCheckingRef.current = false
    }
  }, [])

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser || !isEligibleRole(currentUser.role)) return

    void checkLowStock()

    const supabase = createClient()
    const triggerCheck = () => {
      void checkLowStock()
    }

    const channel = supabase
      .channel("low-stock-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "ingredients" }, triggerCheck)
      .on("postgres_changes", { event: "*", schema: "public", table: "ingredient_batches" }, triggerCheck)
      .subscribe()

    const intervalId = window.setInterval(() => {
      void checkLowStock()
    }, 60000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkLowStock()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [checkLowStock])

  return null
}
