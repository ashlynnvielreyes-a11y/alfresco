"use client"

import type { AppUserRole, CartItem, Transaction } from "./types"

export type QueuePriority = "normal" | "rush" | "vip"
export type QueueOrderType = "pickup" | "to-serve"

export interface QueueMetadata {
  priority: QueuePriority
  orderType: QueueOrderType
  assignedStaffName: string | null
  assignedStaffRole: AppUserRole | null
  readyAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  placedAt: string | null
}

const QUEUE_META_PREFIX = "__QUEUE_META__:"
const DAILY_QUEUE_START = 1001

const defaultQueueMetadata: QueueMetadata = {
  priority: "normal",
  orderType: "to-serve",
  assignedStaffName: null,
  assignedStaffRole: null,
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

export function getNextDailyQueueNumber(transactions: Transaction[], date: string) {
  const highestQueueNumber = transactions.reduce((highest, transaction) => {
    if (transaction.date !== date) return highest

    const parsed = Number.parseInt(String(transaction.queueNumber || "").trim(), 10)
    if (!Number.isFinite(parsed)) return highest

    return Math.max(highest, parsed)
  }, DAILY_QUEUE_START - 1)

  return String(highestQueueNumber + 1)
}

export function getCurrentDailyQueueNumber(transactions: Transaction[], date: string) {
  const nextQueueNumber = Number.parseInt(getNextDailyQueueNumber(transactions, date), 10)
  if (!Number.isFinite(nextQueueNumber)) return String(DAILY_QUEUE_START)
  return String(Math.max(DAILY_QUEUE_START, nextQueueNumber - 1))
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
