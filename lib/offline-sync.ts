"use client"

export type OfflineSnapshotKey = "products" | "ingredients" | "transactions"

export type OfflineOperationType =
  | "sync_products"
  | "sync_ingredients"
  | "save_transaction"

export type OfflineOperation<T = unknown> = {
  id: string
  type: OfflineOperationType
  scope: string
  payload: T
  dedupeKey?: string
  createdAt: number
  updatedAt: number
  attempts: number
}

export type OfflineSyncStatus = {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncedAt: number | null
  lastError: string | null
}

const DB_NAME = "alfresco-offline-sync"
const DB_VERSION = 1
const QUEUE_STORE = "queue"
const SNAPSHOT_STORE = "snapshots"
const META_STORE = "meta"
const STATUS_KEY = "sync-status"

export const OFFLINE_SYNC_STATUS_EVENT = "alfresco:offline-sync-status"

function getDefaultStatus(): OfflineSyncStatus {
  return {
    isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return "Unknown offline sync error"
  }
}

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window
}

function promisifyRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function openDatabase() {
  if (!canUseIndexedDb()) return null

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const queueStore = db.createObjectStore(QUEUE_STORE, { keyPath: "id" })
        queueStore.createIndex("createdAt", "createdAt", { unique: false })
        queueStore.createIndex("dedupeKey", "dedupeKey", { unique: false })
      }

      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" })
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T>
) {
  const db = await openDatabase()
  if (!db) return null as T

  const transaction = db.transaction(storeName, mode)
  const store = transaction.objectStore(storeName)

  try {
    const result = await callback(store)
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    return result
  } finally {
    db.close()
  }
}

function emitStatus(status: OfflineSyncStatus) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<OfflineSyncStatus>(OFFLINE_SYNC_STATUS_EVENT, { detail: status }))
}

export async function getOfflineSyncStatus(): Promise<OfflineSyncStatus> {
  const stored = await withStore(META_STORE, "readonly", async (store) => {
    return promisifyRequest(store.get(STATUS_KEY))
  })

  if (!stored || typeof stored !== "object") {
    return getDefaultStatus()
  }

  const status = (stored as { value?: OfflineSyncStatus }).value || getDefaultStatus()
  return {
    ...getDefaultStatus(),
    ...status,
    isOnline: typeof navigator === "undefined" ? status.isOnline : navigator.onLine,
  }
}

export async function updateOfflineSyncStatus(next: Partial<OfflineSyncStatus>) {
  const current = await getOfflineSyncStatus()
  const merged: OfflineSyncStatus = {
    ...current,
    ...next,
    isOnline: typeof navigator === "undefined" ? current.isOnline : navigator.onLine,
  }

  await withStore(META_STORE, "readwrite", async (store) => {
    await promisifyRequest(store.put({ key: STATUS_KEY, value: merged }))
    return undefined
  })

  emitStatus(merged)
  return merged
}

export async function cacheOfflineSnapshot<T>(key: OfflineSnapshotKey, data: T) {
  await withStore(SNAPSHOT_STORE, "readwrite", async (store) => {
    await promisifyRequest(
      store.put({
        key,
        data,
        updatedAt: Date.now(),
      })
    )
    return undefined
  })
}

export async function readOfflineSnapshot<T>(key: OfflineSnapshotKey): Promise<T | null> {
  const stored = await withStore(SNAPSHOT_STORE, "readonly", async (store) => {
    return promisifyRequest(store.get(key))
  })

  if (!stored || typeof stored !== "object") return null
  return ((stored as { data?: T }).data ?? null) as T | null
}

export async function restoreLocalStorageFromSnapshot<T>(storageKey: string, snapshotKey: OfflineSnapshotKey) {
  if (typeof window === "undefined") return false
  if (window.localStorage.getItem(storageKey)) return false

  const snapshot = await readOfflineSnapshot<T>(snapshotKey)
  if (!snapshot) return false

  window.localStorage.setItem(storageKey, JSON.stringify(snapshot))
  return true
}

export async function listOfflineOperations() {
  const operations = await withStore(QUEUE_STORE, "readonly", async (store) => {
    return promisifyRequest(store.getAll())
  })

  return ((operations || []) as OfflineOperation[]).sort((left, right) => left.createdAt - right.createdAt)
}

export async function enqueueOfflineOperation<T>(
  type: OfflineOperationType,
  payload: T,
  scope: string,
  dedupeKey?: string
) {
  const operation: OfflineOperation<T> = {
    id: crypto.randomUUID(),
    type,
    scope,
    payload,
    dedupeKey,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attempts: 0,
  }

  await withStore(QUEUE_STORE, "readwrite", async (store) => {
    if (dedupeKey) {
      const existing = await promisifyRequest(store.index("dedupeKey").getAll(IDBKeyRange.only(dedupeKey)))
      for (const item of (existing as OfflineOperation[])) {
        await promisifyRequest(store.delete(item.id))
      }
    }

    await promisifyRequest(store.put(operation))
    return undefined
  })

  const pending = await listOfflineOperations()
  await updateOfflineSyncStatus({
    pendingCount: pending.length,
    lastError: typeof navigator !== "undefined" && !navigator.onLine ? "Waiting for connection" : null,
  })
}

export async function removeOfflineOperation(id: string) {
  await withStore(QUEUE_STORE, "readwrite", async (store) => {
    await promisifyRequest(store.delete(id))
    return undefined
  })
}

export async function markOfflineOperationAttempt(id: string, attempts: number) {
  await withStore(QUEUE_STORE, "readwrite", async (store) => {
    const existing = (await promisifyRequest(store.get(id))) as OfflineOperation | undefined
    if (!existing) return undefined

    await promisifyRequest(
      store.put({
        ...existing,
        attempts,
        updatedAt: Date.now(),
      })
    )
    return undefined
  })
}

export async function refreshOfflineSyncStatus() {
  const pending = await listOfflineOperations()
  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine

  return updateOfflineSyncStatus({
    isOnline,
    isSyncing: false,
    pendingCount: pending.length,
    lastError: isOnline ? null : pending.length > 0 ? "Waiting for connection" : null,
    ...(isOnline && pending.length === 0 ? { lastSyncedAt: Date.now() } : {}),
  })
}

export async function flushOfflineOperations(
  executors: Record<OfflineOperationType, (payload: unknown) => Promise<void>>
) {
  const pending = await listOfflineOperations()

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await updateOfflineSyncStatus({
      isOnline: false,
      isSyncing: false,
      pendingCount: pending.length,
      lastError: pending.length > 0 ? "Waiting for connection" : null,
    })
    return
  }

  if (pending.length === 0) {
    await updateOfflineSyncStatus({
      isOnline: true,
      isSyncing: false,
      pendingCount: 0,
      lastError: null,
    })
    return
  }

  await updateOfflineSyncStatus({
    isOnline: true,
    isSyncing: true,
    pendingCount: pending.length,
    lastError: null,
  })

  for (const operation of pending) {
    try {
      await executors[operation.type](operation.payload)
      await removeOfflineOperation(operation.id)
    } catch (error) {
      await markOfflineOperationAttempt(operation.id, operation.attempts + 1)
      await updateOfflineSyncStatus({
        isOnline: true,
        isSyncing: false,
        pendingCount: pending.length,
        lastError: `${operation.scope}: ${getErrorMessage(error)}`,
      })
      throw error
    }
  }

  const remaining = await listOfflineOperations()
  await updateOfflineSyncStatus({
    isOnline: true,
    isSyncing: false,
    pendingCount: remaining.length,
    lastSyncedAt: Date.now(),
    lastError: null,
  })
}
