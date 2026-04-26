"use client"

import type {
  Product,
  Transaction,
  Ingredient,
  StockBatch,
  ComboMeal,
  AddOn,
  CartItem,
  IngredientExpirationSummary,
  InventoryAlerts,
} from "./types"

const PRODUCTS_KEY = "alfresco_products"
const TRANSACTIONS_KEY = "alfresco_transactions"
const INGREDIENTS_KEY = "alfresco_ingredients"
const AUTH_KEY = "alfresco_auth"
const CURRENT_USER_KEY = "currentUserData"
const COMBOS_KEY = "alfresco_combos"
const ADDONS_KEY = "alfresco_addons"
const SUPABASE_SYNC_LOCK_KEY = "alfresco_supabase_sync_running"

const defaultIngredients: Ingredient[] = [
  { id: 1, productId: "ING-001", name: "Rice", unit: "cups", stock: 100, assignedProducts: [7, 8, 9, 10, 11, 12] },
  { id: 2, productId: "ING-002", name: "Eggs", unit: "pcs", stock: 50, assignedProducts: [7, 8, 9, 10, 11, 12] },
  { id: 3, productId: "ING-003", name: "Tapa (Beef)", unit: "pcs", stock: 30, assignedProducts: [7] },
  { id: 4, productId: "ING-004", name: "Longganisa", unit: "pcs", stock: 40, assignedProducts: [10] },
  { id: 5, productId: "ING-005", name: "Hotdog", unit: "pcs", stock: 35, assignedProducts: [9] },
  { id: 6, productId: "ING-006", name: "Bangus", unit: "pcs", stock: 25, assignedProducts: [11] },
  { id: 7, productId: "ING-007", name: "Pork", unit: "pcs", stock: 20, assignedProducts: [8] },
  { id: 8, productId: "ING-008", name: "Spam", unit: "pcs", stock: 30, assignedProducts: [12] },
  { id: 9, productId: "ING-009", name: "Espresso Shot", unit: "shots", stock: 100, assignedProducts: [1, 2, 3] },
  { id: 10, productId: "ING-010", name: "Milk", unit: "ml", stock: 5000, assignedProducts: [2, 3, 4, 5, 6] },
  { id: 11, productId: "ING-011", name: "White Chocolate Syrup", unit: "ml", stock: 1000, assignedProducts: [3] },
  { id: 12, productId: "ING-012", name: "Caramel Syrup", unit: "ml", stock: 1000, assignedProducts: [2] },
  { id: 13, productId: "ING-013", name: "Black Tea", unit: "bags", stock: 50, assignedProducts: [4, 5, 6] },
  { id: 14, productId: "ING-014", name: "Strawberry Syrup", unit: "ml", stock: 800, assignedProducts: [5] },
  { id: 15, productId: "ING-015", name: "Matcha Powder", unit: "g", stock: 500, assignedProducts: [6] },
]

const defaultProducts: Product[] = [
  { id: 1, name: "Espresso", category: "Coffee", price: 120.0, ingredients: [{ ingredientId: 9, quantity: 2 }] },
  { id: 2, name: "Spanish Latte", category: "Coffee", price: 160.0, ingredients: [{ ingredientId: 9, quantity: 2 }, { ingredientId: 10, quantity: 150 }, { ingredientId: 12, quantity: 30 }] },
  { id: 3, name: "White Mocha Latte", category: "Coffee", price: 110.0, ingredients: [{ ingredientId: 9, quantity: 2 }, { ingredientId: 10, quantity: 150 }, { ingredientId: 11, quantity: 30 }] },
  { id: 4, name: "Classic Milk Tea", category: "Milk Tea", price: 110.0, ingredients: [{ ingredientId: 13, quantity: 2 }, { ingredientId: 10, quantity: 200 }] },
  { id: 5, name: "Strawberry Milktea", category: "Milk Tea", price: 120.0, ingredients: [{ ingredientId: 13, quantity: 2 }, { ingredientId: 10, quantity: 200 }, { ingredientId: 14, quantity: 50 }] },
  { id: 6, name: "Matcha Milktea", category: "Milk Tea", price: 100.0, ingredients: [{ ingredientId: 15, quantity: 10 }, { ingredientId: 10, quantity: 200 }] },
  { id: 7, name: "Tapsilog", category: "Silog", price: 150.0, ingredients: [{ ingredientId: 1, quantity: 1 }, { ingredientId: 2, quantity: 1 }, { ingredientId: 3, quantity: 1 }] },
  { id: 8, name: "Pork Silog", category: "Silog", price: 145.0, ingredients: [{ ingredientId: 1, quantity: 1 }, { ingredientId: 2, quantity: 1 }, { ingredientId: 7, quantity: 1 }] },
  { id: 9, name: "Hotsilog", category: "Silog", price: 110.0, ingredients: [{ ingredientId: 1, quantity: 1 }, { ingredientId: 2, quantity: 1 }, { ingredientId: 5, quantity: 2 }] },
  { id: 10, name: "Longsilog", category: "Silog", price: 80.0, ingredients: [{ ingredientId: 1, quantity: 1 }, { ingredientId: 2, quantity: 1 }, { ingredientId: 4, quantity: 2 }] },
  { id: 11, name: "Bangusilog", category: "Silog", price: 120.0, ingredients: [{ ingredientId: 1, quantity: 1 }, { ingredientId: 2, quantity: 1 }, { ingredientId: 6, quantity: 1 }] },
  { id: 12, name: "Spamsilog", category: "Silog", price: 95.0, ingredients: [{ ingredientId: 1, quantity: 1 }, { ingredientId: 2, quantity: 1 }, { ingredientId: 8, quantity: 1 }] },
]

function getAuthStorage(rememberMe: boolean): Storage {
  return rememberMe ? localStorage : sessionStorage
}

async function getSupabaseBrowserClient() {
  const { createClient } = await import("./supabase/client")
  return createClient()
}

function writeLocalStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(value))
}

function readStoredAuth(key: string): string | null {
  const sessionValue = sessionStorage.getItem(key)
  if (sessionValue !== null) return sessionValue
  return localStorage.getItem(key)
}

function buildIngredientProductId(id: number) {
  return `ING-${String(id).padStart(3, "0")}`
}

