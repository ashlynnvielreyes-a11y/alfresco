"use client"

import type { Product, Transaction, Ingredient, StockBatch, ComboMeal, AddOn } from "./types"

const PRODUCTS_KEY = "alfresco_products"
const TRANSACTIONS_KEY = "alfresco_transactions"
const INGREDIENTS_KEY = "alfresco_ingredients"
const AUTH_KEY = "alfresco_auth"
const COMBOS_KEY = "alfresco_combos"
const ADDONS_KEY = "alfresco_addons"

const defaultIngredients: Ingredient[] = [
  { id: 1, name: "Rice", unit: "cups", stock: 100, assignedProducts: [7, 8, 9, 10, 11, 12] },
  { id: 2, name: "Eggs", unit: "pcs", stock: 50, assignedProducts: [7, 8, 9, 10, 11, 12] },
  { id: 3, name: "Tapa (Beef)", unit: "pcs", stock: 30, assignedProducts: [7] },
  { id: 4, name: "Longganisa", unit: "pcs", stock: 40, assignedProducts: [10] },
  { id: 5, name: "Hotdog", unit: "pcs", stock: 35, assignedProducts: [9] },
  { id: 6, name: "Bangus", unit: "pcs", stock: 25, assignedProducts: [11] },
  { id: 7, name: "Pork", unit: "pcs", stock: 20, assignedProducts: [8] },
  { id: 8, name: "Spam", unit: "pcs", stock: 30, assignedProducts: [12] },
  { id: 9, name: "Espresso Shot", unit: "shots", stock: 100, assignedProducts: [1, 2, 3] },
  { id: 10, name: "Milk", unit: "ml", stock: 5000, assignedProducts: [2, 3, 4, 5, 6] },
  { id: 11, name: "White Chocolate Syrup", unit: "ml", stock: 1000, assignedProducts: [3] },
  { id: 12, name: "Caramel Syrup", unit: "ml", stock: 1000, assignedProducts: [2] },
  { id: 13, name: "Black Tea", unit: "bags", stock: 50, assignedProducts: [4, 5, 6] },
  { id: 14, name: "Strawberry Syrup", unit: "ml", stock: 800, assignedProducts: [5] },
  { id: 15, name: "Matcha Powder", unit: "g", stock: 500, assignedProducts: [6] },
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

// Ingredients functions
export function getIngredients(): Ingredient[] {
  if (typeof window === "undefined") return defaultIngredients
  const stored = localStorage.getItem(INGREDIENTS_KEY)
  if (!stored) {
    localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(defaultIngredients))
    return defaultIngredients
  }
  const ingredients = JSON.parse(stored)
  // Ensure all ingredients have assignedProducts array
  return ingredients.map((i: Ingredient) => ({
    ...i,
    assignedProducts: i.assignedProducts || []
  }))
}

export function saveIngredients(ingredients: Ingredient[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(ingredients))
}

export function addIngredient(ingredient: Omit<Ingredient, "id">): Ingredient {
  const ingredients = getIngredients()
  const newId = Math.max(...ingredients.map((i) => i.id), 0) + 1
  const newIngredient = { ...ingredient, id: newId, assignedProducts: ingredient.assignedProducts || [] }
  ingredients.push(newIngredient)
  saveIngredients(ingredients)
  return newIngredient
}

export function updateIngredient(id: number, updates: Partial<Ingredient>): Ingredient | null {
  const ingredients = getIngredients()
  const index = ingredients.findIndex((i) => i.id === id)
  if (index === -1) return null
  ingredients[index] = { ...ingredients[index], ...updates }
  saveIngredients(ingredients)
  return ingredients[index]
}

export function addIngredientStock(id: number, quantity: number): Ingredient | null {
  const ingredients = getIngredients()
  const index = ingredients.findIndex((i) => i.id === id)
  if (index === -1) return null
  
  const ingredient = ingredients[index]
  const updatedIngredient = { ...ingredient }
  
  // Initialize stockBatches if it doesn't exist
  if (!updatedIngredient.stockBatches) {
    updatedIngredient.stockBatches = []
  }
  
  // Add new batch with current date
  const newBatch: StockBatch = {
    id: crypto.randomUUID(),
    quantity: quantity,
    dateAdded: new Date().toISOString()
  }
  
  updatedIngredient.stockBatches.push(newBatch)
  updatedIngredient.stock = updatedIngredient.stock + quantity
  
  ingredients[index] = updatedIngredient
  saveIngredients(ingredients)
  return ingredients[index]
}

