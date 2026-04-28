export interface StockBatch {
  id: string
  quantity: number
  dateAdded: string // ISO date string when stock was added
  expirationDate?: string | null
}

export interface IngredientExpirationSummary {
  usableStock: number
  expiredStock: number
  nextBatchId: string | null
  nextDateAdded: string | null
  nextExpirationDate: string | null
  displayBatchId: string | null
  displayExpirationDate: string | null
  expirationStatus: "expired" | "near-expiry" | "safe" | "none"
  nearExpirationBatches: StockBatch[]
  expiredBatches: StockBatch[]
}

export interface InventoryAlerts {
  lowStockIngredients: Ingredient[]
  expiringSoonIngredients: Ingredient[]
  expiredIngredients: Ingredient[]
}

export interface Ingredient {
  id: number
  productId: string
  name: string
  unit: string
  stock: number
  expirationDate?: string | null
  stockBatches?: StockBatch[] // FIFO batches for stock tracking
  assignedProducts: number[] // Product IDs this ingredient is assigned to
}

export interface ProductIngredient {
  ingredientId: number
  quantity: number
}

export type KnownProductCategory = "Coffee" | "Milk Tea" | "Fruit Tea" | "Silog"
export type ProductCategory = KnownProductCategory | (string & {})

export interface Product {
  id: number
  name: string
  category: ProductCategory
  price: number
  ingredients: ProductIngredient[]
}

export interface AddOn {
  id: string
  name: string
  price: number
  category: "drink" | "meal"
  ingredientId?: number
  productId?: string
  quantity?: number
  selectedQuantity?: number
}

export interface ComboMeal {
  id: number
  name: string
  description: string
  price: number
  items: {
    ingredientId?: number
    productId: number
    quantity: number
  }[]
}

export type CoffeeTemperature = "hot" | "cold"

export interface CartItem {
  product: Product
  quantity: number
  temperature?: CoffeeTemperature
  addOns?: AddOn[]
}

export interface Transaction {
  id: string
  items: CartItem[]
  subtotal: number
  discountType?: "none" | "senior" | "pwd"
  discountPercent?: number
  discountAmount: number
  total: number
  paymentMethod: "cash" | "gcash"
  cashReceived: number
  change: number
  processedBy: string
  date: string
  time: string
  voided?: boolean
  voidedAt?: string
  voidedBy?: string
}