function getStartOfDay(value: string | Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export function isBatchExpired(batch: StockBatch, referenceDate: Date = new Date()) {
  if (!batch.expirationDate) return false
  return getStartOfDay(batch.expirationDate).getTime() < getStartOfDay(referenceDate).getTime()
}

export function isBatchNearExpiration(batch: StockBatch, thresholdDays: number = 3, referenceDate: Date = new Date()) {
  if (!batch.expirationDate || isBatchExpired(batch, referenceDate)) return false

  const today = getStartOfDay(referenceDate).getTime()
  const expiry = getStartOfDay(batch.expirationDate).getTime()
  const diffDays = Math.ceil((expiry - today) / 86400000)
  return diffDays <= thresholdDays
}

function normalizeStockBatches(stock: number, stockBatches?: StockBatch[]) {
  if (stockBatches && stockBatches.length > 0) {
    return stockBatches.map((batch) => ({
      ...batch,
      id: batch.id || crypto.randomUUID(),
      dateAdded: batch.dateAdded || new Date().toISOString(),
      expirationDate: batch.expirationDate ?? null,
    }))
  }

  if (stock > 0) {
    return [
      {
        id: crypto.randomUUID(),
        quantity: stock,
        dateAdded: new Date().toISOString(),
        expirationDate: null,
      },
    ]
  }

  return []
}

function normalizeIngredient(ingredient: Ingredient): Ingredient {
  const normalizedBatches = normalizeStockBatches(ingredient.stock, ingredient.stockBatches)
  const normalizedStock = normalizedBatches
    .filter((batch) => !isBatchExpired(batch))
    .reduce((sum, batch) => sum + batch.quantity, 0)

  return {
    ...ingredient,
    productId: ingredient.productId || buildIngredientProductId(ingredient.id),
    assignedProducts: [...new Set(ingredient.assignedProducts || [])].sort((a, b) => a - b),
    stockBatches: normalizedBatches,
    stock: normalizedStock || ingredient.stock || 0,
  }
}

function syncIngredientAssignmentsWithProducts(ingredients: Ingredient[], products: Product[]) {
  return ingredients.map((ingredient) => {
    const recipeLinkedProducts = products
      .filter((product) => product.ingredients.some((pi) => pi.ingredientId === ingredient.id))
      .map((product) => product.id)

    return normalizeIngredient({
      ...ingredient,
      assignedProducts: [...new Set([...(ingredient.assignedProducts || []), ...recipeLinkedProducts])],
    })
  })
}

function sortBatchesForFifo(stockBatches: StockBatch[]) {
  return [...stockBatches].sort((a, b) => {
    const aExpiry = a.expirationDate ? new Date(a.expirationDate).getTime() : Number.POSITIVE_INFINITY
    const bExpiry = b.expirationDate ? new Date(b.expirationDate).getTime() : Number.POSITIVE_INFINITY

    if (aExpiry !== bExpiry) return aExpiry - bExpiry
    return new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime()
  })
}

export function getUsableStockBatches(stockBatches: StockBatch[], referenceDate: Date = new Date()) {
  return sortBatchesForFifo(stockBatches).filter((batch) => !isBatchExpired(batch, referenceDate))
}

export function getIngredientExpirationSummary(
  ingredient: Ingredient,
  options?: { thresholdDays?: number; referenceDate?: Date }
): IngredientExpirationSummary {
  const thresholdDays = options?.thresholdDays ?? 3
  const referenceDate = options?.referenceDate ?? new Date()
  const normalized = normalizeIngredient(ingredient)
  const sortedBatches = sortBatchesForFifo(normalized.stockBatches || [])
  const usableBatches = sortedBatches.filter((batch) => !isBatchExpired(batch, referenceDate))
  const expiredBatches = sortedBatches.filter((batch) => isBatchExpired(batch, referenceDate))
  const nearExpirationBatches = usableBatches.filter((batch) => isBatchNearExpiration(batch, thresholdDays, referenceDate))
  const nextBatch = usableBatches[0] || null

  return {
    usableStock: usableBatches.reduce((sum, batch) => sum + batch.quantity, 0),
    expiredStock: expiredBatches.reduce((sum, batch) => sum + batch.quantity, 0),
    nextBatchId: nextBatch?.id || null,
    nextDateAdded: nextBatch?.dateAdded || null,
    nextExpirationDate: nextBatch?.expirationDate || null,
    nearExpirationBatches,
    expiredBatches,
  }
}

export function getInventoryAlerts(
  ingredients: Ingredient[],
  options?: { lowStockThreshold?: number; expiringThresholdDays?: number; referenceDate?: Date }
): InventoryAlerts {
  const lowStockThreshold = options?.lowStockThreshold ?? 10
  const expiringThresholdDays = options?.expiringThresholdDays ?? 3
  const referenceDate = options?.referenceDate ?? new Date()

  const normalized = ingredients.map(normalizeIngredient)

  return {
    lowStockIngredients: normalized.filter((ingredient) => ingredient.stock > 0 && ingredient.stock <= lowStockThreshold),
    expiringSoonIngredients: normalized.filter(
      (ingredient) => getIngredientExpirationSummary(ingredient, { thresholdDays: expiringThresholdDays, referenceDate }).nearExpirationBatches.length > 0
    ),
    expiredIngredients: normalized.filter(
      (ingredient) => getIngredientExpirationSummary(ingredient, { thresholdDays: expiringThresholdDays, referenceDate }).expiredBatches.length > 0
    ),
  }
}

function getNormalizedTransactions(list: Transaction[]): Transaction[] {
  return list.map((transaction) => ({
    ...transaction,
    discountType: transaction.discountType === "senior" || transaction.discountType === "pwd" ? transaction.discountType : "none",
    discountPercent:
      transaction.discountType === "senior" || transaction.discountType === "pwd"
        ? transaction.discountPercent || 20
        : 0,
    discountAmount: transaction.discountAmount || 0,
    change: transaction.change || 0,
    paymentMethod: transaction.paymentMethod === "gcash" ? "gcash" : "cash",
  }))
}

function saveProductsLocally(products: Product[]): void {
  writeLocalStorage(PRODUCTS_KEY, products)
}

function saveIngredientsLocally(ingredients: Ingredient[]): void {
  writeLocalStorage(INGREDIENTS_KEY, ingredients.map(normalizeIngredient))
}

function saveComboMealsLocally(combos: ComboMeal[]): void {
  writeLocalStorage(COMBOS_KEY, combos)
}

function saveAddOnsLocally(addOns: AddOn[]): void {
  writeLocalStorage(ADDONS_KEY, addOns)
}

async function syncProductsToSupabase(products: Product[]) {
  const supabase = await getSupabaseBrowserClient()
  const normalizedProducts = products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    is_available: true,
    updated_at: new Date().toISOString(),
  }))

  const { data: existingProducts, error: existingError } = await supabase.from("products").select("id")
  if (existingError) throw existingError

  const existingIds = new Set((existingProducts || []).map((row: { id: number }) => row.id))
  const localIds = new Set(products.map((product) => product.id))
  const removedIds = [...existingIds].filter((id) => !localIds.has(id))

  if (normalizedProducts.length > 0) {
    const { error } = await supabase.from("products").upsert(normalizedProducts, { onConflict: "id" })
    if (error) throw error
  }

  if (removedIds.length > 0) {
    const { error } = await supabase.from("products").delete().in("id", removedIds)
    if (error) throw error
  }

  if (products.length > 0) {
    const productIds = products.map((product) => product.id)
    const { error: deleteIngredientsError } = await supabase.from("product_ingredients").delete().in("product_id", productIds)
    if (deleteIngredientsError) throw deleteIngredientsError
  }

  const productIngredients = products.flatMap((product) =>
    product.ingredients.map((ingredient) => ({
      product_id: product.id,
      ingredient_id: ingredient.ingredientId,
      quantity: ingredient.quantity,
    }))
  )

  if (productIngredients.length > 0) {
    const { error } = await supabase.from("product_ingredients").insert(productIngredients)
    if (error) throw error
  }
}

