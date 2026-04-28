"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Plus, Pencil, Trash2, X, Search } from "lucide-react"
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
import { initializeSupabaseStore, getProducts, addProduct, updateProduct, deleteProduct, getIngredients, getProductAvailableStock } from "@/lib/store"
import { DEFAULT_PRODUCT_CATEGORY, normalizeProductCategory, PRODUCT_CATEGORY_OPTIONS } from "@/lib/product-categories"
import type { Product, Ingredient, ProductIngredient, ProductCategory } from "@/lib/types"

type FormMode = "list" | "add" | "edit"

function CategoryBadge({ category }: { category: ProductCategory }) {
  const normalizedCategory = normalizeProductCategory(category)

  return (
    <span
      title={normalizedCategory}
      className="inline-flex max-w-full items-center rounded-full border border-[#d7c9b8] bg-[#f5f1ea] px-3 py-1 text-sm font-medium leading-none whitespace-nowrap text-[#7d5a44] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
    >
      <span className="block max-w-[11rem] overflow-hidden text-ellipsis whitespace-nowrap">
        {normalizedCategory}
      </span>
    </span>
  )
}

function InventoryPageContent() {
  const [products, setProducts] = useState<Product[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [mode, setMode] = useState<FormMode>("list")
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    category: DEFAULT_PRODUCT_CATEGORY as Product["category"],
    price: "",
  })
  const [productIngredients, setProductIngredients] = useState<ProductIngredient[]>([])

  useEffect(() => {
    const loadData = async () => {
      await initializeSupabaseStore()
      setProducts(getProducts())
      setIngredients(getIngredients())
    }

    void loadData()
  }, [])

  const resetForm = () => {
    setFormData({ name: "", category: DEFAULT_PRODUCT_CATEGORY, price: "" })
    setProductIngredients([])
    setEditingProduct(null)
    setMode("list")
  }

  const handleAdd = () => {
    setMode("add")
    setFormData({ name: "", category: DEFAULT_PRODUCT_CATEGORY, price: "" })
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
    const product = products.find((entry) => entry.id === id)
    if (!product) return
    setProductToDelete(product)
  }

  const confirmDelete = () => {
    if (!productToDelete) return
    deleteProduct(productToDelete.id)
    setProducts(getProducts())
    setProductToDelete(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const productData = {
      name: formData.name,
      category: normalizeProductCategory(formData.category),
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

  const filteredProducts = products.filter((product) => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return true

    const ingredientNames = (product.ingredients || [])
      .map((pi) => getIngredientName(pi.ingredientId).toLowerCase())
      .join(" ")

    return (
      product.name.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query) ||
      ingredientNames.includes(query)
    )
  })

  if (mode !== "list") {
    const availableIngredientsForAdd = ingredients.filter(
      (ing) => !productIngredients.some((pi) => pi.ingredientId === ing.id)
    )

    return (
      <div className="flex min-h-screen bg-transparent">
        <Sidebar />
        <main className="relative flex-1 flex items-center justify-center overflow-hidden p-4 pt-20 lg:p-6 lg:pt-6">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-4 top-8 h-56 w-56 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
            <div className="absolute bottom-12 right-12 h-60 w-60 rounded-full bg-[#b2967d]/14 blur-3xl" />
          </div>
          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-[#f5f1ea]/55 bg-[rgba(245,241,234,0.76)] p-6 shadow-[0_24px_56px_rgba(74,52,42,0.08)] backdrop-blur-xl lg:p-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#4a342a] text-center mb-6 lg:mb-8">
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
                  className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border-0 focus:ring-2 focus:ring-[#4a342a] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: normalizeProductCategory(e.target.value) as Product["category"] })}
                  className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border border-border focus:ring-2 focus:ring-[#4a342a] outline-none"
                >
                  {PRODUCT_CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
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
                  className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border-0 focus:ring-2 focus:ring-[#4a342a] outline-none"
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
                      className="flex items-center gap-1 text-sm text-[#4a342a] hover:text-[#7d5a44] font-medium"
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
                            className="flex-1 px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-[#4a342a] outline-none bg-[#f5f1ea]"
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
                            className="w-24 px-3 py-2 rounded-lg border border-border focus:ring-2 focus:ring-[#4a342a] outline-none text-center"
                          />
                          <span className="text-sm text-muted-foreground w-12">
                            {ingredient?.unit || ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeIngredientFromProduct(pi.ingredientId)}
                            className="p-1 hover:bg-[#f5f1ea] rounded transition-colors"
                          >
                            <X className="h-4 w-4 text-[#4a342a]" />
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
                    ? "bg-[#4a342a] hover:bg-[#7d5a44] text-[#f5f1ea]"
                    : "bg-[#7d5a44] hover:bg-[#4a342a] text-[#f5f1ea]"
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
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-hidden p-4 pt-20 lg:p-6 lg:pt-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-10 h-64 w-64 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
          <div className="absolute right-8 top-24 h-56 w-56 rounded-full bg-[#7d5a44]/10 blur-3xl" />
        </div>
        <div className="relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4 lg:mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#4a342a]">
              Inventory Management
            </h1>
            <p className="text-muted-foreground text-sm lg:text-base">
              Manage your coffee, meals, and stock levels
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-3 bg-[#4a342a] hover:bg-[#7d5a44] text-[#f5f1ea] font-semibold rounded-lg transition-colors text-sm lg:text-base w-full sm:w-auto justify-center"
          >
            <Plus className="h-5 w-5" />
            Add New Product
          </button>
        </div>

        <div className="relative mb-4 lg:mb-6">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, categories, or ingredients"
            className="w-full rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 py-3 pl-12 pr-4 text-foreground outline-none shadow-[inset_0_1px_0_rgba(245,241,234,0.75)] backdrop-blur-sm transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
          />
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
          {filteredProducts.map((product) => (
            <div key={product.id} className="rounded-lg border border-border bg-[rgba(245,241,234,0.74)] p-4 backdrop-blur-md">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">{product.name}</h3>
                  <div className="mt-1 flex items-center">
                    <CategoryBadge category={product.category} />
                  </div>
                </div>
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#4a342a] text-[#f5f1ea] rounded-full font-medium text-sm flex-shrink-0">
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
                <p className="text-[#4a342a] font-bold">P{product.price.toFixed(2)}</p>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(product)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => handleDelete(product.id)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <Trash2 className="h-4 w-4 text-[#4a342a]" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block rounded-lg border border-border bg-[rgba(245,241,234,0.74)] overflow-x-auto backdrop-blur-md">
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
              {filteredProducts.map((product) => (
                <tr key={product.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-4 font-medium">{product.name}</td>
                  <td className="px-6 py-4 align-middle">
                    <div className="flex items-center">
                      <CategoryBadge category={product.category} />
                    </div>
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
                  <td className="px-6 py-4 text-right text-[#4a342a] font-medium">
                    P{product.price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-10 h-10 bg-[#4a342a] text-[#f5f1ea] rounded-full font-medium">
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
                        <Trash2 className="h-5 w-5 text-[#4a342a]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>

        <AlertDialog open={Boolean(productToDelete)} onOpenChange={(open) => !open && setProductToDelete(null)}>
          <AlertDialogContent className="border-[#f5f1ea]/60 bg-[rgba(245,241,234,0.96)] shadow-[0_24px_56px_rgba(74,52,42,0.16)] backdrop-blur-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[#4a342a]">Delete Product</AlertDialogTitle>
              <AlertDialogDescription className="text-[#7d5a44]">
                {productToDelete
                  ? `Remove ${productToDelete.name} from inventory? This action cannot be undone.`
                  : "Remove this product from inventory? This action cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-[#d7c9b8] bg-[#f5f1ea] text-[#4a342a] hover:bg-[#ede3d8]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-[#7d5a44] text-[#f5f1ea] hover:bg-[#4a342a]"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}

export default function InventoryPage() {
  return <InventoryPageContent />
}



