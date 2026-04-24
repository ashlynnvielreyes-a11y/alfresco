"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Plus, Pencil, Trash2, X } from "lucide-react"
import { getProducts, addProduct, updateProduct, deleteProduct, getIngredients, getProductAvailableStock } from "@/lib/store"
import type { Product, Ingredient, ProductIngredient } from "@/lib/types"

type FormMode = "list" | "add" | "edit"

function InventoryPageContent() {
  const [products, setProducts] = useState<Product[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [mode, setMode] = useState<FormMode>("list")
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    category: "Coffee" as Product["category"],
    price: "",
  })
  const [productIngredients, setProductIngredients] = useState<ProductIngredient[]>([])

  useEffect(() => {
    setProducts(getProducts())
    setIngredients(getIngredients())
  }, [])

  const resetForm = () => {
    setFormData({ name: "", category: "Coffee", price: "" })
    setProductIngredients([])
    setEditingProduct(null)
    setMode("list")
  }

  const handleAdd = () => {
    setMode("add")
    setFormData({ name: "", category: "Coffee", price: "" })
    setProductIngredients([])
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
    })
    setProductIngredients(product.ingredients || [])
    setMode("edit")
  }

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProduct(id)
      setProducts(getProducts())
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const productData = {
      name: formData.name,
      category: formData.category,
      price: parseFloat(formData.price) || 0,
      ingredients: productIngredients,
    }

    if (mode === "add") {
      addProduct(productData)
    } else if (mode === "edit" && editingProduct) {
      updateProduct(editingProduct.id, productData)
    }

    setProducts(getProducts())
    resetForm()
  }

  const addIngredientToProduct = () => {
    const availableIngredients = ingredients.filter(
      (ing) => !productIngredients.some((pi) => pi.ingredientId === ing.id)
    )
    if (availableIngredients.length > 0) {
      setProductIngredients([
        ...productIngredients,
        { ingredientId: availableIngredients[0].id, quantity: 1 },
      ])
    }
  }

  const removeIngredientFromProduct = (ingredientId: number) => {
    setProductIngredients(productIngredients.filter((pi) => pi.ingredientId !== ingredientId))
  }

  const updateIngredientQuantity = (ingredientId: number, quantity: number) => {
    setProductIngredients(
      productIngredients.map((pi) =>
        pi.ingredientId === ingredientId ? { ...pi, quantity: Math.max(0.1, quantity) } : pi
      )
    )
  }

  const updateIngredientSelection = (oldIngredientId: number, newIngredientId: number) => {
    setProductIngredients(
      productIngredients.map((pi) =>
        pi.ingredientId === oldIngredientId ? { ...pi, ingredientId: newIngredientId } : pi
      )
    )
  }

  const getIngredientName = (id: number) => {
    const ingredient = ingredients.find((i) => i.id === id)
    return ingredient ? `${ingredient.name} (${ingredient.unit})` : "Unknown"
  }

  if (mode !== "list") {
    const availableIngredientsForAdd = ingredients.filter(
      (ing) => !productIngredients.some((pi) => pi.ingredientId === ing.id)
    )

    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-4 pt-20 lg:pt-6 lg:p-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 lg:p-8 w-full max-w-2xl">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#A61F30] text-center mb-6 lg:mb-8">
              {mode === "add" ? "Add New Product" : "Edit Product"}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Product Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Spanish Latte"
                  className="w-full px-4 py-3 rounded-lg bg-#F5E6E8 border-0 focus:ring-2 focus:ring-[#A61F30] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as Product["category"] })}
                  className="w-full px-4 py-3 rounded-lg bg-white border border-border focus:ring-2 focus:ring-[#A61F30] outline-none"
                >
                  <option value="Coffee">Coffee</option>
                  <option value="Milk Tea">Milk Tea</option>
                  <option value="Silog">Silog</option>
                  <option value="Pastry">Pastry</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Price (P)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-lg bg-#F5E6E8 border-0 focus:ring-2 focus:ring-[#A61F30] outline-none"
                  required
                />
              </div>

              {/* Ingredients Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-semibold text-foreground">
                    Required Ingredients
                  </label>
                  {availableIngredientsForAdd.length > 0 && (
                    <button
                      type="button"
                      onClick={addIngredientToProduct}
                      className="flex items-center gap-1 text-sm text-[#A61F30] hover:text-[#a03200] font-medium"
                    >
                      <Plus className="h-4 w-4" />
                      Add Ingredient
                    </button>
                  )}
                </div>

                {productIngredients.length === 0 ? (
                  <p className="text-sm text-muted-foreground bg-muted px-4 py-3 rounded-lg">
                    No ingredients assigned. Click &quot;Add Ingredient&quot; to assign ingredients to this product.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {productIngredients.map((pi) => {
                      const ingredient = ingredients.find((i) => i.id === pi.ingredientId)
                      const availableForSelect = ingredients.filter(
                        (ing) =>
                          ing.id === pi.ingredientId ||
                          !productIngredients.some((p) => p.ingredientId === ing.id)
                      )
                      return (
                        <div
                          key={pi.ingredientId}
                          className="flex items-center gap-3 bg-muted px-4 py-3 rounded-lg"
                        >
                          <select
                            value={pi.ingredientId}
                            onChange={(e) =>
                              updateIngredientSelection(pi.ingredientId, parseInt(e.target.value))
                            }
                            className="flex-1 px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-[#A61F30] outline-none bg-white"
                          >
                            {availableForSelect.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} ({ing.unit})
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={pi.quantity}
                            onChange={(e) =>
                              updateIngredientQuantity(pi.ingredientId, parseFloat(e.target.value) || 0.1)
                            }
                            className="w-24 px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-[#A61F30] outline-none text-center"
                          />
                          <span className="text-sm text-muted-foreground w-12">
                            {ingredient?.unit || ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeIngredientFromProduct(pi.ingredientId)}
                            className="p-1 hover:bg-white rounded transition-colors"
                          >
                            <X className="h-4 w-4 text-[#A61F30]" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className={`w-full py-4 font-semibold rounded-lg transition-colors ${
                  mode === "add"
                    ? "bg-[#A61F30] hover:bg-[#a03200] text-white"
                    : "bg-[#8B1826] hover:bg-[#6a6315] text-white"
                }`}
              >
                {mode === "add" ? "SAVE PRODUCT" : "SAVE CHANGES"}
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
            <h1 className="text-2xl lg:text-3xl font-bold text-[#A61F30]">
              Inventory Management
            </h1>
            <p className="text-muted-foreground text-sm lg:text-base">
              Manage your coffee, meals, and stock levels
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-3 bg-[#A61F30] hover:bg-[#a03200] text-white font-semibold rounded-lg transition-colors text-sm lg:text-base w-full sm:w-auto justify-center"
          >
            <Plus className="h-5 w-5" />
            Add New Product
          </button>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-lg border border-border p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">{product.name}</h3>
                  <span className="inline-block px-2 py-0.5 border border-border rounded-full text-xs mt-1">
                    {product.category}
                  </span>
                </div>
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#A61F30] text-white rounded-full font-medium text-sm flex-shrink-0">
                  {getProductAvailableStock(product, ingredients)}
                </span>
              </div>
              {product.ingredients && product.ingredients.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {product.ingredients.slice(0, 2).map((pi) => (
                    <span key={pi.ingredientId} className="px-2 py-0.5 bg-muted text-xs rounded">
                      {getIngredientName(pi.ingredientId).split(" (")[0]}
                    </span>
                  ))}
                  {product.ingredients.length > 2 && (
                    <span className="px-2 py-0.5 bg-muted text-xs rounded">
                      +{product.ingredients.length - 2}
                    </span>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center">
                <p className="text-[#A61F30] font-bold">P{product.price.toFixed(2)}</p>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(product)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => handleDelete(product.id)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <Trash2 className="h-4 w-4 text-[#A61F30]" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block bg-white rounded-lg border border-border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-4 font-semibold text-foreground">
                  Product Name
                </th>
                <th className="text-left px-6 py-4 font-semibold text-foreground">
                  Category
                </th>
                <th className="text-left px-6 py-4 font-semibold text-foreground">
                  Ingredients
                </th>
                <th className="text-right px-6 py-4 font-semibold text-foreground">
                  Price
                </th>
                <th className="text-center px-6 py-4 font-semibold text-foreground">
                  Available Stock
                </th>
                <th className="text-center px-6 py-4 font-semibold text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-4 font-medium">{product.name}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 border border-border rounded-full text-sm">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {product.ingredients && product.ingredients.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {product.ingredients.slice(0, 3).map((pi) => (
                          <span
                            key={pi.ingredientId}
                            className="px-2 py-0.5 bg-muted text-xs rounded"
                          >
                            {getIngredientName(pi.ingredientId).split(" (")[0]}
                          </span>
                        ))}
                        {product.ingredients.length > 3 && (
                          <span className="px-2 py-0.5 bg-muted text-xs rounded">
                            +{product.ingredients.length - 3} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-[#A61F30] font-medium">
                    P{product.price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-10 h-10 bg-[#A61F30] text-white rounded-full font-medium">
                      {getProductAvailableStock(product, ingredients)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                      >
                        <Pencil className="h-5 w-5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                      >
                        <Trash2 className="h-5 w-5 text-[#A61F30]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

export default function InventoryPage() {
  return <InventoryPageContent />
}
