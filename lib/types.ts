export interface StockBatch {
  id: string
  quantity: number
  dateAdded: string // ISO date string when stock was added
}

export interface Ingredient {
  id: number
  name: string
  unit: string
  stock: number
  stockBatches?: StockBatch[] // FIFO batches for stock tracking
  assignedProducts: number[] // Product IDs this ingredient is assigned to
}

export interface ProductIngredient {
  ingredientId: number
  quantity: number
}

export interface Product {
  id: number
  name: string
  category: "Coffee" | "Milk Tea" | "Fruit Tea" | "Silog"
  price: number
  ingredients: ProductIngredient[]
}

export interface AddOn {
  id: string
  name: string
  price: number
  category: "drink" | "meal"
}

export interface ComboMeal {
  id: number
  name: string
  description: string
  price: number
  items: {
    productId: number
    quantity: number
  }[]
}

export interface CartItem {
  product: Product
  quantity: number
  addOns?: AddOn[]
}

export interface Transaction {
  id: string
  items: CartItem[]
  subtotal: number
  vatAmount: number
  discountType?: "none" | "senior" | "pwd" | "custom"
  discountPercent?: number
  discountAmount: number
  total: number
  paymentMethod: "cash" | "gcash" | "card" | "grab_pay"
  cashReceived: number
  change: number
  processedBy: string
  date: string
  time: string
  voided?: boolean
  voidedAt?: string
  voidedBy?: string
}
