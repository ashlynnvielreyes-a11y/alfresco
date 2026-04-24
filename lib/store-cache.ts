/**
 * Memoized/cached versions of expensive store operations
 * These prevent redundant calculations across components
 */

import { Product, Ingredient } from "@/lib/types"

// Simple memoization cache
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 1000 // 1 second

function memoize<T extends any[], R>(fn: (...args: T) => R, keyFn: (...args: T) => string) {
  return (...args: T): R => {
    const key = keyFn(...args)
    const cached = cache.get(key)
    const now = Date.now()

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      return cached.data as R
    }

    const result = fn(...args)
    cache.set(key, { data: result, timestamp: now })
    return result
  }
}

// Memoized calculation function for product availability
export const memoizedGetProductAvailableStock = memoize(
  (product: Product, ingredients: Ingredient[]) => {
    if (product.ingredients.length === 0) return 0

    const availableQuantities = product.ingredients.map((pi) => {
      const ingredient = ingredients.find((i) => i.id === pi.ingredientId)
      if (!ingredient) return 0
      return Math.floor(ingredient.stock / pi.quantity)
    })

    return Math.min(...availableQuantities)
  },
  (product: Product) => `stock-${product.id}`
)

// Clear cache when data changes
export function clearStoreCache() {
  cache.clear()
}