export function deductIngredientStockFIFO(id: number, quantity: number): { success: boolean; deducted: number } {
  const ingredients = getIngredients()
  const index = ingredients.findIndex((i) => i.id === id)
  if (index === -1) return { success: false, deducted: 0 }
  
  const ingredient = ingredients[index]
  if (!ingredient.stockBatches) {
    ingredient.stockBatches = []
  }
  
  let remaining = quantity
  const updatedBatches = [...ingredient.stockBatches].sort((a, b) => 
    new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime()
  )
  
  // Process FIFO: deduct from oldest batches first
  for (let i = 0; i < updatedBatches.length && remaining > 0; i++) {
    if (updatedBatches[i].quantity > remaining) {
      updatedBatches[i].quantity -= remaining
      remaining = 0
    } else {
      remaining -= updatedBatches[i].quantity
      updatedBatches[i].quantity = 0
    }
  }
  
  // Remove empty batches
  ingredient.stockBatches = updatedBatches.filter(b => b.quantity > 0)
  ingredient.stock = Math.max(0, ingredient.stock - quantity)
  
  ingredients[index] = ingredient
  saveIngredients(ingredients)
  
  return { success: true, deducted: quantity - remaining }
}

export function deleteIngredient(id: number): boolean {
  const ingredients = getIngredients()
  const filtered = ingredients.filter((i) => i.id !== id)
  if (filtered.length === ingredients.length) return false
  saveIngredients(filtered)
  return true
}

export function deductIngredients(products: Product[], ingredientsList: Ingredient[]): Ingredient[] {
  const updatedIngredients = [...ingredientsList]
  
  products.forEach((product) => {
    // Deduct ingredients assigned to this product
    updatedIngredients.forEach((ingredient, index) => {
      if (ingredient.assignedProducts.includes(product.id)) {
        // Find the quantity needed from the product's ingredient list
        const productIngredient = product.ingredients.find((pi) => pi.ingredientId === ingredient.id)
        if (productIngredient) {
          updatedIngredients[index] = {
            ...ingredient,
            stock: Math.max(0, ingredient.stock - productIngredient.quantity)
          }
        }
      }
    })
  })
  
  return updatedIngredients
}

export function getProductAvailableStock(product: Product, ingredients: Ingredient[]): number {
  if (product.ingredients.length === 0) return 0
  
  // Find the limiting ingredient - the one that runs out first
  const availableQuantities = product.ingredients.map((pi) => {
    const ingredient = ingredients.find((i) => i.id === pi.ingredientId)
    if (!ingredient) return 0
    return Math.floor(ingredient.stock / pi.quantity)
  })
  
  return Math.min(...availableQuantities)
}

export function checkIngredientAvailability(product: Product, quantity: number, ingredients: Ingredient[]): { available: boolean; missingIngredients: string[] } {
  const missingIngredients: string[] = []
  
  for (const pi of product.ingredients) {
    const ingredient = ingredients.find((i) => i.id === pi.ingredientId)
    if (!ingredient || ingredient.stock < pi.quantity * quantity) {
      if (ingredient) {
        missingIngredients.push(`${ingredient.name} (need ${pi.quantity * quantity} ${ingredient.unit}, have ${ingredient.stock})`)
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
  const products = JSON.parse(stored)
  // Ensure all products have ingredients array
  return products.map((p: Product) => ({
    ...p,
    ingredients: p.ingredients || []
  }))
}

export function saveProducts(products: Product[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products))
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
    // Try to get from Supabase - fetch ALL transactions (across all users/accounts)
    const { createClient } = await import('./supabase/client')
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data && data.length > 0) {
      const mapped = data.map((t: any) => ({
        id: t.transaction_number || t.id || `#${Math.random().toString().slice(2, 7)}`,
        date: t.date,
        time: t.time,
        items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items,
        subtotal: t.subtotal,
        vatAmount: t.tax,
        discountType: t.discount_type,
        discountPercent: t.discount_percent,
        discountAmount: t.discount_amount,
        total: t.total,
        paymentMethod: t.payment_method,
        cashReceived: t.cash_received,
        change: t.change_amount,
        processedBy: t.processed_by || 'Unknown',
        voided: t.voided || false
      })) as Transaction[]
      
      return mapped
    }
  } catch (error) {
    console.log("[v0] Supabase fetch failed:", error)
  }
  
  // Fallback to localStorage
  const stored = localStorage.getItem(TRANSACTIONS_KEY)
  return stored ? JSON.parse(stored) : []
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  if (typeof window === "undefined") return
  
  try {
    // Get the current local user
    const currentUser = getCurrentUser()
    
    console.log("[v0] saveTransaction started - currentUser:", currentUser?.username)
    
    if (!currentUser) {
      console.log("[v0] No current user, saving to localStorage only")
      saveToLocalStorage(transaction)
      return
    }
    
    // Try to save to Supabase
    const { createClient } = await import('./supabase/client')
    const supabase = createClient()
    
    const transactionData = {
      transaction_number: transaction.id,
      date: transaction.date,
      time: transaction.time,
      items: JSON.stringify(transaction.items),
      subtotal: transaction.subtotal,
      tax: transaction.vatAmount,
      total: transaction.total,
      payment_method: transaction.paymentMethod,
      cash_received: transaction.cashReceived,
      change_amount: transaction.change,
      discount_type: transaction.discountType,
      discount_percent: transaction.discountPercent,
      discount_amount: transaction.discountAmount,
      processed_by: transaction.processedBy || currentUser.username,
      voided: transaction.voided || false
    }
    
    console.log("[v0] Saving transaction to Supabase:", {
      transactionId: transaction.id,
      total: transaction.total,
      items: transaction.items.length,
      processedBy: transaction.processedBy
    })
    
    const { data, error } = await supabase
      .from('transactions')
      .insert([transactionData])
      .select()
    
    if (error) {
      console.log("[v0] Supabase save ERROR:", {
        message: error.message,
        code: error.code,
        details: error.details
      })
      saveToLocalStorage(transaction)
    } else {
      console.log("[v0] Transaction saved to Supabase successfully:", data)
      saveToLocalStorage(transaction)
    }
  } catch (error) {
    console.log("[v0] Error saving to Supabase:", error)
    saveToLocalStorage(transaction)
  }
}

