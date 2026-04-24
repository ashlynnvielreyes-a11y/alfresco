"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Plus, Pencil, Trash2, X } from "lucide-react"
import { getComboMeals, addComboMeal, updateComboMeal, deleteComboMeal, getProducts } from "@/lib/store"
import type { ComboMeal, Product } from "@/lib/types"

type FormMode = "list" | "add" | "edit"

function ComboMealsPageContent() {
  const [combos, setCombos] = useState<ComboMeal[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [mode, setMode] = useState<FormMode>("list")
  const [editingCombo, setEditingCombo] = useState<ComboMeal | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
  })
  const [selectedItems, setSelectedItems] = useState<{ productId: number; quantity: number }[]>([])

  useEffect(() => {
    setCombos(getComboMeals())
    setProducts(getProducts())
  }, [])

  const resetForm = () => {
    setFormData({ name: "", description: "", price: "" })
    setSelectedItems([])
    setEditingCombo(null)
    setMode("list")
  }

  const handleAdd = () => {
    setMode("add")
    setFormData({ name: "", description: "", price: "" })
    setSelectedItems([])
  }

  const handleEdit = (combo: ComboMeal) => {
    setEditingCombo(combo)
    setFormData({
      name: combo.name,
      description: combo.description,
      price: combo.price.toString(),
    })
    setSelectedItems(combo.items)
    setMode("edit")
  }

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this combo meal?")) {
      deleteComboMeal(id)
      setCombos(getComboMeals())
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const price = parseFloat(formData.price) || 0

    if (mode === "add") {
      addComboMeal({
        name: formData.name,
        description: formData.description,
        price,
        items: selectedItems,
      })
    } else if (editingCombo) {
      updateComboMeal(editingCombo.id, {
        name: formData.name,
        description: formData.description,
        price,
        items: selectedItems,
      })
    }

    setCombos(getComboMeals())
    resetForm()
  }

  const addProductToCombo = () => {
    if (products.length > 0) {
      setSelectedItems([...selectedItems, { productId: products[0].id, quantity: 1 }])
    }
  }

  const updateProductSelection = (index: number, productId: number) => {
    const updated = [...selectedItems]
    updated[index].productId = productId
    setSelectedItems(updated)
  }

  const updateProductQuantity = (index: number, quantity: number) => {
    const updated = [...selectedItems]
    updated[index].quantity = Math.max(1, quantity)
    setSelectedItems(updated)
  }

  const removeProductFromCombo = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index))
  }

  const getProductName = (productId: number) => {
    return products.find(p => p.id === productId)?.name || "Unknown"
  }

  if (mode === "add" || mode === "edit") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-4 pt-20 lg:pt-6 lg:p-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 lg:p-8 w-full max-w-2xl">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#bb3e00] text-center mb-6 lg:mb-8">
              {mode === "add" ? "Create Combo Meal" : "Edit Combo Meal"}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-[#8f2f00] mb-2">
                  Combo Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Coffee & Pastry Bundle"
                  className="w-full px-4 py-3 rounded-lg bg-[#fff1d7] border border-[#f7a645]/50 focus:ring-2 focus:ring-[#bb3e00] focus:border-[#bb3e00] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#8f2f00] mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Spanish Latte with Croissant"
                  className="w-full px-4 py-3 rounded-lg bg-[#fff1d7] border border-[#f7a645]/50 focus:ring-2 focus:ring-[#bb3e00] focus:border-[#bb3e00] outline-none resize-none h-24"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#8f2f00] mb-2">
                  Combo Price (P)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-lg bg-[#fff1d7] border border-[#f7a645]/50 focus:ring-2 focus:ring-[#bb3e00] focus:border-[#bb3e00] outline-none"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-semibold text-[#8f2f00]">
                    Items in Combo
                  </label>
                  <button
                    type="button"
                    onClick={addProductToCombo}
                    className="flex items-center gap-1 text-sm text-[#bb3e00] hover:text-[#8f2f00] font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </button>
                </div>

                {selectedItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No items selected yet</p>
                ) : (
                  <div className="space-y-3">
                    {selectedItems.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center bg-[#fff1d7] p-3 rounded-lg border border-[#f7a645]/30">
                        <select
                          value={item.productId}
                          onChange={(e) => updateProductSelection(index, parseInt(e.target.value))}
                          className="flex-1 px-3 py-2 rounded-lg border border-[#f7a645]/50 focus:ring-2 focus:ring-[#bb3e00] focus:border-[#bb3e00] outline-none bg-white"
                        >
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} (₱{product.price})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateProductQuantity(index, parseInt(e.target.value))}
                          className="w-20 px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-[#bb3e00] outline-none text-center"
                        />
                        <span className="text-sm font-medium text-foreground min-w-fit">qty</span>
                        <button
                          type="button"
                          onClick={() => removeProductFromCombo(index)}
                          className="p-1 hover:bg-white rounded transition-colors"
                        >
                          <X className="h-4 w-4 text-[#bb3e00]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={selectedItems.length === 0}
                className={`w-full py-4 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  mode === "add"
                    ? "bg-[#bb3e00] hover:bg-[#8f2f00] text-white"
                    : "bg-[#8f2f00] hover:bg-[#6a6315] text-white"
                }`}
              >
                {mode === "add" ? "CREATE COMBO MEAL" : "SAVE CHANGES"}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="w-full text-center text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
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
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 lg:mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#bb3e00]">
              Combo Meals
            </h1>
            <p className="text-muted-foreground mt-1 lg:mt-2 text-sm lg:text-base">Manage your combo meal offerings</p>
          </div>

          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-3 bg-[#bb3e00] hover:bg-[#8f2f00] text-white font-semibold rounded-lg transition-colors text-sm lg:text-base w-full sm:w-auto justify-center"
          >
            <Plus className="h-5 w-5" />
            Create Combo Meal
          </button>
        </div>

        {combos.length === 0 ? (
          <div className="text-center py-8 lg:py-12">
            <p className="text-muted-foreground mb-4 text-sm lg:text-base">No combo meals created yet</p>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-3 bg-[#bb3e00] hover:bg-[#8f2f00] text-white font-semibold rounded-lg transition-colors text-sm lg:text-base"
            >
              <Plus className="h-5 w-5" />
              Create Your First Combo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
            {combos.map((combo) => (
              <div key={combo.id} className="bg-white rounded-lg border border-border p-4 lg:p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-2 lg:mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base lg:text-lg font-bold text-[#bb3e00] truncate">{combo.name}</h3>
                    <p className="text-xs lg:text-sm text-muted-foreground mt-1 line-clamp-2">{combo.description}</p>
                  </div>
                </div>

                <div className="mb-3 lg:mb-4 pb-3 lg:pb-4 border-b border-border">
                  <p className="text-[10px] lg:text-xs font-semibold text-muted-foreground mb-2">ITEMS:</p>
                  <ul className="text-xs lg:text-sm space-y-1">
                    {combo.items.map((item, idx) => (
                      <li key={idx} className="text-foreground truncate">
                        {getProductName(item.productId)} x{item.quantity}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xl lg:text-2xl font-bold text-[#bb3e00]">P{combo.price.toFixed(2)}</span>
                  <div className="flex gap-1 lg:gap-2">
                    <button
                      onClick={() => handleEdit(combo)}
                      className="p-1.5 lg:p-2 hover:bg-[#fff1d7] rounded-lg transition-colors"
                    >
                      <Pencil className="h-4 w-4 lg:h-5 lg:w-5 text-[#8f2f00]" />
                    </button>
                    <button
                      onClick={() => handleDelete(combo.id)}
                      className="p-1.5 lg:p-2 hover:bg-[#fff1d7] rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4 lg:h-5 lg:w-5 text-[#bb3e00]" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default function ComboMealsPage() {
  return <ComboMealsPageContent />
}

