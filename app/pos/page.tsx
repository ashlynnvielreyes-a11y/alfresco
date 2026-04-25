"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { Search, Trash2, Minus, Plus, AlertTriangle, Ban, Eye, EyeOff, Loader2, Pencil } from "lucide-react"
import { getProducts, saveTransaction, getTransactions, getIngredients, saveIngredients, checkIngredientAvailability, getProductAvailableStock, voidTransaction, getCurrentUser, getComboMeals, getAddOns, deductCartIngredients } from "@/lib/store"
import { useDebounce } from "@/hooks/useDebounce"
import { createClient } from "@/lib/supabase/client"
import type { Product, CartItem, Transaction, Ingredient, AddOn, ComboMeal, DrinkSize, CoffeeTemperature } from "@/lib/types"

const categories = ["All Items", "Coffee", "Milk Tea", "Fruit Tea", "Silog", "Combos"] as const
const drinkCategoriesWithSizes: Product["category"][] = ["Coffee", "Milk Tea", "Fruit Tea"]
const drinkSizes: DrinkSize[] = ["regular", "medium", "large"]
const coffeeTemperatures: CoffeeTemperature[] = ["hot", "cold"]

function getAddOnKey(addOns?: AddOn[]) {
  return (addOns || []).map((a) => a.id).sort().join("-")
}

function getCartItemKey(item: CartItem) {
  return `${item.product.id}::${item.size || "none"}::${item.temperature || "none"}::${getAddOnKey(item.addOns)}`
}

function formatDrinkSize(size?: DrinkSize) {
  if (!size) return null
  return size.charAt(0).toUpperCase() + size.slice(1)
}

function formatCoffeeTemperature(temperature?: CoffeeTemperature) {
  if (!temperature) return null
  return temperature.charAt(0).toUpperCase() + temperature.slice(1)
}

function getDrinkSizePriceAdjustment(size?: DrinkSize) {
  if (size === "medium") return 10
  if (size === "large") return 20
  return 0
}

function getCartItemUnitPrice(item: CartItem) {
  const sizeAdjustment = getDrinkSizePriceAdjustment(item.size)
  const addOnsTotal = (item.addOns || []).reduce((acc, addon) => acc + addon.price, 0)
  return item.product.price + sizeAdjustment + addOnsTotal
}

