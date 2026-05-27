"use client"

import { useCallback, useEffect, useState } from "react"

import { AuthGuard } from "@/components/auth-guard"
import { LiveQueueBoard } from "@/components/live-queue-board"
import { getTransactions, initializeSupabaseStore, subscribeToTransactionSync } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import type { Transaction } from "@/lib/types"

function QueueDisplayContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadQueueBoard = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      await initializeSupabaseStore()
      const nextTransactions = await getTransactions()
      setTransactions(nextTransactions)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadQueueBoard()
  }, [loadQueueBoard])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("queue-display-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        void loadQueueBoard()
      })
      .subscribe()
    const unsubscribeTransactionSync = subscribeToTransactionSync(() => {
      void loadQueueBoard()
    })

    return () => {
      unsubscribeTransactionSync()
      void supabase.removeChannel(channel)
    }
  }, [loadQueueBoard])

  return (
    <LiveQueueBoard
      transactions={transactions}
      loading={isLoading}
      onRefresh={() => void loadQueueBoard(true)}
      refreshDisabled={isRefreshing}
    />
  )
}

export default function QueueDisplayPage() {
  return (
    <AuthGuard requiredPermission="queue">
      <QueueDisplayContent />
    </AuthGuard>
  )
}