function saveToLocalStorage(transaction: Transaction): void {
  const transactions = localStorage.getItem(TRANSACTIONS_KEY)
  const list = transactions ? JSON.parse(transactions) : []
  list.push(transaction)
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(list))
}

export async function getTransactionsByDate(date: string): Promise<Transaction[]> {
  const transactions = await getTransactions()
  return transactions.filter((t) => t.date === date && !t.voided)
}

export async function getDailySales(date: string): Promise<number> {
  const transactions = await getTransactions()
  return transactions
    .filter((t) => t.date === date && !t.voided)
    .reduce((sum, t) => sum + t.total, 0)
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
    
    const { createClient } = await import('./supabase/client')
    const supabase = createClient()
    
    // Update in Supabase - match by transaction_number only
    const { error } = await supabase
      .from('transactions')
      .update({
        voided: true,
        updated_at: new Date().toISOString()
      })
      .eq('transaction_number', transactionId)
    
    if (error) {
      console.log("[v0] Failed to void transaction in Supabase:", error.message)
      return { success: false, updatedIngredients: ingredients }
    }
  } catch (error) {
    console.log("[v0] Error voiding transaction:", error)
    return { success: false, updatedIngredients: ingredients }
  }
  
  // Restore ingredients locally
  const updatedIngredients = [...ingredients]
  // Get all transactions to find the one being voided
  const allTransactions = await getTransactions()
  const transaction = allTransactions.find((t) => t.id === transactionId)
  
  if (transaction) {
    transaction.items.forEach((cartItem) => {
      const product = cartItem.product
      if (product.ingredients) {
        product.ingredients.forEach((pi) => {
          const ingredientIndex = updatedIngredients.findIndex((i) => i.id === pi.ingredientId)
          if (ingredientIndex !== -1) {
            updatedIngredients[ingredientIndex] = {
              ...updatedIngredients[ingredientIndex],
              stock: updatedIngredients[ingredientIndex].stock + (pi.quantity * cartItem.quantity)
            }
          }
        })
      }
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

  // Check length
  if (password.length < 8 || password.length > 30) {
    errors.push("Password must be 8 to 30 characters")
  }

  // Check for lowercase and uppercase
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    errors.push("Password must contain both lower and uppercase letters")
  }

  // Check for number
  if (!/\d/.test(password)) {
    errors.push("Password must contain a number")
  }

  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain a special character")
  }

  // Check for sequences like 'abc', '123', '4444', 'qwerty'
  const forbiddenSequences = ["abc", "bcd", "cde", "def", "efg", "fgh", "ghi", "hij", "ijk", "jkl", "klm", "lmn", "mno", "nop", "opq", "pqr", "qrs", "rst", "stu", "tuv", "uvw", "vwx", "wxy", "xyz", "123", "234", "345", "456", "567", "678", "789", "0123", "1234", "2345", "3456", "4567", "5678", "6789", "11", "22", "33", "44", "55", "66", "77", "88", "99", "00", "qwerty", "asdf", "zxcv"]
  
  const lowerPassword = password.toLowerCase()
  if (forbiddenSequences.some((seq) => lowerPassword.includes(seq))) {
    errors.push("Password contains forbidden sequences")
  }

  return { valid: errors.length === 0, errors }
}

