"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Plus, Pencil, Trash2, Link, X, Check, Search, AlertTriangle, MoreVertical } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { initializeSupabaseStore, getIngredients, addIngredient, updateIngredient, deleteIngredient, getProducts, addIngredientStock, getIngredientExpirationSummary, getExpirationLogs } from "@/lib/store"
import type { Ingredient, IngredientExpirationSummary, Product, ExpirationLog } from "@/lib/types"

type FormMode = "list" | "add" | "edit" | "assign" | "restock"

type IngredientFormState = {
  productId: string
  name: string
  unit: string
  stock: string
  expirationDate: string
}

function formatDate(date?: string | null) {
  if (!date) return "No expiry set"
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return "Invalid expiry date"
  return parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateTime(date?: string | null) {
  if (!date) return "Unknown"
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return "Unknown"
  return parsedDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function getExpirationStatus(date?: string | null) {
  if (!date) return { text: "No expiry", tone: "bg-[#d7c9b8] text-[#4a342a]" }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiration = new Date(date)
  if (Number.isNaN(expiration.getTime())) {
    return { text: "Invalid date", tone: "bg-[#e8ddd2] text-[#7d5a44]" }
  }
  expiration.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((expiration.getTime() - today.getTime()) / 86400000)

  if (diffDays < 0) return { text: "Expired", tone: "bg-red-100 text-red-700" }
  if (diffDays <= 3) return { text: "Near Expiry", tone: "bg-yellow-100 text-yellow-700" }
  return { text: "Safe", tone: "bg-green-100 text-green-700" }
}

function getExpirationPresentation(summary: IngredientExpirationSummary) {
  if (summary.expirationStatus === "expired") {
    return {
      date: summary.displayExpirationDate,
      status: { text: "Expired", tone: "bg-red-100 text-red-700" },
    }
  }

  if (summary.expirationStatus === "near-expiry") {
    return {
      date: summary.displayExpirationDate,
      status: { text: "Near Expiry", tone: "bg-yellow-100 text-yellow-700" },
    }
  }

  return {
    date: summary.displayExpirationDate,
    status: getExpirationStatus(summary.displayExpirationDate),
  }
}

function getNextExpirationDate(ingredient: Ingredient) {
  return getIngredientExpirationSummary(ingredient).nextExpirationDate
}

function buildNextIngredientProductId(ingredients: Ingredient[]) {
  const highestId = ingredients.reduce((max, ingredient) => {
    const match = ingredient.productId.match(/ING-(\d+)/i)
    const numericId = match ? parseInt(match[1], 10) : ingredient.id
    return Math.max(max, numericId)
  }, 0)

  return `ING-${String(highestId + 1).padStart(3, "0")}`
}

function IngredientsPageContent() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [expirationLogs, setExpirationLogs] = useState<ExpirationLog[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [mode, setMode] = useState<FormMode>("list")
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const [ingredientToDelete, setIngredientToDelete] = useState<Ingredient | null>(null)
  const [assigningIngredient, setAssigningIngredient] = useState<Ingredient | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [formData, setFormData] = useState<IngredientFormState>({
    productId: "",
    name: "",
    unit: "",
    stock: "",
    expirationDate: "",
  })
  const [restockQuantity, setRestockQuantity] = useState("")
  const [restockExpirationDate, setRestockExpirationDate] = useState("")
  const [restockingIngredient, setRestockingIngredient] = useState<Ingredient | null>(null)
  const [draftBatchId, setDraftBatchId] = useState("")
  const [draftDateAdded, setDraftDateAdded] = useState("")

  useEffect(() => {
    const loadData = async () => {
      await initializeSupabaseStore()
      setIngredients(getIngredients())
      setExpirationLogs(getExpirationLogs())
      setProducts(getProducts())
    }

    void loadData()
  }, [])

  const resetForm = () => {
    setFormData({ productId: "", name: "", unit: "", stock: "", expirationDate: "" })
    setEditingIngredient(null)
    setSelectedProducts([])
    setAssigningIngredient(null)
    setRestockingIngredient(null)
    setRestockQuantity("")
    setRestockExpirationDate("")
    setDraftBatchId("")
    setDraftDateAdded("")
    setMode("list")
  }

  const handleAdd = () => {
    setMode("add")
    setFormData({ productId: buildNextIngredientProductId(getIngredients()), name: "", unit: "pcs", stock: "10", expirationDate: "" })
    setDraftBatchId(`BATCH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`)
    setDraftDateAdded(new Date().toISOString())
  }

  const handleEdit = (ingredient: Ingredient) => {
    const summary = getIngredientExpirationSummary(ingredient)
    setEditingIngredient(ingredient)
    setFormData({
      productId: ingredient.productId,
      name: ingredient.name,
      unit: ingredient.unit,
      stock: ingredient.stock.toString(),
      expirationDate: summary.displayExpirationDate || ingredient.expirationDate || "",
    })
    setMode("edit")
  }

  const handleAssign = (ingredient: Ingredient) => {
    setAssigningIngredient(ingredient)
    setSelectedProducts(ingredient.assignedProducts)
    setMode("assign")
  }

  const handleSaveAssignments = () => {
    if (assigningIngredient) {
      updateIngredient(assigningIngredient.id, { assignedProducts: selectedProducts })
      setIngredients(getIngredients())
      setExpirationLogs(getExpirationLogs())
      resetForm()
    }
  }

  const toggleProductSelection = (productId: number) => {
    setSelectedProducts((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]))
  }

  const handleRestock = (ingredient: Ingredient) => {
    setRestockingIngredient(ingredient)
    setRestockQuantity("")
    setRestockExpirationDate("")
    setMode("restock")
  }

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (restockingIngredient && restockQuantity) {
      addIngredientStock(restockingIngredient.id, parseFloat(restockQuantity) || 0, restockExpirationDate || null)
      setIngredients(getIngredients())
      setExpirationLogs(getExpirationLogs())
      resetForm()
    }
  }

  const handleDelete = (id: number) => {
    const ingredient = ingredients.find((entry) => entry.id === id)
    if (!ingredient) return

    const productsUsingIngredient = getProducts().filter((product) => product.ingredients.some((pi) => pi.ingredientId === id))

    if (productsUsingIngredient.length > 0) {
      alert(`Cannot delete. This ingredient is used in: ${productsUsingIngredient.map((p) => p.name).join(", ")}`)
      return
    }

    setIngredientToDelete(ingredient)
  }

  const confirmDelete = () => {
    if (!ingredientToDelete) return
    deleteIngredient(ingredientToDelete.id)
    setIngredients(getIngredients())
    setExpirationLogs(getExpirationLogs())
    setIngredientToDelete(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === "add") {
      const quantity = parseFloat(formData.stock) || 0
      addIngredient({
        productId: formData.productId.trim(),
        name: formData.name,
        unit: formData.unit,
        stock: quantity,
        assignedProducts: [],
        stockBatches:
          quantity > 0
            ? [
                {
                  id: draftBatchId || `BATCH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
                  quantity,
                  dateAdded: draftDateAdded || new Date().toISOString(),
                  expirationDate: formData.expirationDate,
                },
              ]
            : [],
      })
    } else if (mode === "edit" && editingIngredient) {
      const updatedExpirationDate = formData.expirationDate || null
      updateIngredient(editingIngredient.id, {
        productId: formData.productId.trim(),
        name: formData.name,
        unit: formData.unit,
        expirationDate: updatedExpirationDate,
        assignedProducts: editingIngredient.assignedProducts || [],
        stockBatches: (editingIngredient.stockBatches || []).map((batch) => ({
          ...batch,
          expirationDate: batch.expirationDate || updatedExpirationDate,
        })),
      })
    }

    setIngredients(getIngredients())
    setExpirationLogs(getExpirationLogs())
    resetForm()
  }

  const getStockStatus = (stock: number) => {
    if (stock <= 0) return { text: "Out of Stock", color: "bg-[#7f9882] text-[#f5f1ea]" }
    if (stock <= 10) return { text: "Low Stock", color: "bg-[#97ad97] text-[#f5f1ea]" }
    return { text: "In Stock", color: "bg-[#b7c8b5] text-[#4a342a]" }
  }

  const filteredIngredients = ingredients.filter((ingredient) => {
    const query = searchQuery.trim().toLowerCase()
    const nextExpiration = getNextExpirationDate(ingredient)
    if (!query) return true

    return (
      ingredient.name.toLowerCase().includes(query) ||
      ingredient.productId.toLowerCase().includes(query) ||
      ingredient.unit.toLowerCase().includes(query) ||
      getStockStatus(ingredient.stock).text.toLowerCase().includes(query) ||
      formatDate(nextExpiration).toLowerCase().includes(query)
    )
  })

  if (mode === "restock") {
    const nextExpiration = restockingIngredient ? getNextExpirationDate(restockingIngredient) : null
    const expirationStatus = getExpirationStatus(nextExpiration)
    const nextBatchId = restockingIngredient ? getIngredientExpirationSummary(restockingIngredient).nextBatchId : null

    return (
      <div className="flex min-h-screen bg-transparent">
        <Sidebar />
        <main className="relative flex-1 flex items-center justify-center overflow-hidden p-4 pt-20 lg:pt-6 lg:p-6">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-6 top-10 h-56 w-56 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
            <div className="absolute bottom-10 right-10 h-56 w-56 rounded-full bg-[#b2967d]/14 blur-3xl" />
          </div>
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[#f5f1ea]/55 bg-[rgba(245,241,234,0.76)] p-6 shadow-[0_24px_56px_rgba(74,52,42,0.08)] backdrop-blur-xl lg:p-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#4a342a] text-center mb-6 lg:mb-8">
              Restock {restockingIngredient?.name}
            </h1>

            <form onSubmit={handleRestockSubmit} className="space-y-6">
              <div className="rounded-xl bg-[#f5f1ea] p-4">
                <p className="text-sm text-muted-foreground">Product ID</p>
                <p className="font-semibold text-foreground">{restockingIngredient?.productId}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Next batch ID</p>
                    <p className="font-medium">{nextBatchId || "No active batch"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Next batch to use</p>
                    <p className="font-medium">{formatDate(nextExpiration)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${expirationStatus.tone}`}>
                    {expirationStatus.text}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Quantity to Add</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={restockQuantity}
                    onChange={(e) => setRestockQuantity(e.target.value)}
                    placeholder="0"
                    className="flex-1 px-4 py-3 rounded-lg bg-[#f5f1ea] border-0 focus:ring-2 focus:ring-[#4a342a] outline-none"
                    required
                  />
                  <span className="flex items-center px-4 py-3 bg-[#4a342a] text-[#f5f1ea] rounded-lg font-semibold">
                    {restockingIngredient?.unit}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Current stock: {restockingIngredient?.stock}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Expiration Date</label>
                <input
                  type="date"
                  value={restockExpirationDate}
                  onChange={(e) => setRestockExpirationDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border-0 focus:ring-2 focus:ring-[#4a342a] outline-none"
                  required
                />
                <p className="text-xs text-muted-foreground mt-2">Required for each batch. FIFO uses the oldest usable batch first.</p>
              </div>

              <button type="submit" className="w-full py-4 bg-[#7d5a44] hover:bg-[#4a342a] text-[#f5f1ea] font-semibold rounded-lg transition-colors">
                ADD STOCK (FIFO)
              </button>

              <button type="button" onClick={resetForm} className="w-full text-center text-muted-foreground hover:text-foreground transition-colors">
                Cancel and Go Back
              </button>
            </form>
          </div>
        </main>
      </div>
    )
  }

  if (mode === "assign") {
    return (
      <div className="flex min-h-screen bg-transparent">
        <Sidebar />
        <main className="relative flex-1 overflow-hidden p-4 pt-20 lg:pt-6 lg:p-6">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 top-10 h-64 w-64 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
            <div className="absolute right-10 top-28 h-52 w-52 rounded-full bg-[#7d5a44]/10 blur-3xl" />
          </div>
          <div className="max-w-2xl mx-auto lg:mx-0">
            <button onClick={resetForm} className="mb-4 lg:mb-6 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 text-sm lg:text-base">
              <X className="h-4 w-4" />
              Back to Ingredients
            </button>

            <div className="relative z-10 rounded-2xl border border-[#f5f1ea]/55 bg-[rgba(245,241,234,0.76)] p-8 shadow-[0_24px_56px_rgba(74,52,42,0.08)] backdrop-blur-xl">
              <h1 className="text-3xl font-bold text-[#4a342a] mb-2">Assign {assigningIngredient?.name}</h1>
              <p className="text-muted-foreground mb-6">Select which products use this ingredient</p>

              <div className="rounded-xl bg-[#f5f1ea] p-4 mb-6">
                <p className="text-sm text-muted-foreground">Product ID</p>
                <p className="font-semibold text-foreground">{assigningIngredient?.productId}</p>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto mb-6">
                {products.map((product) => (
                  <div key={product.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted transition-colors">
                    <input
                      type="checkbox"
                      id={`product-${product.id}`}
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => toggleProductSelection(product.id)}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                    <label htmlFor={`product-${product.id}`} className="flex-1 cursor-pointer">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground">{product.category}</div>
                    </label>
                    <span className="text-xs bg-[#4a342a] text-[#f5f1ea] px-2 py-1 rounded">P{product.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={handleSaveAssignments} className="flex-1 py-3 bg-[#4a342a] hover:bg-[#7d5a44] text-[#f5f1ea] font-semibold rounded-lg transition-colors">
                  <Check className="h-5 w-5 inline-block mr-2" />
                  Save Assignments
                </button>
                <button onClick={resetForm} className="flex-1 py-3 border border-border hover:bg-muted text-foreground font-semibold rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (mode !== "list") {
    return (
      <div className="flex min-h-screen bg-transparent">
        <Sidebar />
        <main className="relative flex-1 flex items-center justify-center overflow-hidden p-4 pt-20 lg:pt-6 lg:p-6">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-6 top-10 h-56 w-56 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
            <div className="absolute bottom-10 right-10 h-56 w-56 rounded-full bg-[#b2967d]/14 blur-3xl" />
          </div>
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[#f5f1ea]/55 bg-[rgba(245,241,234,0.76)] p-6 shadow-[0_24px_56px_rgba(74,52,42,0.08)] backdrop-blur-xl lg:p-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#4a342a] text-center mb-6 lg:mb-8">
              {mode === "add" ? "Add New Ingredient" : "Edit Ingredient"}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Product ID</label>
                <input
                  type="text"
                  value={formData.productId}
                  placeholder="e.g. ING-016"
                  className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border-0 focus:ring-2 focus:ring-[#4a342a] outline-none disabled:bg-muted disabled:text-muted-foreground"
                  required
                  readOnly
                />
                {mode === "add" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Auto-generated when creating a new ingredient.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Ingredient Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Rice"
                  className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border-0 focus:ring-2 focus:ring-[#4a342a] outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Unit of Measurement</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g. pcs, cups, ml, g"
                    className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border-0 focus:ring-2 focus:ring-[#4a342a] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {mode === "add" ? "Quantity" : "Current Usable Stock"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border-0 focus:ring-2 focus:ring-[#4a342a] outline-none"
                    required
                    disabled={mode === "edit"}
                  />
                </div>
              </div>

              {mode === "add" ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">Date Added</label>
                      <input
                        type="text"
                        value={draftDateAdded ? new Date(draftDateAdded).toLocaleDateString("en-US") : ""}
                        readOnly
                        className="w-full px-4 py-3 rounded-lg bg-muted border-0 outline-none text-muted-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">Batch ID</label>
                      <input
                        type="text"
                        value={draftBatchId}
                        readOnly
                        className="w-full px-4 py-3 rounded-lg bg-muted border-0 outline-none text-muted-foreground"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Expiration Date</label>
                    <input
                      type="date"
                      value={formData.expirationDate}
                      onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border-0 focus:ring-2 focus:ring-[#4a342a] outline-none"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Expiration Date</label>
                    <input
                      type="date"
                      value={formData.expirationDate}
                      onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border-0 focus:ring-2 focus:ring-[#4a342a] outline-none"
                    />
                  </div>

                  <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                    Editing this date updates the ingredient fallback expiry and fills missing batch expirations. Use Restock to add a new FIFO batch with its own expiration date.
                  </p>
                </>
              )}

              <button
                type="submit"
                className={`w-full py-4 font-semibold rounded-lg transition-colors ${mode === "add" ? "bg-[#4a342a] hover:bg-[#7d5a44] text-[#f5f1ea]" : "bg-[#7d5a44] hover:bg-[#4a342a] text-[#f5f1ea]"}`}
              >
                {mode === "add" ? "SAVE INGREDIENT" : "SAVE CHANGES"}
              </button>

              {mode === "edit" && editingIngredient ? (
                <button
                  type="button"
                  onClick={() => handleDelete(editingIngredient.id)}
                  className="w-full rounded-lg border border-red-200 bg-red-50 py-4 font-semibold text-red-700 transition-colors hover:bg-red-100"
                >
                  Delete Ingredient
                </button>
              ) : null}

              <button type="button" onClick={resetForm} className="w-full text-center text-muted-foreground hover:text-foreground transition-colors">
                Cancel and Go Back
              </button>
            </form>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-hidden p-4 pt-20 lg:pt-6 lg:p-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-10 h-64 w-64 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
          <div className="absolute right-8 top-24 h-52 w-52 rounded-full bg-[#7d5a44]/10 blur-3xl" />
        </div>
        <div className="relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4 lg:mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#4a342a]">Ingredients</h1>
            <p className="text-muted-foreground text-sm lg:text-base">Manage raw ingredients, product IDs, and FIFO stock batches.</p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-3 bg-[#4a342a] hover:bg-[#7d5a44] text-[#f5f1ea] font-semibold rounded-lg transition-colors text-sm lg:text-base w-full sm:w-auto justify-center"
          >
            <Plus className="h-5 w-5" />
            Add New Ingredient
          </button>
        </div>

        <div className="relative mb-4 lg:mb-6">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ingredient name, product ID, unit, or expiry"
            className="w-full rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 py-3 pl-12 pr-4 text-foreground outline-none shadow-[inset_0_1px_0_rgba(245,241,234,0.75)] backdrop-blur-sm transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
          />
        </div>

        <div className="lg:hidden space-y-3">
          {filteredIngredients.map((ingredient) => {
            const status = getStockStatus(ingredient.stock)
            const summary = getIngredientExpirationSummary(ingredient)
            const expiration = getExpirationPresentation(summary)

            return (
              <div key={ingredient.id} className="rounded-lg border border-border bg-[rgba(245,241,234,0.74)] p-4 backdrop-blur-md">
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-foreground">{ingredient.name}</h3>
                    <p className="text-xs text-muted-foreground">{ingredient.productId} • {ingredient.unit}</p>
                  </div>
                  <span className="inline-flex items-center justify-center min-w-[50px] px-2 py-1 bg-[#4a342a] text-[#f5f1ea] rounded-full font-medium text-sm">
                    {ingredient.stock}
                  </span>
                </div>

                <div className="mb-3 flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${status.color}`}>{status.text}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${expiration.status.tone}`}>
                    {expiration.date ? <AlertTriangle className="h-3 w-3" /> : null}
                    {expiration.status.text}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">Next batch: {summary.nextBatchId || "No active batch"}</p>
                <p className="text-xs text-muted-foreground">Date added: {summary.nextDateAdded ? formatDate(summary.nextDateAdded) : "No active batch"}</p>
                <p className="text-xs text-muted-foreground mb-3">Expiration: {formatDate(expiration.date)}</p>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{ingredient.stockBatches?.length || 0} batch(es)</span>
                  <div className="flex gap-1">
                    <button onClick={() => handleRestock(ingredient)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Add stock">
                      <Plus className="h-4 w-4 text-[#7d5a44]" />
                    </button>
                    <button onClick={() => handleAssign(ingredient)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Assign">
                      <Link className="h-4 w-4 text-[#4a342a]" />
                    </button>
                    <button onClick={() => handleEdit(ingredient)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(ingredient.id)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                      <Trash2 className="h-4 w-4 text-[#4a342a]" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="hidden lg:block overflow-x-auto rounded-lg border border-border bg-[rgba(245,241,234,0.74)] backdrop-blur-md">
          <table className="min-w-[980px] w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="w-[110px] text-left px-4 py-4 font-semibold text-foreground">Product ID</th>
                <th className="w-[170px] text-left px-4 py-4 font-semibold text-foreground">Ingredient Name</th>
                <th className="w-[90px] text-left px-4 py-4 font-semibold text-foreground">Unit</th>
                <th className="w-[100px] text-center px-4 py-4 font-semibold text-foreground">Stock</th>
                <th className="w-[170px] text-left px-4 py-4 font-semibold text-foreground">Next Batch</th>
                <th className="w-[210px] text-left px-4 py-4 font-semibold text-foreground">Next Expiration</th>
                <th className="w-[170px] text-center px-4 py-4 font-semibold text-foreground">Status</th>
                <th className="w-[84px] text-center px-3 py-4 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIngredients.map((ingredient) => {
                const status = getStockStatus(ingredient.stock)
                const summary = getIngredientExpirationSummary(ingredient)
                const expiration = getExpirationPresentation(summary)

                return (
                  <tr key={ingredient.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-4 font-medium text-[#7d5a44]">{ingredient.productId}</td>
                    <td className="px-4 py-4 font-medium">{ingredient.name}</td>
                    <td className="px-4 py-4 text-muted-foreground">{ingredient.unit}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[60px] px-3 py-1 bg-[#4a342a] text-[#f5f1ea] rounded-full font-medium">
                        {ingredient.stock}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="space-y-1">
                        <p className="break-all font-medium">{summary.nextBatchId || "No active batch"}</p>
                        <p className="text-muted-foreground">
                          {summary.nextDateAdded ? formatDate(summary.nextDateAdded) : "No active batch"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{formatDate(expiration.date)}</span>
                        <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${expiration.status.tone}`}>{expiration.status.text}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm whitespace-nowrap ${status.color}`}>{status.text}</span>
                        {(expiration.status.text === "Expired" || expiration.status.text === "Near Expiry") ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${expiration.status.tone}`}>
                            {expiration.status.text}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <div className="flex items-center justify-center">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="relative z-10 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-[#7d5a44] transition-colors hover:bg-[#d7c9b8]/45 hover:text-[#4a342a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a342a]/20"
                              aria-label={`Open actions for ${ingredient.name}`}
                              title="Ingredient actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            side="left"
                            align="start"
                            sideOffset={8}
                            className="w-40 rounded-xl border-[#d7c9b8] bg-[#f5f1ea]/98 p-1.5 shadow-[0_18px_36px_rgba(74,52,42,0.12)] backdrop-blur-xl"
                          >
                            <DropdownMenuItem
                              onClick={() => handleEdit(ingredient)}
                              className="rounded-lg text-[#7d5a44] transition-colors focus:bg-[#d7c9b8]/45 focus:text-[#4a342a]"
                            >
                              <Pencil className="h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleRestock(ingredient)}
                              className="rounded-lg text-[#4f8a63] transition-colors focus:bg-[#dcefdc] focus:text-[#2f7d32]"
                            >
                              <Plus className="h-4 w-4" />
                              <span>Add Stock</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(ingredient.id)}
                              variant="destructive"
                              className="rounded-lg transition-colors focus:bg-red-50 focus:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-2xl border border-[#f5f1ea]/55 bg-[rgba(245,241,234,0.76)] p-4 shadow-[0_18px_40px_rgba(74,52,42,0.08)] backdrop-blur-xl lg:mt-8 lg:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-[#4a342a]">Expiration Logs</h2>
              <p className="text-sm text-muted-foreground">Expired ingredient batches recorded by the system.</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-[#4a342a] px-3 py-1 text-xs font-semibold text-[#f5f1ea]">
              {expirationLogs.length} log{expirationLogs.length === 1 ? "" : "s"}
            </span>
          </div>

          {expirationLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-8 text-center text-sm text-muted-foreground">
              No expired batches logged yet.
            </div>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {expirationLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-[#d7c9b8]/70 bg-[#f5f1ea]/78 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{log.ingredientName}</p>
                        <p className="text-xs text-muted-foreground">{log.batchId}</p>
                      </div>
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">Expired</span>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      <p>Quantity: <span className="font-medium text-foreground">{log.quantity}</span></p>
                      <p>Expired on: <span className="font-medium text-foreground">{formatDate(log.expirationDate)}</span></p>
                      <p>Logged at: <span className="font-medium text-foreground">{formatDateTime(log.loggedAt)}</span></p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-xl border border-border bg-[rgba(245,241,234,0.72)] lg:block">
                <table className="min-w-[720px] w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Ingredient</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Batch ID</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Quantity</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Expired On</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Logged At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expirationLogs.map((log) => (
                      <tr key={log.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium text-foreground">{log.ingredientName}</td>
                        <td className="px-4 py-3 text-sm text-[#7d5a44]">{log.batchId}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{log.quantity}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                            {formatDate(log.expirationDate)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatDateTime(log.loggedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        </div>
        <AlertDialog open={Boolean(ingredientToDelete)} onOpenChange={(open) => !open && setIngredientToDelete(null)}>
          <AlertDialogContent className="border-[#f5f1ea]/60 bg-[rgba(245,241,234,0.96)] shadow-[0_24px_56px_rgba(74,52,42,0.16)] backdrop-blur-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[#4a342a]">Delete Ingredient</AlertDialogTitle>
              <AlertDialogDescription className="text-[#7d5a44]">
                {ingredientToDelete
                  ? `Remove ${ingredientToDelete.name}? This action cannot be undone.`
                  : "Remove this ingredient? This action cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-[#d7c9b8] bg-[#f5f1ea] text-[#4a342a] hover:bg-[#ede3d8]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-[#7d5a44] text-[#f5f1ea] hover:bg-[#4a342a]">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}

export default function IngredientsPage() {
  return <IngredientsPageContent />
}


