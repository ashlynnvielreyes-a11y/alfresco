"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Plus, Pencil, Trash2, Link, X, Check } from "lucide-react"
import { getIngredients, addIngredient, updateIngredient, deleteIngredient, getProducts, updateProduct, addIngredientStock } from "@/lib/store"
import type { Ingredient, Product, ProductIngredient } from "@/lib/types"

type FormMode = "list" | "add" | "edit" | "assign" | "restock"

function IngredientsPageContent() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [mode, setMode] = useState<FormMode>("list")
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const [assigningIngredient, setAssigningIngredient] = useState<Ingredient | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [formData, setFormData] = useState({
    name: "",
    unit: "",
    stock: "",
  })
  const [restockQuantity, setRestockQuantity] = useState("")
  const [restockingIngredient, setRestockingIngredient] = useState<Ingredient | null>(null)

  useEffect(() => {
    setIngredients(getIngredients())
    setProducts(getProducts())
  }, [])

  const resetForm = () => {
    setFormData({ name: "", unit: "", stock: "" })
    setEditingIngredient(null)
    setSelectedProducts([])
    setAssigningIngredient(null)
    setRestockingIngredient(null)
    setRestockQuantity("")
    setMode("list")
  }

  const handleAdd = () => {
    setMode("add")
    setFormData({ name: "", unit: "pcs", stock: "10" })
  }

  const handleEdit = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient)
    setFormData({
      name: ingredient.name,
      unit: ingredient.unit,
      stock: ingredient.stock.toString(),
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
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    )
  }

  const handleRestock = (ingredient: Ingredient) => {
    setRestockingIngredient(ingredient)
    setRestockQuantity("")
    setMode("restock")
  }

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (restockingIngredient && restockQuantity) {
      addIngredientStock(restockingIngredient.id, parseFloat(restockQuantity) || 0)
      setIngredients(getIngredients())
      resetForm()
    }
  }

  const handleDelete = (id: number) => {
    // Check if ingredient is used in any product
    const products = getProducts()
    const usedInProducts = products.filter(p => 
      p.ingredients.some(pi => pi.ingredientId === id)
    )
    
    if (usedInProducts.length > 0) {
      alert(`Cannot delete. This ingredient is used in: ${usedInProducts.map(p => p.name).join(", ")}`)
      return
    }
    
    if (confirm("Are you sure you want to delete this ingredient?")) {
      deleteIngredient(id)
      setIngredients(getIngredients())
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const ingredientData = {
      name: formData.name,
      unit: formData.unit,
      stock: parseFloat(formData.stock) || 0,
    }

    if (mode === "add") {
      addIngredient(ingredientData)
    } else if (mode === "edit" && editingIngredient) {
      updateIngredient(editingIngredient.id, ingredientData)
    }

    setIngredients(getIngredients())
    resetForm()
  }

  const getStockStatus = (stock: number) => {
    if (stock <= 0) return { text: "Out of Stock", color: "bg-red-500" }
    if (stock <= 10) return { text: "Low Stock", color: "bg-yellow-500" }
    return { text: "In Stock", color: "bg-green-500" }
  }

  if (mode === "restock") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-4 pt-20 lg:pt-6 lg:p-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 lg:p-8 w-full max-w-lg">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#bb3e00] text-center mb-6 lg:mb-8">
              Restock {restockingIngredient?.name}
            </h1>

            <form onSubmit={handleRestockSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Quantity to Add
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={restockQuantity}
                    onChange={(e) => setRestockQuantity(e.target.value)}
                    placeholder="0"
                    className="flex-1 px-4 py-3 rounded-lg bg-[#fff1d7] border-0 focus:ring-2 focus:ring-[#bb3e00] outline-none"
                    required
                  />
                  <span className="flex items-center px-4 py-3 bg-[#bb3e00] text-white rounded-lg font-semibold">
                    {restockingIngredient?.unit}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Current stock: {restockingIngredient?.stock}
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-[#8f2f00] hover:bg-[#6a6315] text-white font-semibold rounded-lg transition-colors"
              >
                ADD STOCK (FIFO)
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="w-full text-center text-muted-foreground hover:text-foreground transition-colors"
              >
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
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-4 pt-20 lg:pt-6 lg:p-6">
          <div className="max-w-2xl mx-auto lg:mx-0">
            <button
              onClick={resetForm}
              className="mb-4 lg:mb-6 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 text-sm lg:text-base"
            >
              <X className="h-4 w-4" />
              Back to Ingredients
            </button>
            
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h1 className="text-3xl font-bold text-[#bb3e00] mb-2">
                Assign {assigningIngredient?.name}
              </h1>
              <p className="text-muted-foreground mb-6">
                Select which products use this ingredient
              </p>

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
                    <span className="text-xs bg-[#1a1a2e] text-white px-2 py-1 rounded">
                      P{product.price.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveAssignments}
                  className="flex-1 py-3 bg-[#1a1a2e] hover:bg-[#2a2a3e] text-white font-semibold rounded-lg transition-colors"
                >
                  <Check className="h-5 w-5 inline-block mr-2" />
                  Save Assignments
                </button>
                <button
                  onClick={resetForm}
                  className="flex-1 py-3 border border-border hover:bg-muted text-foreground font-semibold rounded-lg transition-colors"
                >
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
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-4 pt-20 lg:pt-6 lg:p-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 lg:p-8 w-full max-w-lg">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#bb3e00] text-center mb-6 lg:mb-8">
              {mode === "add" ? "Add New Ingredient" : "Edit Ingredient"}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Ingredient Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Rice"
                  className="w-full px-4 py-3 rounded-lg bg-[#fff1d7] border-0 focus:ring-2 focus:ring-[#bb3e00] outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Unit of Measurement
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g. pcs, cups, ml, g"
                    className="w-full px-4 py-3 rounded-lg bg-[#fff1d7] border-0 focus:ring-2 focus:ring-[#bb3e00] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-lg bg-[#fff1d7] border-0 focus:ring-2 focus:ring-[#bb3e00] outline-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className={`w-full py-4 font-semibold rounded-lg transition-colors ${
                  mode === "add"
                ? "bg-[#bb3e00] hover:bg-[#8f2f00] text-white"
                : "bg-[#8f2f00] hover:bg-[#6a6315] text-white"
                }`}
              >
                {mode === "add" ? "SAVE INGREDIENT" : "SAVE CHANGES"}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="w-full text-center text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel and Go Back
              </button>
            </form>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 p-4 pt-20 lg:pt-6 lg:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4 lg:mb-6">
          <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#bb3e00]">
            Ingredients
          </h1>
            <p className="text-muted-foreground text-sm lg:text-base">
              Manage your raw ingredients and stock levels
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-3 bg-[#bb3e00] hover:bg-[#8f2f00] text-white font-semibold rounded-lg transition-colors text-sm lg:text-base w-full sm:w-auto justify-center"
          >
            <Plus className="h-5 w-5" />
            Add New Ingredient
          </button>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
          {ingredients.map((ingredient) => {
            const status = getStockStatus(ingredient.stock)
            return (
              <div key={ingredient.id} className="bg-white rounded-lg border border-border p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-foreground">{ingredient.name}</h3>
                    <p className="text-xs text-muted-foreground">{ingredient.unit}</p>
                  </div>
                  <span className="inline-flex items-center justify-center min-w-[50px] px-2 py-1 bg-[#bb3e00] text-white rounded-full font-medium text-sm">
                    {ingredient.stock}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs ${status.color}`}>
                    {status.text}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => handleRestock(ingredient)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Add stock">
                      <Plus className="h-4 w-4 text-[#8f2f00]" />
                    </button>
                    <button onClick={() => handleAssign(ingredient)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Assign">
                      <Link className="h-4 w-4 text-[#bb3e00]" />
                    </button>
                    <button onClick={() => handleEdit(ingredient)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(ingredient.id)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                      <Trash2 className="h-4 w-4 text-[#bb3e00]" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block bg-white rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-4 font-semibold text-foreground">
                  Ingredient Name
                </th>
                <th className="text-left px-6 py-4 font-semibold text-foreground">
                  Unit
                </th>
                <th className="text-center px-6 py-4 font-semibold text-foreground">
                  Stock
                </th>
                <th className="text-center px-6 py-4 font-semibold text-foreground">
                  Status
                </th>
                <th className="text-center px-6 py-4 font-semibold text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ingredient) => {
                const status = getStockStatus(ingredient.stock)
                return (
                  <tr key={ingredient.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 font-medium">{ingredient.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{ingredient.unit}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[60px] px-3 py-1 bg-[#bb3e00] text-white rounded-full font-medium">
                        {ingredient.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-white text-sm ${status.color}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleRestock(ingredient)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title="Add stock (FIFO)"
                        >
                          <Plus className="h-5 w-5 text-[#8f2f00]" />
                        </button>
                        <button
                          onClick={() => handleAssign(ingredient)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title="Assign to products"
                        >
                          <Link className="h-5 w-5 text-[#bb3e00]" />
                        </button>
                        <button
                          onClick={() => handleEdit(ingredient)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                          <Pencil className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(ingredient.id)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                          <Trash2 className="h-5 w-5 text-[#bb3e00]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

export default function IngredientsPage() {
  return <IngredientsPageContent />
}