async function syncIngredientsToSupabase(ingredients: Ingredient[]) {
  const supabase = await getSupabaseBrowserClient()
  const normalizedIngredients = ingredients.map(normalizeIngredient)
  const ingredientRows = normalizedIngredients.map((ingredient) => ({
    id: ingredient.id,
    name: ingredient.name,
    unit: ingredient.unit,
    stock: ingredient.stock,
    product_code: ingredient.productId,
    updated_at: new Date().toISOString(),
  }))

  const { data: existingIngredients, error: existingError } = await supabase.from("ingredients").select("id")
  if (existingError) throw existingError

  const existingIds = new Set((existingIngredients || []).map((row: { id: number }) => row.id))
  const localIds = new Set(normalizedIngredients.map((ingredient) => ingredient.id))
  const removedIds = [...existingIds].filter((id) => !localIds.has(id))

  if (ingredientRows.length > 0) {
    const { error } = await supabase.from("ingredients").upsert(ingredientRows, { onConflict: "id" })
    if (error) throw error
  }

  if (removedIds.length > 0) {
    const { error } = await supabase.from("ingredients").delete().in("id", removedIds)
    if (error) throw error
  }

  if (normalizedIngredients.length > 0) {
    const ingredientIds = normalizedIngredients.map((ingredient) => ingredient.id)

    const { error: deleteAssignmentsError } = await supabase.from("ingredient_assignments").delete().in("ingredient_id", ingredientIds)
    if (deleteAssignmentsError) throw deleteAssignmentsError

    const { error: deleteBatchesError } = await supabase.from("ingredient_batches").delete().in("ingredient_id", ingredientIds)
    if (deleteBatchesError) throw deleteBatchesError
  }

  const assignmentRows = normalizedIngredients.flatMap((ingredient) =>
    ingredient.assignedProducts.map((productId) => ({
      ingredient_id: ingredient.id,
      product_id: productId,
    }))
  )

  if (assignmentRows.length > 0) {
    const { error } = await supabase.from("ingredient_assignments").insert(assignmentRows)
    if (error) throw error
  }

  const batchRows = normalizedIngredients.flatMap((ingredient) =>
    (ingredient.stockBatches || []).map((batch) => ({
      id: batch.id,
      ingredient_id: ingredient.id,
      quantity: batch.quantity,
      date_added: batch.dateAdded,
      expiration_date: batch.expirationDate,
      created_at: batch.dateAdded,
      updated_at: new Date().toISOString(),
    }))
  )

  if (batchRows.length > 0) {
    const { error } = await supabase.from("ingredient_batches").upsert(batchRows, { onConflict: "id" })
    if (error) throw error
  }
}

async function syncComboMealsToSupabase(combos: ComboMeal[]) {
  const supabase = await getSupabaseBrowserClient()
  const comboRows = combos.map((combo) => ({
    id: combo.id,
    name: combo.name,
    description: combo.description,
    price: combo.price,
    updated_at: new Date().toISOString(),
  }))

  const { data: existingCombos, error: existingError } = await supabase.from("combo_meals").select("id")
  if (existingError) throw existingError

  const existingIds = new Set((existingCombos || []).map((row: { id: number }) => row.id))
  const localIds = new Set(combos.map((combo) => combo.id))
  const removedIds = [...existingIds].filter((id) => !localIds.has(id))

  if (comboRows.length > 0) {
    const { error } = await supabase.from("combo_meals").upsert(comboRows, { onConflict: "id" })
    if (error) throw error
  }

  if (removedIds.length > 0) {
    const { error } = await supabase.from("combo_meals").delete().in("id", removedIds)
    if (error) throw error
  }

  if (combos.length > 0) {
    const comboIds = combos.map((combo) => combo.id)
    const { error: deleteItemsError } = await supabase.from("combo_meal_items").delete().in("combo_id", comboIds)
    if (deleteItemsError) throw deleteItemsError
  }

  const itemRows = combos.flatMap((combo) =>
    combo.items.map((item) => ({
      combo_id: combo.id,
      ingredient_id: item.ingredientId ?? null,
      product_id: item.productId,
      quantity: item.quantity,
    }))
  )

  if (itemRows.length > 0) {
    const { error } = await supabase.from("combo_meal_items").insert(itemRows)
    if (error) throw error
  }
}

async function syncAddOnsToSupabase(addOns: AddOn[]) {
  const supabase = await getSupabaseBrowserClient()
  const addOnRows = addOns.map((addOn) => ({
    id: addOn.id,
    name: addOn.name,
    price: addOn.price,
    category: addOn.category,
    updated_at: new Date().toISOString(),
  }))

  const { data: existingAddOns, error: existingError } = await supabase.from("addons").select("id")
  if (existingError) throw existingError

  const existingIds = new Set((existingAddOns || []).map((row: { id: string }) => row.id))
  const localIds = new Set(addOns.map((addOn) => addOn.id))
  const removedIds = [...existingIds].filter((id) => !localIds.has(id))

  if (addOnRows.length > 0) {
    const { error } = await supabase.from("addons").upsert(addOnRows, { onConflict: "id" })
    if (error) throw error
  }

  if (removedIds.length > 0) {
    const { error } = await supabase.from("addons").delete().in("id", removedIds)
    if (error) throw error
  }
}

function queueSupabaseSync(task: Promise<unknown>) {
  void task.catch((error) => {
    console.log("[v0] Supabase catalog sync skipped:", error)
  })
}

