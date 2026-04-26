"use client"

import { useEffect } from "react"
import { toast } from "@/hooks/use-toast"

const SUPABASE_SYNC_ERROR_EVENT = "alfresco:supabase-sync-error"

type SyncErrorDetail = {
  title?: string
  description?: string
}

export function SyncErrorListener() {
  useEffect(() => {
    const handleSyncError = (event: Event) => {
      const detail = (event as CustomEvent<SyncErrorDetail>).detail
      toast({
        variant: "destructive",
        title: detail?.title || "Supabase Sync Failed",
        description: detail?.description || "A catalog sync request failed.",
      })
    }

    window.addEventListener(SUPABASE_SYNC_ERROR_EVENT, handleSyncError)
    return () => window.removeEventListener(SUPABASE_SYNC_ERROR_EVENT, handleSyncError)
  }, [])

  return null
}
