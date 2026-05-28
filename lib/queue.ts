"use client"

import type { AppUserRole, CartItem, Transaction } from "./types"

export type QueuePriority = "normal" | "rush" | "vip"
export type QueueOrderType = "pickup" | "to-serve"

export interface QueueMetadata {
  priority: QueuePriority
  orderType: QueueOrderType
  assignedStaffName: string | null
  assignedStaffRole: AppUserRole | null
  inventoryDeductedAt: string | null
  readyAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  placedAt: string | null
}

const QUEUE_META_PREFIX = "__QUEUE_META__:"
const DEFAULT_QUEUE_START = 1
const DAILY_QUEUE_RESET_ENABLED = true

const defaultQueueMetadata: QueueMetadata = {
  priority: "normal",
  orderType: "to-serve",
  assignedStaffName: null,
  assignedStaffRole: null,
  inventoryDeductedAt: null,
  readyAt: null,
  completedAt: null,
  cancelledAt: null,
  placedAt: null,
}

export function getDefaultQueueMetadata(): QueueMetadata {
  return { ...defaultQueueMetadata }
}

export function getQueueOrderTypeLabel(orderType: QueueOrderType) {
  return orderType === "pickup" ? "Pickup" : "To Serve"
}

export function getQueuePriorityLabel(priority: QueuePriority) {
  switch (priority) {
    case "rush":
      return "Rush"
    case "vip":
      return "VIP"
    default:
      return "Normal"
  }
}

export function getTransactionOrderType(transaction: Transaction) {
  const items = transaction.items || []
  if (items.some((item) => item.comboMeal)) return "Combo"

  const categories = new Set(items.map((item) => String(item.product.category)))
  const hasDrink = Array.from(categories).some((category) =>
    ["Coffee", "Milk Tea", "Fruit Soda", "Fruit Tea"].includes(category)
  )
  const hasMeal = Array.from(categories).some((category) =>
    ["Silog", "Combos"].includes(category)
  )

  if (hasDrink && hasMeal) return "Mixed"
  if (hasDrink) return "Beverage"
  if (hasMeal) return "Meal"
  return "Other"
}

export function getTransactionItemSummary(items: CartItem[]) {
  if (items.length === 0) return "No items"
  if (items.length === 1) return items[0].product.name
  return `${items[0].product.name} +${items.length - 1} more`
}

export function getTransactionItemCount(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

export function buildQueueMetadataNote(metadata: Partial<QueueMetadata>, existingNotes?: string | null) {
  const merged = {
    ...defaultQueueMetadata,
    ...metadata,
  }

  const userNote = getQueueUserNote(existingNotes)
  const serialized = `${QUEUE_META_PREFIX}${JSON.stringify(merged)}`
  return userNote ? `${serialized}\n${userNote}` : serialized
}

export function parseQueueMetadata(notes?: string | null): QueueMetadata {
  if (!notes || !notes.startsWith(QUEUE_META_PREFIX)) {
    return getDefaultQueueMetadata()
  }

  const [firstLine] = notes.split("\n")
  const payload = firstLine.slice(QUEUE_META_PREFIX.length)

  try {
    const parsed = JSON.parse(payload) as Partial<QueueMetadata>
    return {
      ...defaultQueueMetadata,
      ...parsed,
    }
  } catch {
    return getDefaultQueueMetadata()
  }
}

export function getQueueUserNote(notes?: string | null) {
  if (!notes) return null
  if (!notes.startsWith(QUEUE_META_PREFIX)) return notes

  const lines = notes.split("\n")
  const remainder = lines.slice(1).join("\n").trim()
  return remainder.length > 0 ? remainder : null
}

export function getTransactionQueueMetadata(transaction: Transaction) {
  return parseQueueMetadata(transaction.notes)
}

export function normalizeQueueNumber(value: string | number | null | undefined) {
  const rawValue = String(value ?? "").trim()
  if (!rawValue) return null

  const withoutPrefix = rawValue.replace(/^#\s*/, "")
  if (!/^\d+$/.test(withoutPrefix)) return null

  const normalized = withoutPrefix.replace(/^0+(?=\d)/, "")
  return normalized.length > 0 ? normalized : null
}

export function isQueueDailyResetEnabled() {
  return DAILY_QUEUE_RESET_ENABLED
}

export function getQueueStartNumber() {
  return DEFAULT_QUEUE_START
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function normalizeStoredDateKey(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return getLocalDateKey(parsed)
}

export function getTransactionQueueDateKey(transaction: Transaction) {
  const queueMeta = getTransactionQueueMetadata(transaction)
  return normalizeStoredDateKey(queueMeta.placedAt) || normalizeStoredDateKey(transaction.date)
}

export function isTransactionInQueueDate(transaction: Transaction, dateKey = getLocalDateKey()) {
  const transactionDateKey = getTransactionQueueDateKey(transaction)
  return transactionDateKey === dateKey
}

function getHighestDailyQueueNumber(transactions: Transaction[], date: string) {
  return transactions.reduce((highest, transaction) => {
    if (isQueueDailyResetEnabled() && !isTransactionInQueueDate(transaction, date)) return highest

    const normalizedQueueNumber = normalizeQueueNumber(transaction.queueNumber)
    if (!normalizedQueueNumber || normalizedQueueNumber.length > 6) return highest

    const parsed = Number.parseInt(normalizedQueueNumber, 10)
    if (!Number.isSafeInteger(parsed)) return highest

    return Math.max(highest, parsed)
  }, getQueueStartNumber() - 1)
}

export function getNextDailyQueueNumber(transactions: Transaction[], date: string) {
  const highestQueueNumber = getHighestDailyQueueNumber(transactions, date)

  return String(highestQueueNumber + 1)
}

export function getCurrentDailyQueueNumber(transactions: Transaction[], date: string) {
  const highestQueueNumber = getHighestDailyQueueNumber(transactions, date)
  if (highestQueueNumber < getQueueStartNumber()) return "----"
  return String(highestQueueNumber)
}

export function canAccessQueue(role: AppUserRole) {
  return role === "admin" || role === "cashier" || role === "barista" || role === "manager" || role === "inventory_staff" || role === "kitchen"
}

export function canManagePreparing(role: AppUserRole) {
  return role === "admin" || role === "barista" || role === "kitchen"
}

export function canCompleteQueuedOrders(role: AppUserRole) {
  return role === "admin" || role === "cashier"
}

export function canPrioritizeQueue(role: AppUserRole) {
  return role === "admin" || role === "cashier" || role === "barista" || role === "kitchen"
}