// Auth functions
export type UserRole = "admin" | "cashier"

export interface AuthUser {
  id: string
  username: string
  email: string
  role: UserRole
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(AUTH_KEY) === "true"
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  const userStr = localStorage.getItem("currentUserData")
  if (!userStr) return null
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

export function getUserRole(): UserRole {
  const user = getCurrentUser()
  return user?.role || "cashier"
}

export function isAdmin(): boolean {
  return getUserRole() === "admin"
}

export function login(username: string, password: string): boolean {
  // Admin default login
  if (username === "admin" && password === "password") {
    localStorage.setItem(AUTH_KEY, "true")
    localStorage.setItem("currentUserData", JSON.stringify({
      id: "admin",
      username: "admin",
      email: "admin@alfresco.com",
      role: "admin"
    }))
    return true
  }
  return false
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function register(username: string, email: string, password: string, userId?: string): { success: boolean; error?: string } {
  // Check if user already exists (from defaultUsers)
  if (username === "admin") {
    return { success: false, error: "Username already exists" }
  }

  // Validate email
  if (!validateEmail(email)) {
    return { success: false, error: "Invalid email address" }
  }

  // Validate password
  const validation = validatePassword(password)
  if (!validation.valid) {
    return { success: false, error: validation.errors[0] }
  }

  // Store new user as cashier role
  localStorage.setItem(AUTH_KEY, "true")
  localStorage.setItem("currentUserData", JSON.stringify({
    id: userId || crypto.randomUUID(),
    username,
    email,
    role: "cashier" // New registered users are always cashiers
  }))
  return { success: true }
}

export function logout(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem("currentUserData")
}

// Combo Meal functions
export function getComboMeals(): ComboMeal[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(COMBOS_KEY)
  return stored ? JSON.parse(stored) : []
}

export function saveComboMeals(combos: ComboMeal[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(COMBOS_KEY, JSON.stringify(combos))
}

export function addComboMeal(combo: Omit<ComboMeal, "id">): ComboMeal {
  const combos = getComboMeals()
  const newId = combos.length > 0 ? Math.max(...combos.map(c => c.id)) + 1 : 1
  const newCombo: ComboMeal = { ...combo, id: newId }
  combos.push(newCombo)
  saveComboMeals(combos)
  return newCombo
}

export function updateComboMeal(id: number, updates: Partial<ComboMeal>): ComboMeal | null {
  const combos = getComboMeals()
  const index = combos.findIndex(c => c.id === id)
  if (index === -1) return null
  combos[index] = { ...combos[index], ...updates }
  saveComboMeals(combos)
  return combos[index]
}

export function deleteComboMeal(id: number): boolean {
  const combos = getComboMeals()
  const filtered = combos.filter(c => c.id !== id)
  if (filtered.length === combos.length) return false
  saveComboMeals(filtered)
  return true
}

// Default Add-ons
const defaultAddOns: AddOn[] = [
  // Coffee add-ons
  { id: "coffee-1", name: "Extra Shot", price: 30, category: "drink" },
  { id: "coffee-2", name: "Vanilla Syrup", price: 25, category: "drink" },
  { id: "coffee-3", name: "Caramel Drizzle", price: 25, category: "drink" },
  { id: "coffee-4", name: "Whipped Cream", price: 20, category: "drink" },
  // Milk Tea add-ons
  { id: "milktea-1", name: "Pearl (Boba)", price: 20, category: "drink" },
  { id: "milktea-2", name: "Nata de Coco", price: 15, category: "drink" },
  { id: "milktea-3", name: "Pudding", price: 25, category: "drink" },
  { id: "milktea-4", name: "Cream Cheese", price: 30, category: "drink" },
  // Meal add-ons
  { id: "meal-1", name: "Extra Rice", price: 20, category: "meal" },
  { id: "meal-2", name: "Extra Egg", price: 25, category: "meal" },
  { id: "meal-3", name: "Atchara", price: 15, category: "meal" },
  { id: "meal-4", name: "Gravy", price: 15, category: "meal" },
]

// Add-ons functions
export function getAddOns(): AddOn[] {
  if (typeof window === "undefined") return defaultAddOns
  const stored = localStorage.getItem(ADDONS_KEY)
  if (!stored) {
    localStorage.setItem(ADDONS_KEY, JSON.stringify(defaultAddOns))
    return defaultAddOns
  }
  return JSON.parse(stored)
}

export function saveAddOns(addOns: AddOn[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ADDONS_KEY, JSON.stringify(addOns))
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
  const index = addOns.findIndex(a => a.id === id)
  if (index === -1) return null
  addOns[index] = { ...addOns[index], ...updates }
  saveAddOns(addOns)
  return addOns[index]
}

export function deleteAddOn(id: string): boolean {
  const addOns = getAddOns()
  const filtered = addOns.filter(a => a.id !== id)
  if (filtered.length === addOns.length) return false
  saveAddOns(filtered)
  return true
}

export function getAddOnsByCategory(category: "drink" | "meal"): AddOn[] {
  return getAddOns().filter(a => a.category === category)
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
    const dateStr = d.toISOString().split('T')[0]
    dailySales[dateStr] = 0
  }
  
  transactions.forEach(t => {
    if (t.date >= startDate.toISOString().split('T')[0] && t.date <= endDate.toISOString().split('T')[0] && !t.voided) {
      dailySales[t.date] = (dailySales[t.date] || 0) + t.total
    }
  })
  
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return Object.entries(dailySales).map(([date, sales]) => ({
    date,
    day: days[new Date(date).getDay()],
    sales: Math.round(sales * 100) / 100
  }))
}

export async function getSalesByCategory(startDate: Date, endDate: Date): Promise<SalesByCategory[]> {
  const transactions = await getTransactions()
  const categorySales: Record<string, number> = {}
  const products = getProducts()
  
  const categoryColors: Record<string, string> = {
    'Coffee': '#A61F30',
    'Milk Tea': '#F1646E',
    'Silog': '#d4516f',
    'Burger': '#8B1826',
    'Fruit Tea': '#E84A5C'
  }
  
  transactions.forEach(t => {
    if (t.date >= startDate.toISOString().split('T')[0] && t.date <= endDate.toISOString().split('T')[0] && !t.voided) {
      t.items.forEach(item => {
        const product = products.find(p => p.id === item.product.id)
        if (product) {
          const category = product.category
          categorySales[category] = (categorySales[category] || 0) + (item.quantity * item.product.price)
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
      color: categoryColors[category] || '#A61F30'
    }))
    .sort((a, b) => b.sales - a.sales)
}

export async function getTopProducts(startDate: Date, endDate: Date, limit: number = 10): Promise<TopProduct[]> {
  const transactions = await getTransactions()
  const productSales: Record<number, { quantity: number; revenue: number; name: string }> = {}
  const products = getProducts()
  
  transactions.forEach(t => {
    if (t.date >= startDate.toISOString().split('T')[0] && t.date <= endDate.toISOString().split('T')[0] && !t.voided) {
      t.items.forEach(item => {
        const product = products.find(p => p.id === item.product.id)
        if (product) {
          if (!productSales[product.id]) {
            productSales[product.id] = { quantity: 0, revenue: 0, name: product.name }
          }
          productSales[product.id].quantity += item.quantity
          productSales[product.id].revenue += item.quantity * item.product.price
        }
      })
    }
  })
  
  return Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit)
    .map(p => ({ name: p.name, quantity: p.quantity, revenue: Math.round(p.revenue * 100) / 100 }))
}

export async function getPeakHours(startDate: Date, endDate: Date): Promise<PeakHour[]> {
  const transactions = await getTransactions()
  const hourCounts: Record<number, number> = {}
  
  for (let i = 0; i < 24; i++) {
    hourCounts[i] = 0
  }
  
  transactions.forEach(t => {
    if (t.date >= startDate.toISOString().split('T')[0] && t.date <= endDate.toISOString().split('T')[0] && !t.voided) {
      const timeStr = t.time
      const hour = parseInt(timeStr.split(':')[0])
      hourCounts[hour]++
    }
  })
  
  const maxOrders = Math.max(...Object.values(hourCounts))
  const result: PeakHour[] = []
  
  for (let i = 0; i < 24; i++) {
    const orders = hourCounts[i]
    if (orders > 0) {
      result.push({
        hour: `${i.toString().padStart(2, '0')}:00`,
        orders,
        percentage: maxOrders > 0 ? (orders / maxOrders) * 100 : 0
      })
    }
  }
  
  return result
}