export async function initializeSupabaseStore(): Promise<void> {
  if (typeof window === "undefined") return
  if (sessionStorage.getItem(SUPABASE_SYNC_LOCK_KEY) === "true") return

  sessionStorage.setItem(SUPABASE_SYNC_LOCK_KEY, "true")

  try {
    const supabase = await getSupabaseBrowserClient()

    const [
      productsResponse,
      productIngredientsResponse,
      ingredientsResponse,
      ingredientAssignmentsResponse,
      ingredientBatchesResponse,
      comboMealsResponse,
      comboMealItemsResponse,
      addOnsResponse,
    ] = await Promise.all([
      supabase.from("products").select("*").order("id"),
      supabase.from("product_ingredients").select("product_id, ingredient_id, quantity"),
      supabase.from("ingredients").select("*").order("id"),
      supabase.from("ingredient_assignments").select("ingredient_id, product_id"),
      supabase.from("ingredient_batches").select("*"),
      supabase.from("combo_meals").select("*").order("id"),
      supabase.from("combo_meal_items").select("*"),
      supabase.from("addons").select("*"),
    ])

    const localProducts = getProducts()
    const localIngredients = getIngredients()
    const localCombos = getComboMeals()
    const localAddOns = getAddOns()

    if (!productsResponse.error && !ingredientsResponse.error) {
      const remoteProducts = (productsResponse.data || []).map((product: any) => ({
        id: product.id,
        name: product.name,
        category: (product.category as string) === "Pastry" ? "Fruit Tea" : (product.category as Product["category"]) || "Coffee",
        price: Number(product.price) || 0,
        ingredients: (productIngredientsResponse.data || [])
          .filter((ingredient: any) => ingredient.product_id === product.id)
          .map((ingredient: any) => ({
            ingredientId: ingredient.ingredient_id,
            quantity: Number(ingredient.quantity) || 0,
          })),
      }))

      const remoteIngredients = syncIngredientAssignmentsWithProducts(
        (ingredientsResponse.data || []).map((ingredient: any) =>
          normalizeIngredient({
            id: ingredient.id,
            productId: ingredient.product_code || ingredient.product_id || buildIngredientProductId(ingredient.id),
            name: ingredient.name,
            unit: ingredient.unit,
            stock: Number(ingredient.stock) || 0,
            assignedProducts: (ingredientAssignmentsResponse.data || [])
              .filter((assignment: any) => assignment.ingredient_id === ingredient.id)
              .map((assignment: any) => assignment.product_id),
            stockBatches: (ingredientBatchesResponse.data || [])
              .filter((batch: any) => batch.ingredient_id === ingredient.id)
              .map((batch: any) => ({
                id: batch.id,
                quantity: Number(batch.quantity) || 0,
                dateAdded: batch.date_added || batch.created_at || new Date().toISOString(),
                expirationDate: batch.expiration_date || null,
              })),
          })
        ),
        remoteProducts
      )

      if (remoteProducts.length > 0) {
        saveProductsLocally(remoteProducts)
      } else if (localProducts.length > 0) {
        queueSupabaseSync(syncProductsToSupabase(localProducts))
      }

      if (remoteIngredients.length > 0) {
        saveIngredientsLocally(remoteIngredients)
      } else if (localIngredients.length > 0) {
        queueSupabaseSync(syncIngredientsToSupabase(localIngredients))
      }
    }

    if (!comboMealsResponse.error && !comboMealItemsResponse.error) {
      const remoteCombos = (comboMealsResponse.data || []).map((combo: any) => ({
        id: combo.id,
        name: combo.name,
        description: combo.description || "",
        price: Number(combo.price) || 0,
        items: (comboMealItemsResponse.data || [])
          .filter((item: any) => item.combo_id === combo.id)
          .map((item: any) => ({
            ingredientId: item.ingredient_id ?? undefined,
            productId: item.product_id,
            quantity: Number(item.quantity) || 1,
          })),
      }))

      if (remoteCombos.length > 0) {
        saveComboMealsLocally(remoteCombos)
      } else if (localCombos.length > 0) {
        queueSupabaseSync(syncComboMealsToSupabase(localCombos))
      }
    }

    if (!addOnsResponse.error) {
      const remoteAddOns = (addOnsResponse.data || []).map((addOn: any) => ({
        id: addOn.id,
        name: addOn.name,
        price: Number(addOn.price) || 0,
        category: (addOn.category === "meal" ? "meal" : "drink") as AddOn["category"],
      }))

      if (remoteAddOns.length > 0) {
        const localAddOnMetadata = new Map(
          localAddOns.map((addOn) => [
            addOn.id,
            {
              ingredientId: addOn.ingredientId,
              productId: addOn.productId,
              quantity: addOn.quantity,
            },
          ])
        )
        saveAddOnsLocally(
          remoteAddOns.map((addOn) => ({
            ...addOn,
            ...localAddOnMetadata.get(addOn.id),
          }))
        )
      } else if (localAddOns.length > 0) {
        queueSupabaseSync(syncAddOnsToSupabase(localAddOns))
      }
    }
  } catch (error) {
    console.log("[v0] Initial Supabase store sync unavailable:", error)
  } finally {
    sessionStorage.removeItem(SUPABASE_SYNC_LOCK_KEY)
  }
}

// Ingredients functions
export function getIngredients(): Ingredient[] {
  if (typeof window === "undefined") return defaultIngredients.map(normalizeIngredient)
  const stored = localStorage.getItem(INGREDIENTS_KEY)
  if (!stored) {
    const seeded = syncIngredientAssignmentsWithProducts(defaultIngredients.map(normalizeIngredient), getProducts())
    localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(seeded))
    return seeded
  }

  const ingredients = JSON.parse(stored) as Ingredient[]
  const normalized = syncIngredientAssignmentsWithProducts(ingredients.map(normalizeIngredient), getProducts())
  localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(normalized))
  return normalized
}

export function saveIngredients(ingredients: Ingredient[]): void {
  if (typeof window === "undefined") return
  const normalized = ingredients.map(normalizeIngredient)
  saveIngredientsLocally(normalized)
  queueSupabaseSync(syncIngredientsToSupabase(normalized))
}

export function addIngredient(ingredient: Omit<Ingredient, "id">): Ingredient {
  const ingredients = getIngredients()
  const newId = Math.max(...ingredients.map((i) => i.id), 0) + 1
  const newIngredient = normalizeIngredient({
    ...ingredient,
    id: newId,
    productId: ingredient.productId || buildIngredientProductId(newId),
    assignedProducts: ingredient.assignedProducts || [],
  })
  ingredients.push(newIngredient)
  saveIngredients(ingredients)
  return newIngredient
}

export function updateIngredient(id: number, updates: Partial<Ingredient>): Ingredient | null {
  const ingredients = getIngredients()
  const index = ingredients.findIndex((i) => i.id === id)
  if (index === -1) return null

  ingredients[index] = normalizeIngredient({
    ...ingredients[index],
    ...updates,
    productId: updates.productId || ingredients[index].productId,
  })
  saveIngredients(ingredients)
  return ingredients[index]
}

export function addIngredientStock(id: number, quantity: number, expirationDate?: string | null): Ingredient | null {
  const ingredients = getIngredients()
  const index = ingredients.findIndex((i) => i.id === id)
  if (index === -1) return null

  const ingredient = normalizeIngredient(ingredients[index])
  const newBatch: StockBatch = {
    id: crypto.randomUUID(),
    quantity,
    dateAdded: new Date().toISOString(),
    expirationDate: expirationDate || null,
  }

  ingredient.stockBatches = [...(ingredient.stockBatches || []), newBatch]
  ingredient.stock = ingredient.stock + quantity
  ingredients[index] = normalizeIngredient(ingredient)
  saveIngredients(ingredients)
  return ingredients[index]
}

