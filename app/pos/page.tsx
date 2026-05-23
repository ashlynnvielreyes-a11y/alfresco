"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Search, Trash2, Minus, Plus, AlertTriangle, Ban, Eye, EyeOff, Loader2, Pencil, Activity, ChefHat, MonitorPlay, ReceiptText, Settings, FileText, LayoutGrid, ShoppingCart, ChevronLeft, LogOut, PanelRightClose, PanelRightOpen } from "lucide-react"
import { initializeSupabaseStore, getProducts, saveTransaction, getTransactions, getIngredients, saveIngredients, checkIngredientAvailability, getProductAvailableStock, voidTransaction, getCurrentUser, getComboMeals, getAddOns, deductCartIngredients, checkAddOnAvailability, upsertActiveOrderSnapshot, clearActiveOrderSnapshot, getActiveOrders, getActiveOrderById, logout } from "@/lib/store"
import { buildQueueMetadataNote, getCurrentDailyQueueNumber, getLocalDateKey, getNextDailyQueueNumber, isQueueDailyResetEnabled } from "@/lib/queue"
import { useDebounce } from "@/hooks/useDebounce"
import { toast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import type { Product, CartItem, Transaction, Ingredient, AddOn, ComboMeal, CoffeeTemperature, ActiveOrder } from "@/lib/types"

const categories = ["All Items", "Coffee", "Milk Tea", "Fruit Soda", "Silog", "Combos"] as const
const coffeeTemperatures: CoffeeTemperature[] = ["hot", "cold"]
const comboProductIdOffset = 100000
const POS_SIDEBAR_COLLAPSE_KEY = "alfresco_pos_sidebar_collapsed"
const POS_ORDER_SUMMARY_COLLAPSE_KEY = "alfresco_pos_order_summary_collapsed"

const posWorkspaceLinks = [
  { href: "/pos", label: "POS", description: "New Order", icon: ShoppingCart },
  { href: "/queue-display", label: "Queue Display", description: "Live Queue", icon: MonitorPlay },
  { href: "/sales-history", label: "Reports", description: "Sales Records", icon: FileText },
  { href: "/settings", label: "Settings", description: "System Controls", icon: Settings },
] as const

function getAddOnKey(addOns?: AddOn[]) {
  return (addOns || [])
    .map((a) => `${a.id}:${a.selectedQuantity || 1}`)
    .sort()
    .join("-")
}

function getComboProductId(comboId: number) {
  return comboProductIdOffset + comboId
}

function getCartItemKey(item: CartItem) {
  if (item.comboMeal) {
    return `combo:${item.comboMeal.id}::${getAddOnKey(item.addOns)}`
  }
  return `${item.product.id}::${item.temperature || "none"}::${getAddOnKey(item.addOns)}`
}

function formatCoffeeTemperature(temperature?: CoffeeTemperature) {
  if (!temperature) return null
  return temperature.charAt(0).toUpperCase() + temperature.slice(1)
}

function getCartItemUnitPrice(item: CartItem) {
  const addOnsTotal = (item.addOns || []).reduce((acc, addon) => acc + addon.price * (addon.selectedQuantity || 1), 0)
  if (item.comboMeal) return item.comboMeal.price + addOnsTotal
  return item.product.price + addOnsTotal
}

function buildComboProduct(combo: ComboMeal, products: Product[]): Product | null {
  const ingredientTotals = new Map<number, number>()

  for (const item of combo.items) {
    if (item.ingredientId !== undefined) {
      ingredientTotals.set(item.ingredientId, (ingredientTotals.get(item.ingredientId) || 0) + item.quantity)
      continue
    }

    if (!products.find((product) => product.id === item.productId)) {
      ingredientTotals.set(item.productId, (ingredientTotals.get(item.productId) || 0) + item.quantity)
      continue
    }

    const sourceProduct = products.find((product) => product.id === item.productId)
    if (!sourceProduct) return null

    for (const ingredient of sourceProduct.ingredients) {
      ingredientTotals.set(
        ingredient.ingredientId,
        (ingredientTotals.get(ingredient.ingredientId) || 0) + ingredient.quantity * item.quantity
      )
    }
  }

  return {
    id: getComboProductId(combo.id),
    name: combo.name,
    category: "Combos",
    price: combo.price,
    ingredients: Array.from(ingredientTotals.entries()).map(([ingredientId, quantity]) => ({
      ingredientId,
      quantity,
    })),
  }
}

export default function POSPage() {
  const pathname = usePathname()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [comboMeals, setComboMeals] = useState<ComboMeal[]>([])
  const [allAddOns, setAllAddOns] = useState<AddOn[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("All Items")
  const [searchQuery, setSearchQuery] = useState("")
  const [cashReceived, setCashReceived] = useState<string>("")
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null)
  const [unavailableProducts, setUnavailableProducts] = useState<Map<number, string[]>>(new Map())
  
  // Void transaction state
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [voidKeyInput, setVoidKeyInput] = useState("")
  const [showVoidKeyInput, setShowVoidKeyInput] = useState(false)
  const [voidError, setVoidError] = useState("")
  const [isVoiding, setIsVoiding] = useState(false)
  const [isCancellingReceiptSale, setIsCancellingReceiptSale] = useState(false)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [selectedTransactionToVoid, setSelectedTransactionToVoid] = useState<Transaction | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; role: string } | null>(null)

  // Add-ons modal state
  const [showAddOnsModal, setShowAddOnsModal] = useState(false)
  const [selectedProductForAddOns, setSelectedProductForAddOns] = useState<Product | null>(null)
  const [selectedComboMealForAddOns, setSelectedComboMealForAddOns] = useState<ComboMeal | null>(null)
  const [selectedAddOns, setSelectedAddOns] = useState<AddOn[]>([])
  const [selectedTemperature, setSelectedTemperature] = useState<CoffeeTemperature>("hot")
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null)
  const [activeOrderId, setActiveOrderId] = useState("")
  const [orderStartedAt, setOrderStartedAt] = useState<string | null>(null)
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([])
  const [isTakingOverOrder, setIsTakingOverOrder] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isOrderSummaryCollapsed, setIsOrderSummaryCollapsed] = useState(false)

  // Payment and discount state
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash">("cash")
  const [discountType, setDiscountType] = useState<"none" | "senior" | "pwd">("none")

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const loadRecentTransactions = async () => {
    const allTransactions = await getTransactions()
    setAllTransactions(allTransactions)
    // Get last 10 non-voided transactions
    const recent = allTransactions
      .filter((t) => !t.voided)
      .slice(-10)
      .reverse()
    setRecentTransactions(recent)
  }

  const refreshData = useCallback(async () => {
    await initializeSupabaseStore()
    setProducts(getProducts())
    setIngredients(getIngredients())
    setComboMeals(getComboMeals())
    setAllAddOns(getAddOns())
    setActiveOrders(await getActiveOrders())
    const user = getCurrentUser()
    setCurrentUser(user)
    console.log("[v0] POS page initialized with user:", user?.username)
    await loadRecentTransactions()
  }, [])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  useEffect(() => {
    if (typeof window === "undefined") return
    setIsSidebarCollapsed(window.localStorage.getItem(POS_SIDEBAR_COLLAPSE_KEY) === "true")
    setIsOrderSummaryCollapsed(window.localStorage.getItem(POS_ORDER_SUMMARY_COLLAPSE_KEY) === "true")
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(POS_SIDEBAR_COLLAPSE_KEY, String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(POS_ORDER_SUMMARY_COLLAPSE_KEY, String(isOrderSummaryCollapsed))
  }, [isOrderSummaryCollapsed])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("pos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ingredients" }, () => void refreshData())
      .on("postgres_changes", { event: "*", schema: "public", table: "ingredient_batches" }, () => void refreshData())
      .on("postgres_changes", { event: "*", schema: "public", table: "expiration_logs" }, () => void refreshData())
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => void refreshData())
      .on("postgres_changes", { event: "*", schema: "public", table: "product_ingredients" }, () => void refreshData())
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => void loadRecentTransactions())
      .on("postgres_changes", { event: "*", schema: "public", table: "active_orders" }, async () => setActiveOrders(await getActiveOrders()))
      .on("postgres_changes", { event: "*", schema: "public", table: "combo_meals" }, () => void refreshData())
      .on("postgres_changes", { event: "*", schema: "public", table: "combo_meal_items" }, () => void refreshData())
      .on("postgres_changes", { event: "*", schema: "public", table: "addons" }, () => void refreshData())
      .subscribe()

    const intervalId = window.setInterval(() => {
      void refreshData()
    }, 60000)

    return () => {
      window.clearInterval(intervalId)
      void supabase.removeChannel(channel)
    }
  }, [refreshData])

  // Check ingredient availability for all products
  useEffect(() => {
    const unavailable = new Map<number, string[]>()
    products.forEach((product) => {
      if (product.ingredients && product.ingredients.length > 0) {
        const { available, missingIngredients } = checkIngredientAvailability(product, 1, ingredients)
        if (!available) {
          unavailable.set(product.id, missingIngredients)
        }
      }
    })
    setUnavailableProducts(unavailable)
  }, [products, ingredients])

  // Memoize filtered products to prevent unnecessary recalculations
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = selectedCategory === "All Items" || product.category === selectedCategory
      const matchesSearch = product.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [products, selectedCategory, debouncedSearchQuery])

  const getUnavailableAddOnReason = useCallback((addOn: AddOn, quantity: number = 1) => {
    const result = checkAddOnAvailability(addOn, quantity, ingredients)
    return result.available ? null : result.reason || "Unavailable"
  }, [ingredients])

  const isProductAvailable = useCallback((product: Product, quantity: number = 1): { available: boolean; reason?: string } => {
    // Check available stock based on ingredients
    const availableStock = getProductAvailableStock(product, ingredients)
    if (availableStock <= 0) {
      return { available: false, reason: "Out of stock" }
    }
    
    // Check ingredient availability
    if (product.ingredients && product.ingredients.length > 0) {
      const currentCartQuantity = cart
        .filter((item) => item.product.id === product.id)
        .reduce((sum, item) => sum + item.quantity, 0)
      const totalQuantity = currentCartQuantity + quantity
      
      const { available, missingIngredients } = checkIngredientAvailability(product, totalQuantity, ingredients)
      if (!available) {
        return { available: false, reason: `Missing: ${missingIngredients.join(", ")}` }
      }
    }
    
    return { available: true }
  }, [ingredients, cart])

  const productSupportsTemperature = useCallback((product: Product) => {
    return product.category === "Coffee"
  }, [])

  const getAvailableAddOns = useCallback((product: Product): AddOn[] => {
    if (
      product.category === "Coffee" ||
      product.category === "Milk Tea" ||
      product.category === "Fruit Soda" ||
      product.category === "Fruit Tea"
    ) {
      return allAddOns.filter(a => a.category === "drink")
    } else if (product.category === "Silog" || product.category === "Combos") {
      return allAddOns.filter(a => a.category === "meal")
    }
    return []
  }, [allAddOns])

  const handleProductClick = useCallback((product: Product) => {
    const { available, reason } = isProductAvailable(product)
    if (!available) {
      alert(reason || "Product not available")
      return
    }
    
    // Check if product has available add-ons
    const availableAddOns = getAvailableAddOns(product)
    
    if (availableAddOns.length > 0) {
      // Open add-ons modal for drinks and meals
      setSelectedProductForAddOns(product)
      setSelectedComboMealForAddOns(null)
      setSelectedAddOns([])
      setSelectedTemperature("hot")
      setEditingCartIndex(null)
      setShowAddOnsModal(true)
    } else {
      // Add directly to cart for pastries (no add-ons)
      setCart((prev) => {
        const existing = prev.find((item) => 
          item.product.id === product.id && 
          (!item.addOns || item.addOns.length === 0)
        )
        
        if (existing) {
          const newQuantity = existing.quantity + 1
          const availableStock = getProductAvailableStock(product, ingredients)
          if (newQuantity > availableStock) return prev
          
          if (product.ingredients && product.ingredients.length > 0) {
            const { available } = checkIngredientAvailability(product, newQuantity, ingredients)
            if (!available) {
              alert("Not enough ingredients for additional quantity")
              return prev
            }
          }
          
          return prev.map((item) =>
            item.product.id === product.id && (!item.addOns || item.addOns.length === 0)
              ? { ...item, quantity: newQuantity }
              : item
          )
        }
        return [...prev, { product, quantity: 1 }]
      })
    }
  }, [isProductAvailable, getAvailableAddOns, ingredients])

  const updateSelectedAddOnQuantity = useCallback((addOn: AddOn, delta: number) => {
    setSelectedAddOns((prev) => {
      const existingIndex = prev.findIndex((a) => a.id === addOn.id)
      if (existingIndex === -1) {
        if (delta <= 0) return prev
        return [...prev, { ...addOn, selectedQuantity: 1 }]
      }
      const updated = [...prev]
      const current = updated[existingIndex]
      const nextQuantity = (current.selectedQuantity || 1) + delta
      if (nextQuantity <= 0) {
        return updated.filter((item) => item.id !== addOn.id)
      }
      updated[existingIndex] = { ...current, selectedQuantity: nextQuantity }
      return updated
    })
  }, [])

  const confirmAddToCart = useCallback(() => {
    if (!selectedProductForAddOns) return
    
    const product = selectedProductForAddOns
    const addOns = selectedAddOns
    const comboMeal = selectedComboMealForAddOns
    const temperature = productSupportsTemperature(product) ? selectedTemperature : undefined

    for (const addOn of addOns) {
      const selectedQuantity = addOn.selectedQuantity || 1
      const availability = checkAddOnAvailability(addOn, selectedQuantity, ingredients)
      if (!availability.available) {
        alert(`Cannot add ${addOn.name}. ${availability.reason}`)
        return
      }
    }
    
    setCart((prev) => {
      if (comboMeal) {
        const addOnKey = getAddOnKey(addOns)
        const existing = prev.find((item) =>
          item.comboMeal?.id === comboMeal.id &&
          getAddOnKey(item.addOns) === addOnKey
        )

        if (existing) {
          return prev.map((item) =>
            item.comboMeal?.id === comboMeal.id && getAddOnKey(item.addOns) === addOnKey
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        }

        return [...prev, { product, quantity: 1, comboMeal, addOns: addOns.length > 0 ? addOns : undefined }]
      }

      // Create a unique key based on product + temperature + add-ons combination
      const addOnKey = getAddOnKey(addOns)
      const existing = prev.find((item) => 
        item.product.id === product.id && 
        item.temperature === temperature &&
        getAddOnKey(item.addOns) === addOnKey
      )
      
      if (existing) {
        // Check if we can add more
        const newQuantity = existing.quantity + 1
        const availableStock = getProductAvailableStock(product, ingredients)
        if (newQuantity > availableStock) return prev
        
        // Check ingredients for new quantity
        if (product.ingredients && product.ingredients.length > 0) {
          const { available } = checkIngredientAvailability(product, newQuantity, ingredients)
          if (!available) {
            alert("Not enough ingredients for additional quantity")
            return prev
          }
        }
        
        return prev.map((item) =>
          item.product.id === product.id && 
          item.temperature === temperature &&
          getAddOnKey(item.addOns) === addOnKey
            ? { ...item, quantity: newQuantity }
            : item
        )
      }
      return [...prev, { product, quantity: 1, temperature, addOns: addOns.length > 0 ? addOns : undefined }]
    })
    
    setShowAddOnsModal(false)
    setSelectedProductForAddOns(null)
    setSelectedComboMealForAddOns(null)
    setSelectedAddOns([])
    setSelectedTemperature("hot")
    setEditingCartIndex(null)
  }, [selectedProductForAddOns, selectedComboMealForAddOns, selectedAddOns, selectedTemperature, ingredients, productSupportsTemperature])

  const updateQuantity = useCallback((itemKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (getCartItemKey(item) === itemKey) {
            const newQty = item.quantity + delta
            if (newQty <= 0) return null
            const availableStock = getProductAvailableStock(item.product, ingredients)
            if (newQty > availableStock) return item
            
            // Check ingredients for new quantity
            if (item.product.ingredients && item.product.ingredients.length > 0 && delta > 0) {
              const { available } = checkIngredientAvailability(item.product, newQty, ingredients)
              if (!available) {
                alert("Not enough ingredients for additional quantity")
                return item
              }
            }
            
            return { ...item, quantity: newQty }
          }
          return item
        })
        .filter(Boolean) as CartItem[]
    )
  }, [ingredients])

  const clearCart = useCallback(() => {
    setCart([])
    setCashReceived("")
  }, [])

  // Edit add-ons for an existing cart item
  const handleEditAddOns = useCallback((cartIndex: number) => {
    const cartItem = cart[cartIndex]
    if (!cartItem) return
    setSelectedProductForAddOns(cartItem.product)
    setSelectedComboMealForAddOns(cartItem.comboMeal || null)
    setSelectedAddOns(cartItem.addOns || [])
    setSelectedTemperature(cartItem.temperature || "hot")
    setEditingCartIndex(cartIndex)
    setShowAddOnsModal(true)
  }, [cart])

  // Save edited add-ons
  const saveEditedAddOns = useCallback(() => {
    if (editingCartIndex === null || !selectedProductForAddOns) return

    for (const addOn of selectedAddOns) {
      const selectedQuantity = addOn.selectedQuantity || 1
      const availability = checkAddOnAvailability(addOn, selectedQuantity, ingredients)
      if (!availability.available) {
        alert(`Cannot save ${addOn.name}. ${availability.reason}`)
        return
      }
    }
    
    setCart((prev) => {
      if (editingCartIndex >= prev.length) return prev
      
      const newCart = [...prev]
      const currentItem = newCart[editingCartIndex]
      
      // Update the item with the new add-ons
      newCart[editingCartIndex] = {
        ...currentItem,
        temperature: productSupportsTemperature(currentItem.product) ? selectedTemperature : undefined,
        addOns: selectedAddOns.length > 0 ? selectedAddOns : undefined
      }
      
      // Check if we need to merge items (e.g., when removing all add-ons creates a duplicate)
      const updatedItem = newCart[editingCartIndex]
      const updatedAddOnKey = getAddOnKey(updatedItem.addOns)
      
      // Find if there's another item with the same product, temperature, and add-on combination
      const duplicateIndex = newCart.findIndex((item, idx) => 
        idx !== editingCartIndex &&
        item.product.id === updatedItem.product.id &&
        item.temperature === updatedItem.temperature &&
        getAddOnKey(item.addOns) === updatedAddOnKey
      )
      
      if (duplicateIndex !== -1) {
        // Merge quantities
        newCart[duplicateIndex] = {
          ...newCart[duplicateIndex],
          quantity: newCart[duplicateIndex].quantity + updatedItem.quantity
        }
        // Remove the edited item as it's now merged
        newCart.splice(editingCartIndex, 1)
      }
      
      return newCart
    })
    
    setShowAddOnsModal(false)
    setSelectedProductForAddOns(null)
    setSelectedComboMealForAddOns(null)
    setSelectedAddOns([])
    setSelectedTemperature("hot")
    setEditingCartIndex(null)
  }, [editingCartIndex, selectedProductForAddOns, selectedAddOns, selectedTemperature, productSupportsTemperature, ingredients])

  // Handle adding a combo meal to cart - adds all items as a bundle
  const handleComboClick = useCallback((combo: ComboMeal) => {
    const comboProduct = buildComboProduct(combo, products)
    if (!comboProduct) {
      alert("Combo ingredients could not be resolved")
      return
    }

    const { available, reason } = isProductAvailable(comboProduct)
    if (!available) {
      alert(`Cannot add combo: ${reason}`)
      return
    }

    const availableAddOns = getAvailableAddOns(comboProduct)
    if (availableAddOns.length > 0) {
      setSelectedProductForAddOns(comboProduct)
      setSelectedComboMealForAddOns(combo)
      setSelectedAddOns([])
      setSelectedTemperature("hot")
      setEditingCartIndex(null)
      setShowAddOnsModal(true)
      return
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.comboMeal?.id === combo.id)
      if (existing) {
        const nextQuantity = existing.quantity + 1
        const { available: comboAvailable } = checkIngredientAvailability(comboProduct, nextQuantity, ingredients)
        if (!comboAvailable) {
          alert("Not enough ingredients for additional combo quantity")
          return prev
        }

        return prev.map((item) =>
          item.comboMeal?.id === combo.id ? { ...item, quantity: nextQuantity } : item
        )
      }

      return [...prev, { product: comboProduct, quantity: 1, comboMeal: combo }]
    })
  }, [products, ingredients, isProductAvailable, getAvailableAddOns])

  // Get minimum available stock for a combo (based on limiting item)
  const getComboAvailableStock = useCallback((combo: ComboMeal): number => {
    const comboProduct = buildComboProduct(combo, products)
    if (!comboProduct) return 0
    return getProductAvailableStock(comboProduct, ingredients)
  }, [products, ingredients])

  // Check if combo has any unavailable items
  const isComboUnavailable = useCallback((combo: ComboMeal): { unavailable: boolean; reason?: string } => {
    const comboProduct = buildComboProduct(combo, products)
    if (!comboProduct) return { unavailable: true, reason: "Missing combo ingredients" }
    const { available, missingIngredients } = checkIngredientAvailability(comboProduct, 1, ingredients)
    if (!available) {
      return { unavailable: true, reason: missingIngredients[0] || "Out of stock" }
    }
    return { unavailable: false }
  }, [products, ingredients])

  // Calculate subtotal and discounts
  const subtotal = cart.reduce((sum, item) => {
    return sum + getCartItemUnitPrice(item) * item.quantity
  }, 0)

  const discountPercent = discountType === "senior" || discountType === "pwd" ? 20 : 0
  const discountAmount = (subtotal * discountPercent) / 100

  const total = subtotal - discountAmount
  const isCashPayment = paymentMethod === "cash"
  const cash = parseFloat(cashReceived) || 0
  const change = isCashPayment && cash > total ? cash - total : 0
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const lowStockIngredientsCount = ingredients.filter((ingredient) => ingredient.stock <= 10).length
  const expiredIngredientsCount = ingredients.filter((ingredient) => {
    if (!ingredient.expirationDate) return false
    return new Date(ingredient.expirationDate).getTime() < Date.now()
  }).length
  const todayKey = getLocalDateKey()
  const queueScopeKey = isQueueDailyResetEnabled() ? todayKey : "global"
  const currentQueueNumber = getCurrentDailyQueueNumber(allTransactions, queueScopeKey)
  const nextQueueNumberPreview = getNextDailyQueueNumber(allTransactions, queueScopeKey)

  const queueSnapshot = useMemo(() => {
    const queueTransactions = allTransactions.filter(
      (transaction) =>
        !transaction.voided &&
        transaction.orderStatus !== "voided" &&
        transaction.orderStatus !== "cancelled" &&
        (isQueueDailyResetEnabled() ? transaction.date === todayKey : true)
    )

    const preparing = queueTransactions.filter(
      (transaction) => transaction.orderStatus === "preparing" || transaction.orderStatus === "pending"
    )
    const ready = queueTransactions.filter((transaction) => transaction.orderStatus === "ready")
    const serving = queueTransactions.filter((transaction) => transaction.orderStatus === "completed").slice(-3).reverse()

    return {
      totalActive: preparing.length + ready.length,
      preparing,
      ready,
      serving,
    }
  }, [allTransactions, todayKey])

  useEffect(() => {
    if (isCashPayment) return
    setCashReceived(total > 0 ? total.toFixed(2) : "")
  }, [isCashPayment, total])

  useEffect(() => {
    if (cart.length > 0 && !orderStartedAt) {
      setOrderStartedAt(new Date().toISOString())
    }

    if (cart.length === 0 && orderStartedAt) {
      setOrderStartedAt(null)
    }
  }, [cart.length, orderStartedAt])

  useEffect(() => {
    if (!currentUser) return

    if (cart.length === 0) {
      if (!activeOrderId) return

      void clearActiveOrderSnapshot(activeOrderId)
      setActiveOrderId("")
      return
    }

    if (!orderStartedAt) return

    const cartSnapshotCount = cart.reduce((sum, item) => sum + item.quantity, 0)

    void upsertActiveOrderSnapshot({
      id: activeOrderId || undefined,
      cashierUserId: currentUser.id,
      cashierName: currentUser.username,
      items: cart,
      subtotal,
      discountType,
      discountPercent,
      discountAmount,
      total,
      paymentMethod,
      cartItemCount: cartSnapshotCount,
      startedAt: orderStartedAt,
    }).then((nextActiveOrderId) => {
      if (nextActiveOrderId && nextActiveOrderId !== activeOrderId) {
        setActiveOrderId(nextActiveOrderId)
      }
    })
  }, [
    activeOrderId,
    cart,
    currentUser,
    discountAmount,
    discountPercent,
    discountType,
    orderStartedAt,
    paymentMethod,
    subtotal,
    total,
  ])

  useEffect(() => {
    if (!currentUser || !activeOrderId) return
    if (isTakingOverOrder) return

    const matchingOrder = activeOrders.find((order) => order.id === activeOrderId)
    if (!matchingOrder) return
    if (matchingOrder.cashierUserId === currentUser.id) return

    setCart([])
    setPaymentMethod("cash")
    setDiscountType("none")
    setCashReceived("")
    setActiveOrderId("")
    setOrderStartedAt(null)

    toast({
      title: "Order taken over",
      description: `${matchingOrder.cashierName} is now handling this active order.`,
    })
  }, [activeOrderId, activeOrders, currentUser, isTakingOverOrder])

  const confirmSale = async () => {
    // For non-cash payments, we don't need cash received
    const isValidPayment = isCashPayment ? cash >= total : true
    if (cart.length === 0 || !isValidPayment) return

    for (const cartItem of cart) {
      const { available, missingIngredients } = checkIngredientAvailability(cartItem.product, cartItem.quantity, ingredients)
      if (!available) {
        alert(`Cannot process order. ${cartItem.product.name} uses unavailable ingredients: ${missingIngredients.join(", ")}`)
        return
      }

      for (const addOn of cartItem.addOns || []) {
        const selectedQuantity = (addOn.selectedQuantity || 1) * cartItem.quantity
        const availability = checkAddOnAvailability(addOn, selectedQuantity, ingredients)
        if (!availability.available) {
          alert(`Cannot process order. ${cartItem.product.name} add-on "${addOn.name}" is unavailable: ${availability.reason}`)
          return
        }
      }
    }

    const now = new Date()
    const transactions = await getTransactions()
    const transactionDate = getLocalDateKey(now)
    const transactionId = String(transactions.length + 1).padStart(5, "0")
    const queueNumber = getNextDailyQueueNumber(transactions, transactionDate)

    const transaction: Transaction = {
      id: `#${transactionId}`,
      items: cart,
      queueNumber,
      customerName: null,
      subtotal,
      discountType,
      discountPercent,
      discountAmount,
      taxAmount: 0,
      total,
      paymentMethod,
      cashReceived: isCashPayment ? cash : total,
      change: isCashPayment ? change : 0,
      processedBy: currentUser?.username || "Unknown",
      notes: buildQueueMetadataNote({
        priority: "normal",
        orderType: "to-serve",
        assignedStaffName: null,
        assignedStaffRole: null,
        placedAt: now.toISOString(),
      }),
      orderStatus: "preparing",
      date: transactionDate,
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase(),
      voided: false,
    }

    const updatedIngredients = deductCartIngredients(cart, ingredients)

    saveIngredients(updatedIngredients)
    await saveTransaction(transaction)
    if (activeOrderId) {
      await clearActiveOrderSnapshot(activeOrderId)
      setActiveOrderId("")
    }
    setIngredients(updatedIngredients)
    setLastTransaction(transaction)
    setShowReceipt(true)
    setOrderStartedAt(null)
  }

  const formatMonitorTime = useCallback((value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "--"
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }, [])

  const handleTakeOverActiveOrder = useCallback(async (order: ActiveOrder) => {
    if (!currentUser || currentUser.role !== "admin") return

    setIsTakingOverOrder(true)

    const latestOrder = await getActiveOrderById(order.id)
    if (!latestOrder) {
      toast({
        title: "Order unavailable",
        description: "That active order is no longer available.",
      })
      void setActiveOrders(await getActiveOrders())
      setIsTakingOverOrder(false)
      return
    }

    if (latestOrder.cashierUserId === currentUser.id) {
      toast({
        title: "Already assigned",
        description: "This order is already on your station.",
      })
      setIsTakingOverOrder(false)
      return
    }

    if (cart.length > 0 && activeOrderId !== latestOrder.id) {
      const shouldReplace = window.confirm("Your current cart will be replaced by the selected live order. Continue?")
      if (!shouldReplace) {
        setIsTakingOverOrder(false)
        return
      }
    }

    setCart(latestOrder.items)
    setPaymentMethod(latestOrder.paymentMethod)
    setDiscountType(latestOrder.discountType || "none")
    setCashReceived(latestOrder.paymentMethod === "gcash" ? latestOrder.total.toFixed(2) : "")
    setOrderStartedAt(latestOrder.startedAt)
    setActiveOrderId(latestOrder.id)

    await upsertActiveOrderSnapshot({
      id: latestOrder.id,
      cashierUserId: currentUser.id,
      cashierName: currentUser.username,
      items: latestOrder.items,
      subtotal: latestOrder.subtotal,
      discountType: latestOrder.discountType || "none",
      discountPercent: latestOrder.discountPercent || 0,
      discountAmount: latestOrder.discountAmount,
      total: latestOrder.total,
      paymentMethod: latestOrder.paymentMethod,
      cartItemCount: latestOrder.cartItemCount,
      startedAt: latestOrder.startedAt,
    })

    setActiveOrders(await getActiveOrders())
    setIsTakingOverOrder(false)
    toast({
      title: "Order transferred",
      description: `You are now processing ${latestOrder.cashierName}'s active order.`,
    })
  }, [activeOrderId, cart.length, currentUser])

  const closeReceipt = async () => {
    setShowReceipt(false)
    setLastTransaction(null)
    clearCart()
    // Force reload of transactions from Supabase
    await loadRecentTransactions()
    // Reset payment and discount state
    setPaymentMethod("cash")
    setDiscountType("none")
  }

  const cancelReceiptSale = async () => {
    if (!lastTransaction) return

    setIsCancellingReceiptSale(true)

    try {
      const restoredCart = lastTransaction.items.map((item) => ({
        ...item,
        addOns: item.addOns ? item.addOns.map((addOn) => ({ ...addOn })) : [],
        comboMeal: item.comboMeal
          ? {
              ...item.comboMeal,
              items: item.comboMeal.items.map((comboItem) => ({ ...comboItem })),
            }
          : undefined,
      }))

      const result = await voidTransaction(
        lastTransaction.id,
        currentUser?.username || "Unknown",
        ingredients
      )

      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Sale Not Cancelled",
          description: "Please use Void Transaction instead.",
        })
        return
      }

      saveIngredients(result.updatedIngredients)
      setIngredients(result.updatedIngredients)
      setCart(restoredCart)
      setPaymentMethod(lastTransaction.paymentMethod)
      setDiscountType(lastTransaction.discountType || "none")
      setCashReceived(lastTransaction.cashReceived > 0 ? lastTransaction.cashReceived.toFixed(2) : "")
      setShowReceipt(false)
      setLastTransaction(null)
      await loadRecentTransactions()
      toast({
        title: "Sale Cancelled",
        description: "Transaction voided, ingredients restored, and the order is back in the cart.",
      })
    } finally {
      setIsCancellingReceiptSale(false)
    }
  }

  const openVoidModal = async () => {
    setShowVoidModal(true)
    setVoidKeyInput("")
    setVoidError("")
    setSelectedTransactionToVoid(null)
    await loadRecentTransactions()
  }

  const closeVoidModal = () => {
    setShowVoidModal(false)
    setVoidKeyInput("")
    setVoidError("")
    setSelectedTransactionToVoid(null)
    setShowVoidKeyInput(false)
  }

  const handlePosLogout = useCallback(() => {
    logout()
    router.push("/")
  }, [router])

  const handleVoidTransaction = async () => {
    if (!selectedTransactionToVoid || !voidKeyInput) {
      setVoidError("Please select a transaction and enter the void key")
      return
    }

    setIsVoiding(true)
    setVoidError("")

    try {
      // Verify void key with admin_settings
      const supabase = createClient()
      const { data, error } = await supabase
        .from("admin_settings")
        .select("void_key")
        .eq("id", 1)
        .single()

      if (error || !data) {
        setVoidError("Void key not configured. Contact admin.")
        setIsVoiding(false)
        return
      }

      if (data.void_key !== voidKeyInput) {
        setVoidError("Invalid void key. Please contact admin.")
        setIsVoiding(false)
        return
      }

      // Void the transaction and restore ingredients
      const result = await voidTransaction(
        selectedTransactionToVoid.id,
        currentUser?.username || "Unknown",
        ingredients
      )

      if (result.success) {
        saveIngredients(result.updatedIngredients)
        setIngredients(result.updatedIngredients)
        await loadRecentTransactions()
        closeVoidModal()
        alert("Transaction voided successfully. Ingredients have been restored.")
      } else {
        setVoidError("Failed to void transaction")
      }
    } catch (err) {
      console.error("Void error:", err)
      setVoidError("An error occurred while voiding")
    } finally {
      setIsVoiding(false)
    }
  }

  const visibleWorkspaceLinks = useMemo(
    () => posWorkspaceLinks.filter((item) => item.href !== "/settings" || currentUser?.role !== "cashier"),
    [currentUser?.role]
  )

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(215,201,184,0.28),transparent_28%),linear-gradient(180deg,#f5f1ea_0%,#efe3d8_100%)] p-3 text-[#4a342a] lg:p-4">
      <div className={`mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1680px] overflow-hidden rounded-[28px] border border-[#d7c9b8] bg-[#f5f1ea] shadow-[0_28px_80px_rgba(74,52,42,0.14)] transition-[grid-template-columns] duration-300 ${
        isSidebarCollapsed ? "lg:grid-cols-[88px_minmax(0,1fr)]" : "lg:grid-cols-[204px_minmax(0,1fr)]"
      }`}>
        <aside className="flex h-full flex-col border-r border-[#7d5a44]/25 bg-[linear-gradient(180deg,#4a342a_0%,#7d5a44_100%)] p-3 text-[#f5f1ea] lg:p-4">
          <div className={`mb-5 flex ${isSidebarCollapsed ? "flex-col items-center gap-3" : "items-start justify-between gap-3"}`}>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <p className={`font-semibold tracking-[0.18em] text-[#d6bfaa] ${isSidebarCollapsed ? "text-center text-xs" : "text-sm"}`}>AL FRESCO</p>
              {!isSidebarCollapsed && <p className="text-[0.68rem] uppercase tracking-[0.2em] text-[#f8f1e8]/70">POS Terminal</p>}
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-[#f5f1ea] transition hover:bg-white/16"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <ChevronLeft className={`h-4 w-4 transition-transform ${isSidebarCollapsed ? "rotate-180" : ""}`} />
            </button>
          </div>

          <div className="space-y-2">
            {visibleWorkspaceLinks.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={`flex items-center rounded-2xl transition-colors ${
                    isActive
                      ? "bg-[#f5f1ea] text-[#4a342a] shadow-[0_12px_24px_rgba(0,0,0,0.12)]"
                      : "text-[#f7ede4]/78 hover:bg-white/8 hover:text-white"
                  } ${isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"}`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${isActive ? "bg-[#d7c9b8]" : "bg-white/8"}`}>
                    <Icon className="h-[0.95rem] w-[0.95rem]" />
                  </span>
                  <span className={`min-w-0 ${isSidebarCollapsed ? "hidden" : "block"}`}>
                    <span className="block text-[0.92rem] font-semibold">{item.label}</span>
                    <span className={`block text-[11px] ${isActive ? "text-[#7d5a44]" : "text-[#f5f1ea]/65"}`}>{item.description}</span>
                  </span>
                </Link>
              )
            })}
          </div>

          <div className={`mt-6 rounded-2xl border border-white/10 bg-white/5 ${isSidebarCollapsed ? "p-3" : "p-4"}`}>
            <p className={`uppercase tracking-[0.22em] text-[#d8c8ba] ${isSidebarCollapsed ? "text-center text-[10px]" : "text-[11px]"}`}>POS Status</p>
            <div className={`mt-3 space-y-3 text-sm ${isSidebarCollapsed ? "text-center" : ""}`}>
              <div className={`flex ${isSidebarCollapsed ? "flex-col gap-1" : "items-center justify-between"}`}>
                <span className="text-[#d8c8ba]">Current Queue</span>
                <span className="font-bold">{currentQueueNumber}</span>
              </div>
              <div className={`flex ${isSidebarCollapsed ? "flex-col gap-1" : "items-center justify-between"}`}>
                <span className="text-[#d8c8ba]">Preparing</span>
                <span className="font-bold">{queueSnapshot.preparing.length}</span>
              </div>
              <div className={`flex ${isSidebarCollapsed ? "flex-col gap-1" : "items-center justify-between"}`}>
                <span className="text-[#d8c8ba]">Ready Pickup</span>
                <span className="font-bold">{queueSnapshot.ready.length}</span>
              </div>
              <div className={`flex ${isSidebarCollapsed ? "flex-col gap-1" : "items-center justify-between"}`}>
                <span className="text-[#d8c8ba]">Low Stock</span>
                <span className="font-bold">{lowStockIngredientsCount}</span>
              </div>
            </div>
          </div>

          <div className="mt-auto border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={handlePosLogout}
              title={isSidebarCollapsed ? "Logout" : undefined}
              className={`flex w-full items-center rounded-2xl border transition-colors ${
                isSidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
              } border-[#d9b2a7]/35 bg-[#8c5a4c]/18 text-[#f5dfd7] hover:bg-[#9a6758]/24`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#d9b2a7]/35 bg-white/10">
                <LogOut className="h-[0.95rem] w-[0.95rem]" />
              </span>
              {!isSidebarCollapsed && <span className="text-sm font-semibold">Logout</span>}
            </button>
          </div>
        </aside>

      <main className="relative flex-1 overflow-y-auto bg-[#f5f1ea] p-4 lg:p-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-0 top-10 h-72 w-72 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
          <div className="absolute right-8 top-24 h-64 w-64 rounded-full bg-[#7d5a44]/10 blur-3xl" />
        </div>
        <div className="relative z-10 mx-auto flex max-w-[1540px] flex-col gap-4 lg:gap-5">
          <section className="rounded-[24px] border border-[#7d5a44]/35 bg-[linear-gradient(180deg,#4a342a_0%,#7d5a44_100%)] px-4 py-4 text-[#f5f1ea] shadow-[0_24px_48px_rgba(74,52,42,0.22)] lg:px-5">
            <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#f5f1ea]/15 bg-[#f5f1ea]/10">
                  <ReceiptText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-[0.16em] text-[#d7c9b8]">POS TERMINAL</p>
                  <h1 className="text-xl font-semibold text-white">Al Fresco Coffee Shop</h1>
                </div>
              </div>

              <div className="grid flex-1 gap-3 2xl:mx-4 2xl:max-w-4xl xl:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d7c9b8]" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-2xl border border-[#f5f1ea]/15 bg-[#f5f1ea]/10 py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-[#d7c9b8] focus:bg-[#f5f1ea]/14"
                  />
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#d7c9b8]">Cashier</p>
                  <p className="mt-1 text-sm font-semibold text-white">{currentUser?.username || "Unknown"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#d7c9b8]">Queue No.</p>
                  <p className="mt-1 text-sm font-semibold text-white">{nextQueueNumberPreview}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#d7c9b8]">Total</p>
                  <p className="mt-1 text-sm font-semibold text-white">P{total.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </section>

          <div className={`grid gap-4 xl:items-start 2xl:gap-5 ${
            isOrderSummaryCollapsed
              ? "xl:grid-cols-[minmax(176px,0.22fr)_minmax(0,1fr)_72px]"
              : "xl:grid-cols-[minmax(176px,0.22fr)_minmax(0,1fr)_minmax(292px,0.32fr)] 2xl:grid-cols-[minmax(188px,0.2fr)_minmax(0,1fr)_minmax(316px,0.28fr)]"
          }`}>
            <section className="min-w-0 rounded-[24px] border border-[#d7c9b8] bg-[#f5f1ea]/92 p-4 shadow-[0_16px_32px_rgba(74,52,42,0.08)]">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#d7c9b8] text-[#4a342a]">
                  <LayoutGrid className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#866754]">Select Category</p>
                  <p className="text-sm font-semibold text-[#3d2a1f]">Browse Menu Groups</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 xl:flex-col">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`min-w-fit rounded-2xl px-3 py-2.5 text-left text-[0.92rem] font-medium transition ${
                      selectedCategory === cat
                        ? "bg-[#4a342a] text-[#f7ede4] shadow-[0_12px_24px_rgba(74,52,42,0.18)]"
                        : "border border-[#d7c9b8] bg-[#f5f1ea] text-[#7d5a44] hover:bg-[#ede3d8]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <article className="rounded-2xl border border-[#d7c9b8] bg-[#ede3d8] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#876755]">Preparing</p>
                  <p className="mt-2 text-xl font-semibold text-[#3d2a1f]">{queueSnapshot.preparing.length}</p>
                </article>
                <article className="rounded-2xl border border-[#d7c9b8] bg-[#ede3d8] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#876755]">Ready</p>
                  <p className="mt-2 text-xl font-semibold text-[#3d2a1f]">{queueSnapshot.ready.length}</p>
                </article>
                <article className="rounded-2xl border border-[#d7c9b8] bg-[#ede3d8] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#876755]">Low Stock</p>
                  <p className="mt-2 text-xl font-semibold text-[#3d2a1f]">{lowStockIngredientsCount}</p>
                </article>
                <article className="rounded-2xl border border-[#d7c9b8] bg-[#ede3d8] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#876755]">Expired</p>
                  <p className="mt-2 text-xl font-semibold text-[#3d2a1f]">{expiredIngredientsCount}</p>
                </article>
              </div>

              <div className="mt-5 space-y-3">
                <Link
                  href="/kitchen-dashboard"
                  className="flex items-center justify-between rounded-2xl border border-[#d7c9b8] bg-[#f5f1ea] px-3 py-2.5 text-sm font-medium text-[#4a342a] transition hover:bg-[#ede3d8]"
                >
                  <span className="flex items-center gap-2">
                    <ChefHat className="h-4 w-4" />
                    Kitchen Dashboard
                  </span>
                  <span className="text-xs text-[#866754]">Monitor</span>
                </Link>
                <Link
                  href="/queue-display"
                  className="flex items-center justify-between rounded-2xl border border-[#d7c9b8] bg-[#f5f1ea] px-3 py-2.5 text-sm font-medium text-[#4a342a] transition hover:bg-[#ede3d8]"
                >
                  <span className="flex items-center gap-2">
                    <MonitorPlay className="h-4 w-4" />
                    Queue Display
                  </span>
                  <span className="text-xs text-[#866754]">Live</span>
                </Link>
              </div>
            </section>

            <section className="min-w-0 rounded-[24px] border border-[#d7c9b8] bg-[#f5f1ea]/94 p-4 shadow-[0_16px_32px_rgba(74,52,42,0.08)] lg:p-5">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[#8c6c58]">All Products</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#352419]">New Order Workspace</h2>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl border border-[#d7c9b8] bg-[#ede3d8] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#8a6a57]">Cart</p>
                    <p className="mt-1 text-sm font-semibold text-[#3d2a1f]">{cartItemCount}</p>
                  </div>
                  <div className="rounded-2xl border border-[#d7c9b8] bg-[#ede3d8] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#8a6a57]">Active</p>
                    <p className="mt-1 text-sm font-semibold text-[#3d2a1f]">{queueSnapshot.totalActive}</p>
                  </div>
                  <div className="rounded-2xl border border-[#d7c9b8] bg-[#ede3d8] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#8a6a57]">Next</p>
                    <p className="mt-1 text-sm font-semibold text-[#3d2a1f]">{nextQueueNumberPreview}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
              {/* Show combo meals when Combos category is selected */}
              {(selectedCategory === "Combos" || selectedCategory === "All Items") && comboMeals
                .filter(combo => combo.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
                .map((combo) => {
                  const comboStock = getComboAvailableStock(combo)
                  const { unavailable, reason } = isComboUnavailable(combo)
                  
                  return (
                    <button
                      key={`combo-${combo.id}`}
                      onClick={() => handleComboClick(combo)}
                      disabled={unavailable}
                      className={`group relative overflow-hidden rounded-[22px] border p-3 text-left transition-all ${
                        unavailable
                          ? "cursor-not-allowed border-[#d7c9b8] bg-[#ede3d8]"
                          : "border-[#d7c9b8] bg-[#f5f1ea] shadow-[0_12px_28px_rgba(74,52,42,0.08)] hover:-translate-y-0.5 hover:border-[#7d5a44]/60"
                      }`}
                    >
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,#f5f1ea_0%,#d7c9b8_52%,#7d5a44_100%)] text-base font-semibold text-[#4a342a] shadow-[inset_0_4px_10px_rgba(255,255,255,0.28)]">
                        {combo.name
                          .split(" ")
                          .slice(0, 2)
                          .map((word) => word[0])
                          .join("")}
                      </div>
                      <div className="absolute right-3 top-3">
                        <span className="rounded-full bg-[#7d5a44] px-1.5 py-0.5 text-[10px] font-semibold text-[#f5f1ea]">
                          COMBO
                        </span>
                      </div>
                      <div className="flex justify-between items-start">
                        <h3 className={`pr-12 text-sm font-semibold ${unavailable ? "text-[#7d5a44]" : "text-[#2d2019]"}`}>
                          {combo.name}
                        </h3>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-[#7e6656]">
                        {combo.description}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <p className={`text-sm font-bold ${unavailable ? "text-[#7d5a44]" : "text-[#4a342a]"}`}>
                          P{combo.price.toFixed(2)}
                        </p>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          unavailable
                            ? "bg-[#d7c9b8] text-[#4a342a]"
                            : "bg-[#4a342a] text-[#f5f1ea]"
                        }`}>
                          {comboStock}
                        </span>
                      </div>
                      {unavailable && reason && (
                        <p className="mt-1 text-[10px] text-[#7d5a44]">
                          {reason}
                        </p>
                      )}
                    </button>
                  )
                })}

              {/* Show regular products when not in Combos-only view */}
              {selectedCategory !== "Combos" && filteredProducts.map((product) => {
                const inCart = cart.find((item) => item.product.id === product.id)
                const hasIngredientIssue = unavailableProducts.has(product.id)
                const availableStock = getProductAvailableStock(product, ingredients)
                const isUnavailable = availableStock <= 0 || hasIngredientIssue
                
                return (
                  <button
                    key={product.id}
                    onClick={() => handleProductClick(product)}
                    disabled={isUnavailable}
                    className={`group relative overflow-hidden rounded-[22px] border p-3 text-left transition-all ${
                      isUnavailable
                        ? "cursor-not-allowed border-[#d7c9b8] bg-[#ede3d8]"
                        : inCart
                        ? "border-[#4a342a] bg-[#efe3d8] shadow-[0_16px_30px_rgba(74,52,42,0.08)]"
                        : "border-[#d7c9b8] bg-[#f5f1ea] shadow-[0_12px_28px_rgba(74,52,42,0.08)] hover:-translate-y-0.5 hover:border-[#7d5a44]/55"
                    }`}
                  >
                    {hasIngredientIssue && (
                      <div className="absolute right-3 top-3" title={unavailableProducts.get(product.id)?.join(", ")}>
                        <AlertTriangle className="h-4 w-4 text-[#b2967d]" />
                      </div>
                    )}
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,#f5f1ea_0%,#d7c9b8_52%,#7d5a44_100%)] text-base font-semibold text-[#4a342a] shadow-[inset_0_4px_10px_rgba(255,255,255,0.28)]">
                      {product.name
                        .split(" ")
                        .slice(0, 2)
                        .map((word) => word[0])
                        .join("")}
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <h3 className={`text-sm font-semibold ${isUnavailable ? "text-[#7d5a44]" : "text-[#2d2019]"}`}>{product.name}</h3>
                      <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        isUnavailable
                          ? "bg-[#d7c9b8] text-[#4a342a]"
                          : "bg-[#4a342a] text-[#f5f1ea]"
                      }`}>
                        {availableStock}
                      </span>
                    </div>
                    <p className={`mt-2 text-sm font-bold ${isUnavailable ? "text-[#7d5a44]" : "text-[#4a342a]"}`}>
                      P{product.price.toFixed(2)}
                    </p>
                    {hasIngredientIssue && (
                      <p className="mt-1 text-[10px] text-[#7d5a44]">
                        Warning: {unavailableProducts.get(product.id)?.[0] || "Unavailable ingredients"}
                      </p>
                    )}
                  </button>
                )
              })}

              {/* Empty state for Combos */}
              {selectedCategory === "Combos" && comboMeals.length === 0 && (
                <div className="col-span-2 md:col-span-3 lg:col-span-2 xl:col-span-3 text-center py-12 text-muted-foreground">
                  <p>No combo meals available.</p>
                  <p className="text-sm mt-2">Create combo meals in the Combos page.</p>
                </div>
              )}
              </div>
            </section>

            <aside className={`min-w-0 rounded-[24px] border border-[#d7c9b8] bg-[#f5f1ea]/92 shadow-[0_16px_32px_rgba(74,52,42,0.08)] xl:sticky xl:top-4 ${
              isOrderSummaryCollapsed ? "p-2" : "p-4 lg:p-5"
            }`}>
            <div className={`mb-4 flex items-center justify-between ${isOrderSummaryCollapsed ? "min-h-[420px] flex-col py-2" : ""}`}>
              {isOrderSummaryCollapsed ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsOrderSummaryCollapsed(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d7c9b8] bg-[#f5f1ea] text-[#7d5a44] transition hover:bg-[#ede3d8]"
                    aria-label="Expand order summary"
                  >
                    <PanelRightOpen className="h-4 w-4" />
                  </button>
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[#8c6c58]">Queue</p>
                      <p className="mt-1 text-lg font-semibold text-[#352419]">#{nextQueueNumberPreview}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[#8c6c58]">Items</p>
                      <p className="mt-1 text-lg font-semibold text-[#352419]">{cartItemCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[#8c6c58]">Total</p>
                      <p className="mt-1 text-lg font-semibold text-[#352419]">P{total.toFixed(2)}</p>
                    </div>
                  </div>
                  <button
                    onClick={confirmSale}
                    disabled={cart.length === 0 || (isCashPayment && cash < total)}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#4a342a] text-[#f5f1ea] transition hover:bg-[#7d5a44] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Pay now"
                  >
                    <ReceiptText className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#8c6c58]">Order Summary</p>
                <h2 className="mt-1 text-lg font-semibold text-[#352419] lg:text-xl">Queue #{nextQueueNumberPreview}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOrderSummaryCollapsed(true)}
                  className="hidden h-10 w-10 items-center justify-center rounded-xl border border-[#d7c9b8] text-[#7d5a44] transition hover:bg-[#ede3d8] xl:flex"
                  aria-label="Collapse order summary"
                >
                  <PanelRightClose className="h-4 w-4" />
                </button>
                <button onClick={clearCart} className="rounded-xl border border-[#d7c9b8] p-2 text-[#7d5a44] transition hover:bg-[#ede3d8]">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
                </>
              )}
            </div>

            {!isOrderSummaryCollapsed && (
            <>
            {/* Cart Items */}
            <div className="cafe-scrollbar mb-4 max-h-44 space-y-3 overflow-y-auto rounded-[22px] border border-[#d7c9b8] bg-[#f5f1ea] p-3 xl:max-h-[18rem]">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#8b7568]">
                  Your cart is empty
                </p>
              ) : (
                cart.map((item, index) => {
                  const itemKey = getCartItemKey(item)
                  const itemTotal = getCartItemUnitPrice(item)
                  const temperatureLabel = formatCoffeeTemperature(item.temperature)
                  
                  return (
                    <div key={`${itemKey}-${index}`} className="mb-3 rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea] p-3">
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#2d2019]">{item.product.name}</p>
                          {item.comboMeal && (
                            <div className="mt-1 text-xs text-[#7e6656]">
                              {item.comboMeal.items.map((comboItem, comboIndex) => {
                                const ingredient = ingredients.find((entry) => entry.id === comboItem.ingredientId)
                                const label = ingredient ? ingredient.name : `Ingredient ${comboItem.ingredientId ?? comboItem.productId}`
                                return (
                                  <span key={`${item.comboMeal?.id}-${comboIndex}`} className="block">
                                    {comboItem.quantity} x {label}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                          {temperatureLabel && (
                            <p className="mt-1 text-xs text-[#7e6656]">Served: {temperatureLabel}</p>
                          )}
                          {item.addOns && item.addOns.length > 0 && (
                            <div className="mt-1 text-xs text-[#7e6656]">
                              {item.addOns.map((addon) => (
                                <span key={addon.id} className="block">+ {addon.name} x{addon.selectedQuantity || 1} (P{(addon.price * (addon.selectedQuantity || 1)).toFixed(2)})</span>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-[#b2967d] font-medium mt-1">
                            P{itemTotal.toFixed(2)} each
                          </p>
                        </div>
                        {!item.comboMeal && (
                          <button
                            onClick={() => handleEditAddOns(index)}
                            className="ml-2 rounded p-1 text-[#7d5a44] transition hover:bg-[#ede3d8] hover:text-[#4a342a]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity(itemKey, -1)}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d7c9b8] text-xs text-[#4a342a]"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-xs">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(itemKey, 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4a342a] text-xs text-[#f7ede4]"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="space-y-4 border-t border-[#efe2d8] pt-4">
              {currentUser?.role === "admin" && (
                <div className="rounded-[20px] border border-[#d7c9b8] bg-[#f5f1ea] p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#7d5a44]">Live POS Monitor</p>
                      <p className="text-sm font-semibold text-foreground">Cashier Active Orders</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-[#d7c9b8] bg-[#ede3d8] px-2.5 py-2">
                      <Activity className="h-4 w-4 text-[#4a342a]" />
                      <span className="text-sm font-semibold text-[#4a342a]">{activeOrders.length}</span>
                    </div>
                  </div>

                  {activeOrders.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[#d7c9b8] bg-[#fdf7f1] px-3 py-4 text-center text-xs text-muted-foreground">
                      No active cashier orders right now.
                    </p>
                  ) : (
                    <div className="cafe-scrollbar max-h-56 space-y-2 overflow-y-auto pr-1">
                      {activeOrders.map((order) => (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => void handleTakeOverActiveOrder(order)}
                          disabled={currentUser?.role !== "admin"}
                          className="w-full rounded-xl border border-[#d7c9b8] bg-[#f5f1ea] p-3 text-left transition-colors hover:bg-[#ede3d8] disabled:cursor-default disabled:hover:bg-[#f5f1ea]"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#4a342a]">{order.cashierName}</p>
                              <p className="text-[10px] uppercase tracking-[0.16em] text-[#7d5a44]">{order.stationId}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-[#4a342a]">P{order.total.toFixed(2)}</p>
                              <p className="text-[10px] text-muted-foreground">Updated {formatMonitorTime(order.lastUpdatedAt)}</p>
                            </div>
                          </div>

                          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#7d5a44]">
                            <span>{order.cartItemCount} item(s)</span>
                            <span>•</span>
                            <span className="capitalize">{order.paymentMethod}</span>
                            <span>•</span>
                            <span>Started {formatMonitorTime(order.startedAt)}</span>
                          </div>

                          <div className="space-y-1">
                            {order.items.slice(0, 3).map((item, index) => (
                              <div key={`${order.id}-${item.product.id}-${index}`} className="flex items-center justify-between text-xs">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-foreground">{item.product.name}</p>
                                  <p className="truncate text-muted-foreground">
                                    {[item.temperature, item.addOns?.length ? `${item.addOns.length} add-on(s)` : null].filter(Boolean).join(" • ") || "Standard"}
                                  </p>
                                </div>
                                <span className="ml-2 font-semibold text-[#4a342a]">x{item.quantity}</span>
                              </div>
                            ))}
                            {order.items.length > 3 && (
                              <p className="text-[10px] text-[#7d5a44]">+{order.items.length - 3} more line item(s)</p>
                            )}
                          </div>
                          {currentUser?.role === "admin" && (
                            <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[#7d5a44]">
                              {order.cashierUserId === currentUser.id ? "Currently on your station" : "Click to take over"}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Payment Method */}
              <div>
                <label className="mb-2 block text-xs text-[#8b7568] lg:text-sm">Mode of Payment</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    const nextPaymentMethod = e.target.value as typeof paymentMethod
                    setPaymentMethod(nextPaymentMethod)
                    if (nextPaymentMethod === "cash") {
                      setCashReceived("")
                    }
                  }}
                  className="w-full rounded-2xl border border-[#d7c9b8] bg-[#f5f1ea] px-3 py-2 text-sm text-foreground outline-none transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
                >
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                </select>
              </div>

              {/* Discount */}
              <div>
                <label className="mb-2 block text-xs text-[#8b7568] lg:text-sm">Discount</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="w-full rounded-2xl border border-[#d7c9b8] bg-[#f5f1ea] px-3 py-2 text-sm text-foreground outline-none transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
                >
                  <option value="none">No Discount</option>
                  <option value="senior">Senior Citizen (20%)</option>
                  <option value="pwd">PWD (20%)</option>
                </select>
              </div>

              {/* Breakdown */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">P{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between py-1 text-[#4a342a]">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-medium">-P{discountAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Total Amount */}
              <div className="flex items-center justify-between border-t border-[#efe2d8] pt-3">
                <span className="text-sm font-semibold text-foreground">Total Amount</span>
                <span className="text-2xl font-bold text-[#4a342a]">
                  P{total.toFixed(2)}
                </span>
              </div>

              {/* Cash Received */}
              <div className="pt-2">
                <label className="mb-1 block text-xs text-muted-foreground">
                  {isCashPayment ? "Cash Received" : "Amount Received"}
                </label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0.00"
                  disabled={!isCashPayment}
                  className="w-full rounded-xl border border-[#d7c9b8] bg-[#f5f1ea] px-3 py-2 text-right text-sm outline-none focus:ring-2 focus:ring-[#4a342a] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                />
                {!isCashPayment && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-filled for GCash payments.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-[#ede3d8] px-3 py-3">
                <span className="text-sm font-semibold text-foreground">Change</span>
                <span className="text-xl font-bold text-[#4a342a]">P{change.toFixed(2)}</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={confirmSale}
                  disabled={cart.length === 0 || (isCashPayment && cash < total)}
                  className="rounded-xl bg-[#4a342a] py-3 text-sm font-semibold text-[#f5f1ea] transition hover:bg-[#7d5a44] disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
                >
                  Pay Now
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-[#b2967d] bg-[#d7c9b8] py-3 text-sm font-semibold text-[#4a342a] transition hover:bg-[#b2967d]"
                >
                  Hold Order
                </button>
                <button
                  onClick={openVoidModal}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#7d5a44] py-3 text-sm font-semibold text-[#f5f1ea] transition hover:bg-[#4a342a]"
                >
                  <Ban className="h-4 w-4" />
                  Cancel Order
                </button>
              </div>
            </div>
            </>
            )}
            </aside>
          </div>
        </div>
      </main>

      {/* Add-Ons Modal */}
      {showAddOnsModal && selectedProductForAddOns && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f241d]/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-[400px] max-h-[90vh] overflow-y-auto rounded-[28px] border border-[#f5f1ea]/60 bg-[rgba(245,241,234,0.96)] p-6 shadow-[0_24px_56px_rgba(74,52,42,0.16)] backdrop-blur-xl lg:p-7">
            <h2 className="text-xl font-bold text-[#4a342a] mb-2">
              {selectedProductForAddOns.name}
            </h2>
            <p className="text-[#b2967d] font-bold text-lg mb-4">
              P{selectedProductForAddOns.price.toFixed(2)}
            </p>

            {productSupportsTemperature(selectedProductForAddOns) && (
              <div className="mb-4">
                <h3 className="font-semibold text-foreground mb-3">Serve it:</h3>
                <div className="grid grid-cols-2 gap-2">
                  {coffeeTemperatures.map((temperature) => {
                    const isSelected = selectedTemperature === temperature
                    return (
                      <button
                        key={temperature}
                        onClick={() => setSelectedTemperature(temperature)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${
                          isSelected
                            ? "bg-[#f5f1ea] border-2 border-[#4a342a] text-[#7d5a44]"
                            : "bg-muted hover:bg-muted/80 border-2 border-transparent text-foreground"
                        }`}
                      >
                        {temperature}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            
            {getAvailableAddOns(selectedProductForAddOns).length > 0 ? (
              <>
                <h3 className="font-semibold text-foreground mb-3">Add extras:</h3>
                <div className="cafe-scrollbar space-y-2 mb-4 max-h-60 overflow-y-auto pr-1">
                  {getAvailableAddOns(selectedProductForAddOns).map((addon) => {
                    const selectedAddOn = selectedAddOns.find((a) => a.id === addon.id)
                    const selectedQuantity = selectedAddOn?.selectedQuantity || 0
                    const isSelected = selectedQuantity > 0
                    const unavailableReason = getUnavailableAddOnReason(addon, Math.max(selectedQuantity, 1))
                    const isUnavailable = Boolean(unavailableReason)
                    return (
                      <div
                        key={addon.id}
                        className={`w-full p-3 rounded-lg transition-colors flex justify-between items-center ${
                          isUnavailable
                            ? "bg-[#efe3da] border-2 border-[#b2967d]"
                            : isSelected
                            ? "bg-[#f5f1ea] border-2 border-[#4a342a]"
                            : "bg-muted border-2 border-transparent"
                        }`}
                      >
                        <div>
                          <span className="font-medium block">{addon.name}</span>
                          <span className="text-[#b2967d] font-bold">+P{addon.price}</span>
                          {unavailableReason && (
                            <span className="mt-1 block text-xs text-[#7d5a44]">
                              Warning: {unavailableReason}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateSelectedAddOnQuantity(addon, -1)}
                            className="h-8 w-8 rounded-full border border-[#b2967d]/50 text-[#4a342a] disabled:opacity-40"
                            disabled={!isSelected}
                          >
                            -
                          </button>
                          <span className="min-w-6 text-center font-semibold text-foreground">{selectedQuantity}</span>
                          <button
                            type="button"
                            onClick={() => updateSelectedAddOnQuantity(addon, 1)}
                            className="h-8 w-8 rounded-full border border-[#b2967d]/50 text-[#4a342a] disabled:opacity-40"
                            disabled={isUnavailable}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground mb-4">No add-ons available for this item.</p>
            )}
            
            {/* Selected Add-Ons Summary */}
            {selectedAddOns.length > 0 && (
              <div className="bg-muted rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-muted-foreground mb-1">Selected Add-ons:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedAddOns.map((addon) => (
                    <span key={addon.id} className="text-xs bg-[#4a342a] text-[#f5f1ea] px-2 py-1 rounded-full">
                      {addon.name} x{addon.selectedQuantity || 1}
                    </span>
                  ))}
                </div>
                <p className="text-right font-bold text-[#b2967d] mt-2">
                  Total: P{(
                    selectedProductForAddOns.price +
                    selectedAddOns.reduce((acc, a) => acc + a.price * (a.selectedQuantity || 1), 0)
                  ).toFixed(2)}
                </p>
              </div>
            )}

            {productSupportsTemperature(selectedProductForAddOns) && (
              <p className="text-sm text-muted-foreground mb-4">
                Temperature: <span className="font-medium text-foreground">{formatCoffeeTemperature(selectedTemperature)}</span>
              </p>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddOnsModal(false)
                  setSelectedProductForAddOns(null)
                  setSelectedAddOns([])
                  setSelectedTemperature("hot")
                  setEditingCartIndex(null)
                }}
                className="flex-1 rounded-xl border border-[#d7c9b8] bg-[#f5f1ea] py-3 text-[#4a342a] font-semibold transition-colors hover:bg-[#ede3d8]"
              >
                Cancel
              </button>
              <button
                onClick={editingCartIndex !== null ? saveEditedAddOns : confirmAddToCart}
                className="flex-1 rounded-xl bg-[#7d5a44] py-3 text-[#f5f1ea] font-semibold transition-colors hover:bg-[#4a342a]"
              >
                {editingCartIndex !== null ? "Save Changes" : "Add to Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastTransaction && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2f241d]/55 p-4 backdrop-blur-[2px]">
          <div className="flex min-h-full items-start justify-center py-4">
            <div className="flex max-h-[calc(100vh-4rem)] w-full max-w-sm flex-col rounded-[28px] border border-[#f5f1ea]/60 bg-[rgba(245,241,234,0.96)] p-6 text-[#4a342a] shadow-[0_24px_56px_rgba(74,52,42,0.16)] backdrop-blur-xl lg:max-w-md lg:p-8">
              <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
              <h2 className="text-2xl font-bold text-center mb-1">AL FRESCO CAFE</h2>
              <p className="text-center text-muted-foreground mb-1">Official Receipt</p>
              <p className="text-center text-sm font-medium mb-1">
                Order No: {lastTransaction.id}
              </p>
              <p className="text-center text-sm text-muted-foreground mb-4">
                {lastTransaction.date} {lastTransaction.time}
              </p>

              <div className="border-t border-dashed border-border py-4 space-y-2 font-mono text-sm">
                {lastTransaction.items.map((item, index) => {
                  const itemTotal = getCartItemUnitPrice(item) * item.quantity
                  const temperatureLabel = formatCoffeeTemperature(item.temperature)
                  return (
                    <div key={`${getCartItemKey(item)}-${index}`}>
                      <div className="flex justify-between gap-3">
                        <span className="min-w-0 break-words">
                          {item.product.name}{temperatureLabel ? ` (${temperatureLabel})` : ""} x{item.quantity}
                        </span>
                        <span className="shrink-0">P{itemTotal.toFixed(2)}</span>
                      </div>
                      {item.comboMeal && (
                        <div className="text-xs text-muted-foreground pl-2">
                          {item.comboMeal.items.map((comboItem, comboIndex) => {
                            const ingredient = ingredients.find((entry) => entry.id === comboItem.ingredientId)
                            const label = ingredient ? ingredient.name : `Ingredient ${comboItem.ingredientId ?? comboItem.productId}`
                            return (
                              <div key={`${item.comboMeal?.id}-${comboIndex}`}>
                                {comboItem.quantity} x {label}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {item.addOns && item.addOns.length > 0 && (
                        <div className="text-xs text-muted-foreground pl-2">
                          {item.addOns.map((addon) => (
                            <div key={addon.id}>+ {addon.name} x{addon.selectedQuantity || 1}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-dashed border-border py-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>P{lastTransaction.subtotal.toFixed(2)}</span>
                </div>
                {lastTransaction.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span>DISCOUNT:</span>
                    <span>-P{lastTransaction.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-dashed border-border pt-2 flex justify-between font-bold text-base">
                  <span>TOTAL:</span>
                  <span>P{lastTransaction.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span>CASH:</span>
                  <span>P{lastTransaction.cashReceived.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>CHANGE:</span>
                  <span>P{lastTransaction.change.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 gap-3">
                  <span>MODE OF PAYMENT:</span>
                  <span className="capitalize text-right">{lastTransaction.paymentMethod === "gcash" ? "GCash" : "Cash"}</span>
                </div>
              </div>

              <div className="text-center text-xs text-muted-foreground py-3 border-t border-dashed border-border">
                <p>PROCESSED BY: {lastTransaction.processedBy.toUpperCase()}</p>
              </div>
              </div>

              <div className="mt-4 grid shrink-0 gap-3 sm:grid-cols-2">
                <button
                  onClick={cancelReceiptSale}
                  disabled={isCancellingReceiptSale}
                  className="rounded-xl border border-red-200 bg-red-50 py-3 font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCancellingReceiptSale ? "Cancelling..." : "CANCEL SALE"}
                </button>
                <button
                  onClick={closeReceipt}
                  disabled={isCancellingReceiptSale}
                  className="rounded-xl bg-[#7d5a44] py-3 font-semibold text-[#f5f1ea] transition-colors hover:bg-[#4a342a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  DONE
                </button>
              </div>
            </div>
          </div>
        </div>
  )}

      {/* Void Transaction Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f241d]/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto rounded-[28px] border border-[#f5f1ea]/60 bg-[rgba(245,241,234,0.96)] p-6 text-[#4a342a] shadow-[0_24px_56px_rgba(74,52,42,0.16)] backdrop-blur-xl lg:p-7">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#4a342a] flex items-center gap-2">
                <Ban className="h-5 w-5" />
                Void Transaction
              </h2>
              <button
                onClick={closeVoidModal}
                className="rounded-full border border-[#d7c9b8]/80 bg-[#f5f1ea]/95 p-2 text-[#7d5a44] transition-colors hover:bg-[#ede3d8] hover:text-[#4a342a]"
              >
                <span className="block leading-none">&times;</span>
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Select a transaction to void. Admin void key is required to complete this action.
            </p>

            {/* Recent Transactions List */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Recent Transactions
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-2">
                {recentTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent transactions to void
                  </p>
                ) : (
                  recentTransactions.map((transaction) => (
                    <button
                      key={transaction.id}
                      onClick={() => setSelectedTransactionToVoid(transaction)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedTransactionToVoid?.id === transaction.id
                          ? "bg-[#f5f1ea] border-2 border-[#b2967d]"
                          : "bg-muted hover:bg-muted/80 border-2 border-transparent"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{transaction.id}</p>
                          <p className="text-xs text-muted-foreground">
                            {transaction.date} {transaction.time}
                          </p>
                        </div>
                        <p className="font-bold text-[#b2967d]">
                          P{transaction.total.toFixed(2)}
                        </p>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {transaction.items.map((item) => item.product.name + (item.temperature ? ` (${formatCoffeeTemperature(item.temperature)})` : "")).join(", ")}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Selected Transaction Details */}
            {selectedTransactionToVoid && (
              <div className="mb-4 p-3 bg-[#f5f1ea] border border-[#d7c9b8] rounded-lg">
                <p className="text-sm font-medium text-[#4a342a] mb-2">
                  Selected Transaction: {selectedTransactionToVoid.id}
                </p>
                <div className="space-y-1 text-sm">
                  {selectedTransactionToVoid.items.map((item) => (
                    <div key={getCartItemKey(item)} className="flex justify-between">
                      <span>{item.product.name}{item.temperature ? ` (${formatCoffeeTemperature(item.temperature)})` : ""} x{item.quantity}</span>
                      <span>P{(getCartItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold pt-2 border-t border-[#d7c9b8]">
                    <span>Total:</span>
                    <span>P{selectedTransactionToVoid.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Void Key Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Admin Void Key
              </label>
              <div className="relative">
                <input
                  type={showVoidKeyInput ? "text" : "password"}
                  value={voidKeyInput}
                  onChange={(e) => setVoidKeyInput(e.target.value)}
                  placeholder="Enter admin void key"
                  className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border-0 focus:ring-2 focus:ring-[#4a342a] outline-none pr-12 font-mono tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowVoidKeyInput(!showVoidKeyInput)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showVoidKeyInput ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Call your admin to enter the void key
              </p>
            </div>

            {/* Error Message */}
            {voidError && (
              <div className="mb-4 rounded-xl border border-[#d7c9b8] bg-[#f5f1ea] p-3 text-sm text-[#7d5a44]">
                {voidError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={closeVoidModal}
                className="flex-1 rounded-xl border border-[#d7c9b8] bg-[#f5f1ea] py-3 text-[#4a342a] font-semibold transition-colors hover:bg-[#ede3d8]"
              >
                Cancel
              </button>
              <button
                onClick={handleVoidTransaction}
                disabled={!selectedTransactionToVoid || !voidKeyInput || isVoiding}
                className="flex-1 rounded-xl bg-[#7d5a44] py-3 text-[#f5f1ea] font-semibold transition-colors hover:bg-[#4a342a] disabled:bg-muted disabled:text-muted-foreground flex items-center justify-center gap-2"
              >
                {isVoiding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Voiding...
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" />
                    Void Transaction
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}


