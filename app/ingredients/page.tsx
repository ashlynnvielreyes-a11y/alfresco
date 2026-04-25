"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Plus, Pencil, Trash2, Link, X, Check, Search, AlertTriangle } from "lucide-react"
import { getIngredients, addIngredient, updateIngredient, deleteIngredient, getProducts, addIngredientStock, getIngredientExpirationSummary } from "@/lib/store"
import type { Ingredient, Product } from "@/lib/types"

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
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function getExpirationStatus(date?: string | null) {
  if (!date) return { text: "No expiry", tone: "bg-[#d7c9b8] text-[#4a342a]" }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiration = new Date(date)
  expiration.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((expiration.getTime() - today.getTime()) / 86400000)

  if (diffDays < 0) return { text: "Expired", tone: "bg-red-100 text-red-700" }
  if (diffDays <= 3) return { text: "Near expiry", tone: "bg-yellow-100 text-yellow-700" }
  return { text: "Safe", tone: "bg-green-100 text-green-700" }
}

function getNextExpirationDate(ingredient: Ingredient) {
  return getIngredientExpirationSummary(ingredient).nextExpirationDate
}

function IngredientsPageContent() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [mode, setMode] = useState<FormMode>("list")
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
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
    setIngredients(getIngredients())
    setProducts(getProducts())
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
    setFormData({ productId: "", name: "", unit: "pcs", stock: "10", expirationDate: "" })
    setDraftBatchId(`BATCH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`)
    setDraftDateAdded(new Date().toISOString())
  }

  const handleEdit = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient)
    setFormData({
      productId: ingredient.productId,
      name: ingredient.name,
      unit: ingredient.unit,
      stock: ingredient.stock.toString(),
      expirationDate: "",
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
      resetForm()
    }
  }

  const handleDelete = (id: number) => {
    const productsUsingIngredient = getProducts().filter((product) => product.ingredients.some((pi) => pi.ingredientId === id))

    if (productsUsingIngredient.length > 0) {
      alert(`Cannot delete. This ingredient is used in: ${productsUsingIngredient.map((p) => p.name).join(", ")}`)
      return
    }

    if (confirm("Are you sure you want to delete this ingredient?")) {
      deleteIngredient(id)
      setIngredients(getIngredients())
    }
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
      updateIngredient(editingIngredient.id, {
        productId: formData.productId.trim(),
        name: formData.name,
        unit: formData.unit,
        assignedProducts: editingIngredient.assignedProducts || [],
      })
    }

    setIngredients(getIngredients())
    resetForm()
  }

  const getStockStatus = (stock: number) => {
    if (stock <= 0) return { text: "Out of Stock", color: "bg-red-500" }
    if (stock <= 10) return { text: "Low Stock", color: "bg-yellow-500" }
    return { text: "In Stock", color: "bg-green-500" }
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
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  placeholder="e.g. ING-016"
                  className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border-0 focus:ring-2 focus:ring-[#4a342a] outline-none"
                  required
                />
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
                <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                  Use Restock to add a new FIFO batch with its own expiration date.
                </p>
              )}

              <button
                type="submit"
                className={`w-full py-4 font-semibold rounded-lg transition-colors ${mode === "add" ? "bg-[#4a342a] hover:bg-[#7d5a44] text-[#f5f1ea]" : "bg-[#7d5a44] hover:bg-[#4a342a] text-[#f5f1ea]"}`}
              >
                {mode === "add" ? "SAVE INGREDIENT" : "SAVE CHANGES"}
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
            const nextExpiration = summary.nextExpirationDate
            const expirationStatus = getExpirationStatus(nextExpiration)

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
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[#f5f1ea] text-xs ${status.color}`}>{status.text}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${expirationStatus.tone}`}>
                    {nextExpiration ? <AlertTriangle className="h-3 w-3" /> : null}
                    {expirationStatus.text}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">Next batch: {summary.nextBatchId || "No active batch"}</p>
                <p className="text-xs text-muted-foreground">Date added: {summary.nextDateAdded ? formatDate(summary.nextDateAdded) : "No active batch"}</p>
                <p className="text-xs text-muted-foreground mb-3">Next expiration: {formatDate(nextExpiration)}</p>

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

        <div className="hidden lg:block rounded-lg border border-border bg-[rgba(245,241,234,0.74)] overflow-hidden backdrop-blur-md">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-4 font-semibold text-foreground">Product ID</th>
                <th className="text-left px-6 py-4 font-semibold text-foreground">Ingredient Name</th>
                <th className="text-left px-6 py-4 font-semibold text-foreground">Unit</th>
                <th className="text-center px-6 py-4 font-semibold text-foreground">Stock</th>
                <th className="text-left px-6 py-4 font-semibold text-foreground">Next Batch</th>
                <th className="text-left px-6 py-4 font-semibold text-foreground">Next Expiration</th>
                <th className="text-center px-6 py-4 font-semibold text-foreground">Status</th>
                <th className="text-center px-6 py-4 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIngredients.map((ingredient) => {
                const status = getStockStatus(ingredient.stock)
                const summary = getIngredientExpirationSummary(ingredient)
                const nextExpiration = summary.nextExpirationDate
                const expirationStatus = getExpirationStatus(nextExpiration)

                return (
                  <tr key={ingredient.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 font-medium text-[#7d5a44]">{ingredient.productId}</td>
                    <td className="px-6 py-4 font-medium">{ingredient.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{ingredient.unit}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[60px] px-3 py-1 bg-[#4a342a] text-[#f5f1ea] rounded-full font-medium">
                        {ingredient.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="space-y-1">
                        <p className="font-medium">{summary.nextBatchId || "No active batch"}</p>
                        <p className="text-muted-foreground">
                          {summary.nextDateAdded ? formatDate(summary.nextDateAdded) : "No active batch"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span>{formatDate(nextExpiration)}</span>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${expirationStatus.tone}`}>{expirationStatus.text}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[#f5f1ea] text-sm ${status.color}`}>{status.text}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleRestock(ingredient)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Add stock (FIFO)">
                          <Plus className="h-5 w-5 text-[#7d5a44]" />
                        </button>
                        <button onClick={() => handleAssign(ingredient)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Assign to products">
                          <Link className="h-5 w-5 text-[#4a342a]" />
                        </button>
                        <button onClick={() => handleEdit(ingredient)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                          <Pencil className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(ingredient.id)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                          <Trash2 className="h-5 w-5 text-[#4a342a]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </div>
      </main>
    </div>
  )
}

export default function IngredientsPage() {
  return <IngredientsPageContent />
}