export function deductIngredientStockFIFO(id: number, quantity: number): { success: boolean; deducted: number } {
  const ingredients = getIngredients()
  const index = ingredients.findIndex((i) => i.id === id)
  if (index === -1) return { success: false, deducted: 0 }

  const ingredient = normalizeIngredient(ingredients[index])
  let remaining = quantity
  const updatedBatches = sortBatchesForFifo(ingredient.stockBatches || [])

  for (let i = 0; i < updatedBatches.length && remaining > 0; i++) {
    const batch = updatedBatches[i]
    if (isBatchExpired(batch)) continue
    if (batch.quantity > remaining) {
      batch.quantity -= remaining
      remaining = 0
    } else {
      remaining -= batch.quantity
      batch.quantity = 0
    }
  }

  ingredient.stockBatches = updatedBatches.filter((batch) => batch.quantity > 0)
  ingredients[index] = normalizeIngredient(ingredient)
  saveIngredients(ingredients)

  return { success: remaining === 0, deducted: quantity - remaining }
}

export function restoreIngredientStock(id: number, quantity: number, expirationDate?: string | null): Ingredient | null {
  return addIngredientStock(id, quantity, expirationDate || null)
}

export function consumeIngredientBatches(
  ingredientsList: Ingredient[],
  ingredientId: number,
  quantity: number
): Ingredient[] {
  return ingredientsList.map((ingredient) => {
    if (ingredient.id !== ingredientId) return normalizeIngredient(ingredient)

    const normalized = normalizeIngredient(ingredient)
    let remaining = quantity
    const stockBatches = sortBatchesForFifo(normalized.stockBatches || [])

    for (let i = 0; i < stockBatches.length && remaining > 0; i++) {
      const batch = stockBatches[i]
      if (isBatchExpired(batch)) continue
      if (batch.quantity > remaining) {
        batch.quantity -= remaining
        remaining = 0
      } else {
        remaining -= batch.quantity
        batch.quantity = 0
      }
    }

    return {
      ...normalized,
      stockBatches: stockBatches.filter((batch) => batch.quantity > 0),
      stock: stockBatches
        .filter((batch) => batch.quantity > 0 && !isBatchExpired(batch))
        .reduce((sum, batch) => sum + batch.quantity, 0),
    }
  })
}

export function deductCartIngredients(cartItems: CartItem[], ingredientsList: Ingredient[]): Ingredient[] {
  let updatedIngredients = ingredientsList.map(normalizeIngredient)

  cartItems.forEach((cartItem) => {
    cartItem.product.ingredients.forEach((pi) => {
      updatedIngredients = consumeIngredientBatches(updatedIngredients, pi.ingredientId, pi.quantity * cartItem.quantity)
    })
    ;(cartItem.addOns || []).forEach((addOn) => {
      if (!addOn.ingredientId || !addOn.quantity) return
      const selectedQuantity = addOn.selectedQuantity || 1
      updatedIngredients = consumeIngredientBatches(updatedIngredients, addOn.ingredientId, addOn.quantity * selectedQuantity * cartItem.quantity)
    })
  })

  return updatedIngredients.map(normalizeIngredient)
}

export function deleteIngredient(id: number): boolean {
  const ingredients = getIngredients()
  const filtered = ingredients.filter((i) => i.id !== id)
  if (filtered.length === ingredients.length) return false
  saveIngredients(filtered)
  return true
}

export function deductIngredients(products: Product[], ingredientsList: Ingredient[]): Ingredient[] {
  const cartItems = products.map((product) => ({ product, quantity: 1 }))
  return deductCartIngredients(cartItems, ingredientsList)
}

export function getProductAvailableStock(product: Product, ingredients: Ingredient[]): number {
  if (product.ingredients.length === 0) return 0

  const availableQuantities = product.ingredients.map((pi) => {
    const ingredient = ingredients.find((i) => i.id === pi.ingredientId)
    if (!ingredient) return 0
    return Math.floor(getIngredientExpirationSummary(ingredient).usableStock / pi.quantity)
  })

  return Math.min(...availableQuantities)
}

export function checkIngredientAvailability(product: Product, quantity: number, ingredients: Ingredient[]): { available: boolean; missingIngredients: string[] } {
  const missingIngredients: string[] = []

  for (const pi of product.ingredients) {
    const ingredient = ingredients.find((i) => i.id === pi.ingredientId)
    const availableStock = ingredient ? getIngredientExpirationSummary(ingredient).usableStock : 0
    if (!ingredient || availableStock < pi.quantity * quantity) {
      if (ingredient) {
        missingIngredients.push(`${ingredient.name} (need ${pi.quantity * quantity} ${ingredient.unit}, have ${availableStock})`)
      }
    }
  }

  return { available: missingIngredients.length === 0, missingIngredients }
}

// Products functions
export function getProducts(): Product[] {
  if (typeof window === "undefined") return defaultProducts
  const stored = localStorage.getItem(PRODUCTS_KEY)
  if (!stored) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(defaultProducts))
    return defaultProducts
  }
  const products = JSON.parse(stored) as Array<Product & { category?: string }>
  const normalizedProducts = products.map((p) => ({
    ...p,
    category: (p.category as string) === "Pastry" ? "Fruit Tea" : p.category,
    ingredients: p.ingredients || [],
  }))
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(normalizedProducts))
  return normalizedProducts
}

export function saveProducts(products: Product[]): void {
  if (typeof window === "undefined") return
  saveProductsLocally(products)
  queueSupabaseSync(syncProductsToSupabase(products))
}

export function addProduct(product: Omit<Product, "id">): Product {
  const products = getProducts()
  const newId = Math.max(...products.map((p) => p.id), 0) + 1
  const newProduct = { ...product, id: newId, ingredients: product.ingredients || [] }
  products.push(newProduct)
  saveProducts(products)
  return newProduct
}

export function updateProduct(id: number, updates: Partial<Product>): Product | null {
  const products = getProducts()
  const index = products.findIndex((p) => p.id === id)
  if (index === -1) return null
  products[index] = { ...products[index], ...updates }
  saveProducts(products)
  return products[index]
}

export function deleteProduct(id: number): boolean {
  const products = getProducts()
  const filtered = products.filter((p) => p.id !== id)
  if (filtered.length === products.length) return false
  saveProducts(filtered)
  return true
}

