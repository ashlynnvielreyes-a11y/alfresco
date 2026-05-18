"use client"

import { useEffect } from "react"
import { flushOfflineSyncQueue } from "@/lib/store"
import { refreshOfflineSyncStatus } from "@/lib/offline-sync"

export function OfflineSyncListener() {
  useEffect(() => {
    const syncNow = () => {
      void flushOfflineSyncQueue().catch(() => {
        // Status updates are handled by the offline sync layer.
      })
    }

    const updateStatusOnly = () => {
      void refreshOfflineSyncStatus()
    }

    void refreshOfflineSyncStatus()
    void syncNow()

    window.addEventListener("online", syncNow)
    window.addEventListener("offline", updateStatusOnly)
    document.addEventListener("visibilitychange", syncNow)

    return () => {
      window.removeEventListener("online", syncNow)
      window.removeEventListener("offline", updateStatusOnly)
      document.removeEventListener("visibilitychange", syncNow)
    }
  }, [])

  return null
}