export default function POSPage() {
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
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [selectedTransactionToVoid, setSelectedTransactionToVoid] = useState<Transaction | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; role: string } | null>(null)

  // Add-ons modal state
  const [showAddOnsModal, setShowAddOnsModal] = useState(false)
  const [selectedProductForAddOns, setSelectedProductForAddOns] = useState<Product | null>(null)
  const [selectedAddOns, setSelectedAddOns] = useState<AddOn[]>([])
  const [selectedSize, setSelectedSize] = useState<DrinkSize>("regular")
  const [selectedTemperature, setSelectedTemperature] = useState<CoffeeTemperature>("hot")
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null)

  // Payment and discount state
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash">("cash")
  const [discountType, setDiscountType] = useState<"none" | "senior" | "pwd">("none")

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  useEffect(() => {
    // Initialize all data from localStorage and Supabase
    const initializeData = async () => {
      setProducts(getProducts())
      setIngredients(getIngredients())
      setComboMeals(getComboMeals())
      setAllAddOns(getAddOns())
      const user = getCurrentUser()
      setCurrentUser(user)
      console.log("[v0] POS page initialized with user:", user?.username)
      
      // Load transactions from Supabase
      await loadRecentTransactions()
    }
    
    initializeData()
  }, [])

  const loadRecentTransactions = async () => {
    const allTransactions = await getTransactions()
    // Get last 10 non-voided transactions
    const recent = allTransactions
      .filter((t) => !t.voided)
      .slice(-10)
      .reverse()
    setRecentTransactions(recent)
  }

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

  const productSupportsSizes = useCallback((product: Product) => {
    return drinkCategoriesWithSizes.includes(product.category)
  }, [])

  const productSupportsTemperature = useCallback((product: Product) => {
    return product.category === "Coffee"
  }, [])

  const getAvailableAddOns = useCallback((product: Product): AddOn[] => {
    if (product.category === "Coffee" || product.category === "Milk Tea" || product.category === "Fruit Tea") {
      return allAddOns.filter(a => a.category === "drink")
    } else if (product.category === "Silog") {
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
      setSelectedAddOns([])
      setSelectedSize("regular")
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

  const toggleAddOn = useCallback((addOn: AddOn) => {
    setSelectedAddOns((prev) => {
      const exists = prev.find((a) => a.id === addOn.id)
      if (exists) {
        return prev.filter((a) => a.id !== addOn.id)
      }
      return [...prev, addOn]
    })
  }, [])

  const confirmAddToCart = useCallback(() => {
    if (!selectedProductForAddOns) return
    
    const product = selectedProductForAddOns
    const addOns = selectedAddOns
    const size = productSupportsSizes(product) ? selectedSize : undefined
    const temperature = productSupportsTemperature(product) ? selectedTemperature : undefined
    
    setCart((prev) => {
      // Create a unique key based on product + size + temperature + add-ons combination
      const addOnKey = getAddOnKey(addOns)
      const existing = prev.find((item) => 
        item.product.id === product.id && 
        item.size === size &&
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
          item.size === size &&
          item.temperature === temperature &&
          getAddOnKey(item.addOns) === addOnKey
            ? { ...item, quantity: newQuantity }
            : item
        )
      }
      return [...prev, { product, quantity: 1, size, temperature, addOns: addOns.length > 0 ? addOns : undefined }]
    })
    
    setShowAddOnsModal(false)
    setSelectedProductForAddOns(null)
    setSelectedAddOns([])
    setSelectedSize("regular")
    setSelectedTemperature("hot")
    setEditingCartIndex(null)
  }, [selectedProductForAddOns, selectedAddOns, selectedSize, selectedTemperature, ingredients, productSupportsSizes, productSupportsTemperature])

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
    setSelectedAddOns(cartItem.addOns || [])
    setSelectedSize(cartItem.size || "regular")
    setSelectedTemperature(cartItem.temperature || "hot")
    setEditingCartIndex(cartIndex)
    setShowAddOnsModal(true)
  }, [cart])

  // Save edited add-ons
  const saveEditedAddOns = useCallback(() => {
    if (editingCartIndex === null || !selectedProductForAddOns) return
    
    setCart((prev) => {
      if (editingCartIndex >= prev.length) return prev
      
      const newCart = [...prev]
      const currentItem = newCart[editingCartIndex]
      
      // Update the item with the new add-ons
      newCart[editingCartIndex] = {
        ...currentItem,
        size: productSupportsSizes(currentItem.product) ? selectedSize : undefined,
        temperature: productSupportsTemperature(currentItem.product) ? selectedTemperature : undefined,
        addOns: selectedAddOns.length > 0 ? selectedAddOns : undefined
      }
      
      // Check if we need to merge items (e.g., when removing all add-ons creates a duplicate)
      const updatedItem = newCart[editingCartIndex]
      const updatedAddOnKey = getAddOnKey(updatedItem.addOns)
      
      // Find if there's another item with the same product, size, and add-on combination
      const duplicateIndex = newCart.findIndex((item, idx) => 
        idx !== editingCartIndex &&
        item.product.id === updatedItem.product.id &&
        item.size === updatedItem.size &&
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
    setSelectedAddOns([])
    setSelectedSize("regular")
    setSelectedTemperature("hot")
    setEditingCartIndex(null)
  }, [editingCartIndex, selectedProductForAddOns, selectedAddOns, selectedSize, selectedTemperature, productSupportsSizes, productSupportsTemperature])

  // Handle adding a combo meal to cart - adds all items as a bundle
  const handleComboClick = useCallback((combo: ComboMeal) => {
    // Check availability of all items in the combo
    for (const comboItem of combo.items) {
      const product = products.find(p => p.id === comboItem.productId)
      if (!product) {
        alert(`Product in combo not found`)
        return
      }
      const { available, reason } = isProductAvailable(product, comboItem.quantity)
      if (!available) {
        alert(`Cannot add combo: ${product.name} - ${reason}`)
        return
      }
    }

    // Add each item in the combo to the cart
    setCart((prev) => {
      const newCart = [...prev]
      
      for (const comboItem of combo.items) {
        const product = products.find(p => p.id === comboItem.productId)
        if (!product) continue

        const existingIndex = newCart.findIndex((item) => 
          item.product.id === product.id && 
          (!item.addOns || item.addOns.length === 0)
        )
        
        if (existingIndex !== -1) {
          const newQuantity = newCart[existingIndex].quantity + comboItem.quantity
          const availableStock = getProductAvailableStock(product, ingredients)
          if (newQuantity <= availableStock) {
            newCart[existingIndex] = { ...newCart[existingIndex], quantity: newQuantity }
          }
        } else {
          newCart.push({ product, quantity: comboItem.quantity })
        }
      }
      
      return newCart
    })
  }, [products, ingredients, isProductAvailable])

  // Get minimum available stock for a combo (based on limiting item)
  const getComboAvailableStock = useCallback((combo: ComboMeal): number => {
    let minStock = Infinity
    
    for (const comboItem of combo.items) {
      const product = products.find(p => p.id === comboItem.productId)
      if (!product) return 0
      
      const productStock = getProductAvailableStock(product, ingredients)
      const comboQuantityPossible = Math.floor(productStock / comboItem.quantity)
      minStock = Math.min(minStock, comboQuantityPossible)
    }
    
    return minStock === Infinity ? 0 : minStock
  }, [products, ingredients])

  // Check if combo has any unavailable items
  const isComboUnavailable = useCallback((combo: ComboMeal): { unavailable: boolean; reason?: string } => {
    for (const comboItem of combo.items) {
      const product = products.find(p => p.id === comboItem.productId)
      if (!product) {
        return { unavailable: true, reason: "Missing product" }
      }
      
      const availableStock = getProductAvailableStock(product, ingredients)
      if (availableStock < comboItem.quantity) {
        return { unavailable: true, reason: `${product.name} out of stock` }
      }
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

  useEffect(() => {
    if (isCashPayment) return
    setCashReceived(total > 0 ? total.toFixed(2) : "")
  }, [isCashPayment, total])

  const confirmSale = async () => {
    // For non-cash payments, we don't need cash received
    const isValidPayment = isCashPayment ? cash >= total : true
    if (cart.length === 0 || !isValidPayment) return

    const now = new Date()
    const transactions = await getTransactions()
    const transactionId = String(transactions.length + 1).padStart(5, "0")

    const transaction: Transaction = {
      id: `#${transactionId}`,
      items: cart,
      subtotal,
      discountType,
      discountPercent,
      discountAmount,
      total,
      paymentMethod,
      cashReceived: isCashPayment ? cash : total,
      change: isCashPayment ? change : 0,
      processedBy: currentUser?.username || "Unknown",
      date: now.toISOString().split("T")[0],
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase(),
      voided: false,
    }

    const updatedIngredients = deductCartIngredients(cart, ingredients)

    saveIngredients(updatedIngredients)
    await saveTransaction(transaction)
    setIngredients(updatedIngredients)
    setLastTransaction(transaction)
    setShowReceipt(true)
  }

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

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-hidden p-4 pb-4 pt-20 lg:p-6 lg:pb-6 lg:pt-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-10 h-72 w-72 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
          <div className="absolute right-8 top-24 h-64 w-64 rounded-full bg-[#7d5a44]/10 blur-3xl" />
        </div>
        <div className="relative z-10">
        <div className="flex flex-col xl:flex-row gap-4 lg:gap-6">
          {/* Menu Section */}
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#4a342a] mb-4">
              AL FRESCO MENU
            </h1>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search deliciousness..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-[#4a342a] outline-none text-base"
              />
            </div>

            {/* Category Filters */}
            <div className="flex gap-2 mb-4 lg:mb-6 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 lg:px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap text-sm lg:text-base flex-shrink-0 ${
                    selectedCategory === cat
                      ? "bg-[#4a342a] text-[#f5f1ea]"
                      : "bg-[#f5f1ea] border border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
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
                      className={`p-3 lg:p-4 rounded-lg border text-left transition-all relative ${
                        unavailable
                          ? "border-[#b2967d] bg-[#f5f1ea] cursor-not-allowed"
                          : "border-[#7d5a44] bg-[#f5f1ea] hover:border-[#4a342a] hover:bg-[#f5f1ea]"
                      }`}
                    >
                      <div className="absolute top-2 right-2">
                        <span className="text-[10px] lg:text-xs px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-full font-semibold bg-[#7d5a44] text-[#f5f1ea]">
                          COMBO
                        </span>
                      </div>
                      <div className="flex justify-between items-start">
                        <h3 className={`font-semibold pr-12 lg:pr-16 text-sm lg:text-base ${unavailable ? "text-[#7d5a44]" : "text-foreground"}`}>
                          {combo.name}
                        </h3>
                      </div>
                      <p className="text-[10px] lg:text-xs text-muted-foreground mt-1 line-clamp-2">
                        {combo.description}
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <p className={`font-bold text-sm lg:text-base ${unavailable ? "text-[#7d5a44]" : "text-[#4a342a]"}`}>
                          P{combo.price.toFixed(2)}
                        </p>
                        <span className={`text-[10px] lg:text-xs px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-full font-semibold ${
                          unavailable
                            ? "bg-[#d7c9b8] text-[#4a342a]"
                            : "bg-[#4a342a] text-[#f5f1ea]"
                        }`}>
                          {comboStock}
                        </span>
                      </div>
                      {unavailable && reason && (
                        <p className="text-[10px] lg:text-xs text-[#7d5a44] mt-1">
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
                    className={`p-3 lg:p-4 rounded-lg border text-left transition-all relative ${
                      isUnavailable
                        ? "border-[#b2967d] bg-[#f5f1ea] cursor-not-allowed"
                        : inCart
                        ? "border-[#4a342a] bg-[#f5f1ea]"
                        : "border-border bg-[#f5f1ea] hover:border-[#4a342a]"
                    }`}
                  >
                    {hasIngredientIssue && (
                      <div className="absolute top-2 right-2" title={unavailableProducts.get(product.id)?.join(", ")}>
                        <AlertTriangle className="h-4 w-4 text-[#b2967d]" />
                      </div>
                    )}
                    <div className="flex justify-between items-start gap-2">
                      <h3 className={`font-semibold text-sm lg:text-base ${isUnavailable ? "text-[#7d5a44]" : "text-foreground"}`}>{product.name}</h3>
                      <span className={`text-[10px] lg:text-xs px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-full font-semibold flex-shrink-0 ${
                        isUnavailable
                          ? "bg-[#d7c9b8] text-[#4a342a]"
                          : "bg-[#4a342a] text-[#f5f1ea]"
                      }`}>
                        {availableStock}
                      </span>
                    </div>
                    <p className={`font-bold mt-2 text-sm lg:text-base ${isUnavailable ? "text-[#7d5a44]" : "text-[#4a342a]"}`}>
                      P{product.price.toFixed(2)}
                    </p>
                    {hasIngredientIssue && (
                      <p className="text-[10px] lg:text-xs text-[#7d5a44] mt-1">
                        Missing ingredients
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
          </div>

          {/* Order Panel */}
          <div className="w-full xl:w-80 rounded-lg border border-border bg-[rgba(245,241,234,0.74)] p-4 backdrop-blur-md flex-shrink-0">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg lg:text-xl font-bold text-[#4a342a]">Current Order</h2>
              <button onClick={clearCart} className="p-2 hover:bg-muted rounded-lg">
                <Trash2 className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Cart Items */}
            <div className="space-y-3 mb-4 max-h-40 lg:max-h-60 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Your cart is empty
                </p>
              ) : (
                cart.map((item, index) => {
                  const itemKey = getCartItemKey(item)
                  const sizeAdjustment = getDrinkSizePriceAdjustment(item.size)
                  const itemTotal = getCartItemUnitPrice(item)
                  const sizeLabel = formatDrinkSize(item.size)
                  const temperatureLabel = formatCoffeeTemperature(item.temperature)
                  
                  return (
                    <div key={`${itemKey}-${index}`} className="border-b border-border pb-3 mb-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.product.name}</p>
                          {temperatureLabel && (
                            <p className="text-xs text-muted-foreground mt-1">Served: {temperatureLabel}</p>
                          )}
                          {sizeLabel && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Size: {sizeLabel}{sizeAdjustment > 0 ? ` (+P${sizeAdjustment})` : ""}
                            </p>
                          )}
                          {item.addOns && item.addOns.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {item.addOns.map((addon) => (
                                <span key={addon.id} className="block">+ {addon.name} (P{addon.price})</span>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-[#b2967d] font-medium mt-1">
                            P{itemTotal.toFixed(2)} each
                          </p>
                        </div>
                        <button
                          onClick={() => handleEditAddOns(index)}
                          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground ml-2"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity(itemKey, -1)}
                            className="w-5 h-5 flex items-center justify-center bg-muted rounded text-xs"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-xs">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(itemKey, 1)}
                            className="w-5 h-5 flex items-center justify-center bg-muted rounded text-xs"
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

            <div className="border-t border-border pt-4 space-y-4">
              {/* Payment Method */}
              <div>
                <label className="text-xs lg:text-sm text-muted-foreground block mb-2">Mode of Payment</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    const nextPaymentMethod = e.target.value as typeof paymentMethod
                    setPaymentMethod(nextPaymentMethod)
                    if (nextPaymentMethod === "cash") {
                      setCashReceived("")
                    }
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-[#f5f1ea] text-foreground focus:ring-2 focus:ring-[#4a342a] outline-none text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                </select>
              </div>

              {/* Discount */}
              <div>
                <label className="text-xs lg:text-sm text-muted-foreground block mb-2">Discount</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-[#f5f1ea] text-foreground focus:ring-2 focus:ring-[#4a342a] outline-none text-sm"
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
              <div className="flex justify-between items-center pt-3 border-t border-border">
                <span className="text-sm font-semibold text-foreground">Total Amount</span>
                <span className="text-2xl font-bold text-[#4a342a]">
                  P{total.toFixed(2)}
                </span>
              </div>

              {/* Cash Received */}
              <div className="pt-2">
                <label className="text-xs text-muted-foreground block mb-1">
                  {isCashPayment ? "Cash Received" : "Amount Received"}
                </label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0.00"
                  disabled={!isCashPayment}
                  className="w-full px-3 py-2 border border-border rounded-lg text-right text-sm focus:ring-2 focus:ring-[#4a342a] outline-none disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
                />
                {!isCashPayment && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-filled for GCash payments.
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center rounded-lg bg-[#f5f1ea] px-3 py-3">
                <span className="text-sm font-semibold text-foreground">Change</span>
                <span className="text-xl font-bold text-[#4a342a]">P{change.toFixed(2)}</span>
              </div>

              <button
                onClick={confirmSale}
                disabled={cart.length === 0 || (isCashPayment && cash < total)}
                className="w-full py-3 bg-[#4a342a] hover:bg-[#7d5a44] text-[#f5f1ea] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                CONFIRM SALE
              </button>

              <button
                onClick={openVoidModal}
                className="w-full py-3 bg-[#7d5a44] hover:bg-[#4a342a] text-[#f5f1ea] font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Ban className="h-4 w-4" />
                VOID TRANSACTION
              </button>
            </div>
          </div>
        </div>
        </div>
      </main>

      {/* Add-Ons Modal */}
      {showAddOnsModal && selectedProductForAddOns && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-[400px] max-h-[90vh] overflow-y-auto rounded-lg border border-[#f5f1ea]/60 bg-[rgba(245,241,234,0.82)] p-4 backdrop-blur-xl lg:p-6">
            <h2 className="text-xl font-bold text-[#4a342a] mb-2">
              {selectedProductForAddOns.name}
            </h2>
            <p className="text-[#b2967d] font-bold text-lg mb-4">
              P{selectedProductForAddOns.price.toFixed(2)}
            </p>

            {productSupportsSizes(selectedProductForAddOns) && (
              <div className="mb-4">
                <h3 className="font-semibold text-foreground mb-3">Choose size:</h3>
                <div className="grid grid-cols-3 gap-2">
                  {drinkSizes.map((size) => {
                    const isSelected = selectedSize === size
                    const sizeAdjustment = getDrinkSizePriceAdjustment(size)
                    return (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${
                          isSelected
                            ? "bg-[#f5f1ea] border-2 border-[#4a342a] text-[#7d5a44]"
                            : "bg-muted hover:bg-muted/80 border-2 border-transparent text-foreground"
                        }`}
                      >
                        <span className="block capitalize">{size}</span>
                        <span className="block text-[11px] opacity-80">
                          {sizeAdjustment > 0 ? `+P${sizeAdjustment}` : "Base"}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

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
                    const isSelected = selectedAddOns.some((a) => a.id === addon.id)
                    return (
                      <button
                        key={addon.id}
                        onClick={() => toggleAddOn(addon)}
                        className={`w-full p-3 rounded-lg text-left transition-colors flex justify-between items-center ${
                          isSelected
                            ? "bg-[#f5f1ea] border-2 border-[#4a342a]"
                            : "bg-muted hover:bg-muted/80 border-2 border-transparent"
                        }`}
                      >
                        <span className="font-medium">{addon.name}</span>
                        <span className="text-[#b2967d] font-bold">+P{addon.price}</span>
                      </button>
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
                      {addon.name}
                    </span>
                  ))}
                </div>
                <p className="text-right font-bold text-[#b2967d] mt-2">
                  Total: P{(
                    selectedProductForAddOns.price +
                    getDrinkSizePriceAdjustment(productSupportsSizes(selectedProductForAddOns) ? selectedSize : undefined) +
                    selectedAddOns.reduce((acc, a) => acc + a.price, 0)
                  ).toFixed(2)}
                </p>
              </div>
            )}

            {productSupportsSizes(selectedProductForAddOns) && (
              <p className="text-sm text-muted-foreground mb-4">
                Selected size: <span className="font-medium text-foreground">{formatDrinkSize(selectedSize)}</span>
                {getDrinkSizePriceAdjustment(selectedSize) > 0 ? ` (+P${getDrinkSizePriceAdjustment(selectedSize)})` : ""}
              </p>
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
                  setSelectedSize("regular")
                  setSelectedTemperature("hot")
                  setEditingCartIndex(null)
                }}
                className="flex-1 py-3 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingCartIndex !== null ? saveEditedAddOns : confirmAddToCart}
                className="flex-1 py-3 bg-[#4a342a] hover:bg-[#7d5a44] text-[#f5f1ea] font-semibold rounded-lg transition-colors"
              >
                {editingCartIndex !== null ? "Save Changes" : "Add to Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[#f5f1ea]/60 bg-[rgba(245,241,234,0.84)] p-6 backdrop-blur-xl lg:max-w-md lg:p-8">
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
                const sizeLabel = formatDrinkSize(item.size)
                const temperatureLabel = formatCoffeeTemperature(item.temperature)
                return (
                  <div key={`${getCartItemKey(item)}-${index}`}>
                    <div className="flex justify-between">
                      <span>{item.product.name}{temperatureLabel ? ` (${temperatureLabel})` : ""}{sizeLabel ? ` (${sizeLabel})` : ""} x{item.quantity}</span>
                      <span>P{itemTotal.toFixed(2)}</span>
                    </div>
                    {item.addOns && item.addOns.length > 0 && (
                      <div className="text-xs text-muted-foreground pl-2">
                        {item.addOns.map((addon) => (
                          <div key={addon.id}>+ {addon.name}</div>
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
              <div className="flex justify-between pt-2">
                <span>MODE OF PAYMENT:</span>
                <span className="capitalize">{lastTransaction.paymentMethod === "gcash" ? "GCash" : "Cash"}</span>
              </div>
            </div>

            <div className="text-center text-xs text-muted-foreground py-3 border-t border-dashed border-border">
              <p>PROCESSED BY: {lastTransaction.processedBy.toUpperCase()}</p>
            </div>

<button
  onClick={closeReceipt}
  className="w-full py-3 bg-[#4a342a] text-[#f5f1ea] font-semibold rounded-lg mt-4"
  >
  DONE
  </button>
  </div>
  </div>
  )}

      {/* Void Transaction Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto rounded-lg border border-[#f5f1ea]/60 bg-[rgba(245,241,234,0.82)] p-4 backdrop-blur-xl lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#4a342a] flex items-center gap-2">
                <Ban className="h-5 w-5" />
                Void Transaction
              </h2>
              <button
                onClick={closeVoidModal}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
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
                        {transaction.items.map((item) => item.product.name + (item.temperature ? ` (${formatCoffeeTemperature(item.temperature)})` : "") + (item.size ? ` (${formatDrinkSize(item.size)})` : "")).join(", ")}
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
                      <span>{item.product.name}{item.temperature ? ` (${formatCoffeeTemperature(item.temperature)})` : ""}{item.size ? ` (${formatDrinkSize(item.size)})` : ""} x{item.quantity}</span>
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
              <div className="mb-4 p-3 bg-[#f5f1ea] border border-[#d7c9b8] rounded-lg text-[#7d5a44] text-sm">
                {voidError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={closeVoidModal}
                className="flex-1 py-3 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleVoidTransaction}
                disabled={!selectedTransactionToVoid || !voidKeyInput || isVoiding}
                className="flex-1 py-3 bg-[#7d5a44] hover:bg-[#4a342a] disabled:bg-muted disabled:text-muted-foreground text-[#f5f1ea] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
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
  )
  }