// Transactions functions
export async function getTransactions(): Promise<Transaction[]> {
  if (typeof window === "undefined") return []

  try {
    const { createClient } = await import("./supabase/client")
    const supabase = createClient()

    const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false })

    if (!error && data && data.length > 0) {
      const mapped = data.map((t: any) => ({
        id: t.transaction_number || t.id || `#${Math.random().toString().slice(2, 7)}`,
        date: t.date,
        time: t.time,
        items: typeof t.items === "string" ? JSON.parse(t.items) : t.items,
        subtotal: t.subtotal,
        discountType: t.discount_type === "senior" || t.discount_type === "pwd" ? t.discount_type : "none",
        discountPercent: t.discount_percent || 0,
        discountAmount: t.discount_amount || 0,
        total: t.total,
        paymentMethod: t.payment_method === "gcash" ? "gcash" : "cash",
        cashReceived: t.cash_received,
        change: t.change_amount || 0,
        processedBy: t.processed_by || "Unknown",
        voided: t.voided || false,
      })) as Transaction[]

      return getNormalizedTransactions(mapped)
    }
  } catch (error) {
    console.log("[v0] Supabase fetch failed:", error)
  }

  const stored = localStorage.getItem(TRANSACTIONS_KEY)
  return stored ? getNormalizedTransactions(JSON.parse(stored)) : []
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  if (typeof window === "undefined") return

  const normalizedTransaction: Transaction = {
    ...transaction,
    discountType: transaction.discountType === "senior" || transaction.discountType === "pwd" ? transaction.discountType : "none",
    discountPercent:
      transaction.discountType === "senior" || transaction.discountType === "pwd"
        ? transaction.discountPercent || 20
        : 0,
    discountAmount: transaction.discountAmount || 0,
    paymentMethod: transaction.paymentMethod === "gcash" ? "gcash" : "cash",
    change: transaction.change || 0,
  }

  try {
    const currentUser = getCurrentUser()

    if (!currentUser) {
      saveToLocalStorage(normalizedTransaction)
      return
    }

    const { createClient } = await import("./supabase/client")
    const supabase = createClient()

    const transactionData = {
      transaction_number: normalizedTransaction.id,
      date: normalizedTransaction.date,
      time: normalizedTransaction.time,
      items: JSON.stringify(normalizedTransaction.items),
      subtotal: normalizedTransaction.subtotal,
      total: normalizedTransaction.total,
      payment_method: normalizedTransaction.paymentMethod,
      cash_received: normalizedTransaction.cashReceived,
      change_amount: normalizedTransaction.change,
      discount_type: normalizedTransaction.discountType,
      discount_percent: normalizedTransaction.discountPercent,
      discount_amount: normalizedTransaction.discountAmount,
      processed_by: normalizedTransaction.processedBy || currentUser.username,
      voided: normalizedTransaction.voided || false,
    }

    const { error } = await supabase.from("transactions").insert([transactionData]).select()

    if (error) {
      console.log("[v0] Supabase save ERROR:", {
        message: error.message,
        code: error.code,
        details: error.details,
      })
    }

    saveToLocalStorage(normalizedTransaction)
  } catch (error) {
    console.log("[v0] Error saving to Supabase:", error)
    saveToLocalStorage(normalizedTransaction)
  }
}

function saveToLocalStorage(transaction: Transaction): void {
  const transactions = localStorage.getItem(TRANSACTIONS_KEY)
  const list = transactions ? (JSON.parse(transactions) as Transaction[]) : []
  list.push(transaction)
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(getNormalizedTransactions(list)))
}

function normalizeDateString(value: string) {
  if (!value) return ""

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""

  return parsed.toISOString().split("T")[0]
}

export async function getTransactionsByDate(date: string): Promise<Transaction[]> {
  return getTransactionsByDateRange(date, date)
}

export async function getTransactionsByDateRange(fromDate: string, toDate: string): Promise<Transaction[]> {
  const transactions = await getTransactions()
  const normalizedFrom = normalizeDateString(fromDate)
  const normalizedTo = normalizeDateString(toDate)
  if (!normalizedFrom || !normalizedTo) return []
  return transactions.filter((t) => t.date >= normalizedFrom && t.date <= normalizedTo && !t.voided)
}

export async function getDailySales(date: string): Promise<number> {
  const transactions = await getTransactionsByDate(date)
  return transactions.reduce((sum, t) => sum + t.total, 0)
}

export async function getSalesTotalByDateRange(fromDate: string, toDate: string): Promise<number> {
  const transactions = await getTransactionsByDateRange(fromDate, toDate)
  return transactions.reduce((sum, t) => sum + t.total, 0)
}

export async function getMonthlySales(year: number, month: number): Promise<number> {
  const transactions = await getTransactions()
  return transactions
    .filter((t) => {
      const d = new Date(t.date)
      return d.getFullYear() === year && d.getMonth() === month && !t.voided
    })
    .reduce((sum, t) => sum + t.total, 0)
}

export async function getWeeklySales(year: number, week: number): Promise<number> {
  const transactions = await getTransactions()
  return transactions
    .filter((t) => {
      const d = new Date(t.date)
      const weekNum = getWeekNumber(d)
      return d.getFullYear() === year && weekNum === week && !t.voided
    })
    .reduce((sum, t) => sum + t.total, 0)
}

export async function getYearlySales(year: number): Promise<number> {
  const transactions = await getTransactions()
  return transactions
    .filter((t) => {
      const d = new Date(t.date)
      return d.getFullYear() === year && !t.voided
    })
    .reduce((sum, t) => sum + t.total, 0)
}

