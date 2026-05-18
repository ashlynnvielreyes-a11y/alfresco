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

export interface ExpirationLog {
  id: string
  ingredientId: number
  ingredientName: string
  batchId: string
  quantity: number
  expirationDate: string
  loggedAt: string
}

export interface ProductExpirationLog {
  id: string
  productId: number
  productName: string
  productCategory: string
  ingredientId: number
  ingredientName: string
  batchId: string
  quantity: number
  expirationDate: string
  loggedAt: string
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

export type KnownProductCategory = "Coffee" | "Milk Tea" | "Fruit Soda" | "Silog"
export type ProductCategory = KnownProductCategory | (string & {})

export interface Product {
  id: number
  name: string
  category: ProductCategory
  price: number
  ingredients: ProductIngredient[]
  isArchived?: boolean
}

export interface AddOn {
  id: string
  name: string
  price: number
  category: "drink" | "meal"
  isArchived?: boolean
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
  isArchived?: boolean
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
  comboMeal?: ComboMeal
  notes?: string | null
}

export interface Transaction {
  id: string
  items: CartItem[]
  queueNumber?: string | null
  customerName?: string | null
  subtotal: number
  discountType?: "none" | "senior" | "pwd"
  discountPercent?: number
  discountAmount: number
  taxAmount?: number
  total: number
  paymentMethod: "cash" | "gcash"
  cashReceived: number
  change: number
  processedBy: string
  notes?: string | null
  orderStatus?: "pending" | "completed" | "voided" | "cancelled"
  date: string
  time: string
  voided?: boolean
  voidedAt?: string
  voidedBy?: string
}

export interface ActiveOrder {
  id: string
  cashierUserId: string
  cashierName: string
  stationId: string
  items: CartItem[]
  subtotal: number
  discountType?: "none" | "senior" | "pwd"
  discountPercent?: number
  discountAmount: number
  total: number
  paymentMethod: "cash" | "gcash"
  cartItemCount: number
  startedAt: string
  lastUpdatedAt: string
}

export type AppUserRole = "admin" | "cashier" | "inventory_staff"

export interface AppUser {
  id: string
  username: string
  email: string
  role: AppUserRole
  isActive: boolean
  createdAt?: string | null
  updatedAt?: string | null
  deactivatedAt?: string | null
}

export interface AuditLog {
  id: string
  actorUserId: string
  actorUsername: string
  action: string
  entityType: string
  entityId: string
  details?: string | null
  createdAt: string
}