export async function voidTransaction(transactionId: string, voidedBy: string, ingredients: Ingredient[]): Promise<{ success: boolean; updatedIngredients: Ingredient[] }> {
  try {
    const currentUser = getCurrentUser()

    if (!currentUser) {
      return { success: false, updatedIngredients: ingredients }
    }

    const { createClient } = await import("./supabase/client")
    const supabase = createClient()

    const { error } = await supabase
      .from("transactions")
      .update({
        voided: true,
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_number", transactionId)

    if (error) {
      console.log("[v0] Failed to void transaction in Supabase:", error.message)
      return { success: false, updatedIngredients: ingredients }
    }
  } catch (error) {
    console.log("[v0] Error voiding transaction:", error)
    return { success: false, updatedIngredients: ingredients }
  }

  const updatedIngredients = ingredients.map(normalizeIngredient)
  const allTransactions = await getTransactions()
  const transaction = allTransactions.find((t) => t.id === transactionId)

  if (transaction) {
    transaction.items.forEach((cartItem) => {
      cartItem.product.ingredients.forEach((pi) => {
        const ingredientIndex = updatedIngredients.findIndex((i) => i.id === pi.ingredientId)
        if (ingredientIndex !== -1) {
          const restoredQuantity = pi.quantity * cartItem.quantity
          updatedIngredients[ingredientIndex] = normalizeIngredient({
            ...updatedIngredients[ingredientIndex],
            stock: updatedIngredients[ingredientIndex].stock + restoredQuantity,
            stockBatches: [
              ...(updatedIngredients[ingredientIndex].stockBatches || []),
              {
                id: crypto.randomUUID(),
                quantity: restoredQuantity,
                dateAdded: new Date().toISOString(),
                expirationDate: null,
              },
            ],
          })
        }
      })
      ;(cartItem.addOns || []).forEach((addOn) => {
        if (!addOn.ingredientId || !addOn.quantity) return
        const ingredientIndex = updatedIngredients.findIndex((i) => i.id === addOn.ingredientId)
        if (ingredientIndex !== -1) {
          const selectedQuantity = addOn.selectedQuantity || 1
          const restoredQuantity = addOn.quantity * selectedQuantity * cartItem.quantity
          updatedIngredients[ingredientIndex] = normalizeIngredient({
            ...updatedIngredients[ingredientIndex],
            stock: updatedIngredients[ingredientIndex].stock + restoredQuantity,
            stockBatches: [
              ...(updatedIngredients[ingredientIndex].stockBatches || []),
              {
                id: crypto.randomUUID(),
                quantity: restoredQuantity,
                dateAdded: new Date().toISOString(),
                expirationDate: null,
              },
            ],
          })
        }
      })
    })
  }

  return { success: true, updatedIngredients }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// Debug function to verify all stored data
export function verifyDataPersistence(): void {
  if (typeof window === "undefined") return
  const transactions = localStorage.getItem(TRANSACTIONS_KEY)
  const products = localStorage.getItem(PRODUCTS_KEY)
  const ingredients = localStorage.getItem(INGREDIENTS_KEY)

  console.log("[v0] Data Persistence Check:")
  console.log("[v0] Transactions stored:", transactions ? JSON.parse(transactions).length : 0)
  console.log("[v0] Products stored:", products ? JSON.parse(products).length : 0)
  console.log("[v0] Ingredients stored:", ingredients ? JSON.parse(ingredients).length : 0)

  if (transactions) {
    const txList = JSON.parse(transactions)
    console.log("[v0] All transactions:", txList.map((t: Transaction) => ({ id: t.id, date: t.date, total: t.total })))
  }
}

// Password validation
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (password.length < 8 || password.length > 30) {
    errors.push("Password must be 8 to 30 characters")
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    errors.push("Password must contain both lower and uppercase letters")
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain a number")
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain a special character")
  }

  const forbiddenSequences = ["abc", "bcd", "cde", "def", "efg", "fgh", "ghi", "hij", "ijk", "jkl", "klm", "lmn", "mno", "nop", "opq", "pqr", "qrs", "rst", "stu", "tuv", "uvw", "vwx", "wxy", "xyz", "123", "234", "345", "456", "567", "678", "789", "0123", "1234", "2345", "3456", "4567", "5678", "6789", "11", "22", "33", "44", "55", "66", "77", "88", "99", "00", "qwerty", "asdf", "zxcv"]

  const lowerPassword = password.toLowerCase()
  if (forbiddenSequences.some((seq) => lowerPassword.includes(seq))) {
    errors.push("Password contains forbidden sequences")
  }

  return { valid: errors.length === 0, errors }
}

// Auth functions
export type UserRole = "admin" | "employee" | "cashier"

export interface AuthUser {
  id: string
  username: string
  email: string
  role: UserRole
}

export function persistAuthSession(user: AuthUser, rememberMe: boolean): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(AUTH_KEY)
  sessionStorage.removeItem(CURRENT_USER_KEY)
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(CURRENT_USER_KEY)

  const storage = getAuthStorage(rememberMe)
  storage.setItem(AUTH_KEY, "true")
  storage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  return readStoredAuth(AUTH_KEY) === "true"
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  const userStr = readStoredAuth(CURRENT_USER_KEY)
  if (!userStr) return null
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

export function getUserRole(): UserRole {
  const user = getCurrentUser()
  return user?.role || "employee"
}

export function isAdmin(): boolean {
  return getUserRole() === "admin"
}

export function login(username: string, password: string, rememberMe: boolean = true): boolean {
  if (username === "admin" && password === "password") {
    persistAuthSession(
      {
        id: "admin",
        username: "admin",
        email: "admin@alfresco.com",
        role: "admin",
      },
      rememberMe
    )
    return true
  }
  return false
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function register(
  username: string,
  email: string,
  password: string,
  userId?: string,
  role: UserRole = "employee"
): { success: boolean; error?: string } {
  if (username === "admin") {
    return { success: false, error: "Username already exists" }
  }

  if (!validateEmail(email)) {
    return { success: false, error: "Invalid email address" }
  }

  const validation = validatePassword(password)
  if (!validation.valid) {
    return { success: false, error: validation.errors[0] }
  }

  persistAuthSession(
    {
      id: userId || crypto.randomUUID(),
      username,
      email,
      role,
    },
    true
  )
  return { success: true }
}

export function logout(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(CURRENT_USER_KEY)
  sessionStorage.removeItem(AUTH_KEY)
  sessionStorage.removeItem(CURRENT_USER_KEY)
}

// Combo Meal functions
export function getComboMeals(): ComboMeal[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(COMBOS_KEY)
  if (!stored) return []

  const combos = JSON.parse(stored) as ComboMeal[]
  return combos.map((combo) => ({
    ...combo,
    items: combo.items.map((item) => ({
      ingredientId: item.ingredientId,
      productId: item.productId,
      quantity: item.quantity,
    })),
  }))
}

export function saveComboMeals(combos: ComboMeal[]): void {
  if (typeof window === "undefined") return
  saveComboMealsLocally(combos)
  queueSupabaseSync(syncComboMealsToSupabase(combos))
}

export function addComboMeal(combo: Omit<ComboMeal, "id">): ComboMeal {
  const combos = getComboMeals()
  const newId = combos.length > 0 ? Math.max(...combos.map((c) => c.id)) + 1 : 1
  const newCombo: ComboMeal = { ...combo, id: newId }
  combos.push(newCombo)
  saveComboMeals(combos)
  return newCombo
}

export function updateComboMeal(id: number, updates: Partial<ComboMeal>): ComboMeal | null {
  const combos = getComboMeals()
  const index = combos.findIndex((c) => c.id === id)
  if (index === -1) return null
  combos[index] = { ...combos[index], ...updates }
  saveComboMeals(combos)
  return combos[index]
}

export function deleteComboMeal(id: number): boolean {
  const combos = getComboMeals()
  const filtered = combos.filter((c) => c.id !== id)
  if (filtered.length === combos.length) return false
  saveComboMeals(filtered)
  return true
}

const defaultAddOns: AddOn[] = [
  { id: "coffee-1", name: "Extra Shot", price: 30, category: "drink", ingredientId: 9, productId: "ING-009", quantity: 2 },
  { id: "coffee-2", name: "Vanilla Syrup", price: 25, category: "drink" },
  { id: "coffee-3", name: "Caramel Drizzle", price: 25, category: "drink" },
  { id: "coffee-4", name: "Whipped Cream", price: 20, category: "drink" },
  { id: "milktea-1", name: "Pearl (Boba)", price: 20, category: "drink" },
  { id: "milktea-2", name: "Nata de Coco", price: 15, category: "drink" },
  { id: "milktea-3", name: "Pudding", price: 25, category: "drink" },
  { id: "milktea-4", name: "Cream Cheese", price: 30, category: "drink" },
  { id: "meal-1", name: "Extra Rice", price: 20, category: "meal", ingredientId: 1, productId: "ING-001", quantity: 1 },
  { id: "meal-2", name: "Extra Egg", price: 25, category: "meal", ingredientId: 2, productId: "ING-002", quantity: 1 },
  { id: "meal-3", name: "Atchara", price: 15, category: "meal" },
  { id: "meal-4", name: "Gravy", price: 15, category: "meal" },
]

export function getAddOns(): AddOn[] {
  if (typeof window === "undefined") return defaultAddOns
  const stored = localStorage.getItem(ADDONS_KEY)
  if (!stored) {
    localStorage.setItem(ADDONS_KEY, JSON.stringify(defaultAddOns))
    return defaultAddOns
  }
  return (JSON.parse(stored) as AddOn[]).map((addOn) => ({
    ...addOn,
    quantity: addOn.quantity ?? 0,
  }))
}

export function saveAddOns(addOns: AddOn[]): void {
  if (typeof window === "undefined") return
  saveAddOnsLocally(addOns)
  queueSupabaseSync(syncAddOnsToSupabase(addOns))
}

export function addAddOn(addOn: Omit<AddOn, "id">): AddOn {
  const addOns = getAddOns()
  const newId = `addon-${Date.now()}`
  const newAddOn: AddOn = { ...addOn, id: newId }
  addOns.push(newAddOn)
  saveAddOns(addOns)
  return newAddOn
}

export function updateAddOn(id: string, updates: Partial<AddOn>): AddOn | null {
  const addOns = getAddOns()
  const index = addOns.findIndex((a) => a.id === id)
  if (index === -1) return null
  addOns[index] = { ...addOns[index], ...updates }
  saveAddOns(addOns)
  return addOns[index]
}

export function deleteAddOn(id: string): boolean {
  const addOns = getAddOns()
  const filtered = addOns.filter((a) => a.id !== id)
  if (filtered.length === addOns.length) return false
  saveAddOns(filtered)
  return true
}

export function getAddOnsByCategory(category: "drink" | "meal"): AddOn[] {
  return getAddOns().filter((a) => a.category === category)
}

// Analytics functions
export interface SalesOverTimePoint {
  date: string
  day: string
  sales: number
}

export interface SalesByCategory {
  category: string
  sales: number
  percentage: number
  color: string
}

export interface TopProduct {
  name: string
  quantity: number
  revenue: number
}

export interface PeakHour {
  hour: string
  orders: number
  percentage: number
}

export async function getSalesOverTime(startDate: Date, endDate: Date): Promise<SalesOverTimePoint[]> {
  const transactions = await getTransactions()
  const dailySales: Record<string, number> = {}

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0]
    dailySales[dateStr] = 0
  }

  transactions.forEach((t) => {
    if (t.date >= startDate.toISOString().split("T")[0] && t.date <= endDate.toISOString().split("T")[0] && !t.voided) {
      dailySales[t.date] = (dailySales[t.date] || 0) + t.total
    }
  })

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  return Object.entries(dailySales).map(([date, sales]) => ({
    date,
    day: days[new Date(date).getDay()],
    sales: Math.round(sales * 100) / 100,
  }))
}

export async function getSalesByCategory(startDate: Date, endDate: Date): Promise<SalesByCategory[]> {
  const transactions = await getTransactions()
  const categorySales: Record<string, number> = {}
  const products = getProducts()

  const categoryColors: Record<string, string> = {
    Coffee: "#4A342A",
    "Milk Tea": "#7D5A44",
    "Fruit Tea": "#B2967D",
    Silog: "#D7C9B8",
  }

  transactions.forEach((t) => {
    if (t.date >= startDate.toISOString().split("T")[0] && t.date <= endDate.toISOString().split("T")[0] && !t.voided) {
      t.items.forEach((item) => {
        const product = products.find((p) => p.id === item.product.id)
        if (product) {
          const category = product.category
          const itemRevenue =
            item.quantity *
            (item.product.price + (item.addOns || []).reduce((sum, addon) => sum + addon.price * (addon.selectedQuantity || 1), 0))
          categorySales[category] = (categorySales[category] || 0) + itemRevenue
        }
      })
    }
  })

  const total = Object.values(categorySales).reduce((a, b) => a + b, 0)

  return Object.entries(categorySales)
    .map(([category, sales]) => ({
      category,
      sales: Math.round(sales * 100) / 100,
      percentage: total > 0 ? Math.round((sales / total) * 100) : 0,
      color: categoryColors[category] || "#4A342A",
    }))
    .sort((a, b) => b.sales - a.sales)
}

export async function getTopProducts(startDate: Date, endDate: Date, limit: number = 10): Promise<TopProduct[]> {
  const transactions = await getTransactions()
  const productSales: Record<number, { quantity: number; revenue: number; name: string }> = {}
  const products = getProducts()

  transactions.forEach((t) => {
    if (t.date >= startDate.toISOString().split("T")[0] && t.date <= endDate.toISOString().split("T")[0] && !t.voided) {
      t.items.forEach((item) => {
        const product = products.find((p) => p.id === item.product.id)
        if (product) {
          if (!productSales[product.id]) {
            productSales[product.id] = { quantity: 0, revenue: 0, name: product.name }
          }
          productSales[product.id].quantity += item.quantity
          productSales[product.id].revenue +=
            item.quantity *
            (item.product.price + (item.addOns || []).reduce((sum, addon) => sum + addon.price * (addon.selectedQuantity || 1), 0))
        }
      })
    }
  })

  return Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit)
    .map((p) => ({ name: p.name, quantity: p.quantity, revenue: Math.round(p.revenue * 100) / 100 }))
}

export async function getPeakHours(startDate: Date, endDate: Date): Promise<PeakHour[]> {
  const transactions = await getTransactions()
  const hourCounts: Record<number, number> = {}

  for (let i = 0; i < 24; i++) {
    hourCounts[i] = 0
  }

  transactions.forEach((t) => {
    if (t.date >= startDate.toISOString().split("T")[0] && t.date <= endDate.toISOString().split("T")[0] && !t.voided) {
      const hour = parseInt(t.time.split(":")[0], 10)
      if (!Number.isNaN(hour)) {
        hourCounts[hour]++
      }
    }
  })

  const maxOrders = Math.max(...Object.values(hourCounts))
  const result: PeakHour[] = []

  for (let i = 0; i < 24; i++) {
    const orders = hourCounts[i]
    if (orders > 0) {
      result.push({
        hour: `${i.toString().padStart(2, "0")}:00`,
        orders,
        percentage: maxOrders > 0 ? (orders / maxOrders) * 100 : 0,
      })
    }
  }

  return result
}
