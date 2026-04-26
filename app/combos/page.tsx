"use client"

import { useState, useEffect, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { Plus, Pencil, Trash2, X } from "lucide-react"
import { initializeSupabaseStore, getComboMeals, addComboMeal, updateComboMeal, deleteComboMeal, getProducts, getIngredients } from "@/lib/store"
import type { ComboMeal, Product, Ingredient } from "@/lib/types"

type FormMode = "list" | "add" | "edit"

type ComboSelection = {
  ingredientId: number
  productId: number
  quantity: number
}

function ComboMealsPageContent() {
  const [combos, setCombos] = useState<ComboMeal[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [mode, setMode] = useState<FormMode>("list")
  const [editingCombo, setEditingCombo] = useState<ComboMeal | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
  })
  const [selectedItems, setSelectedItems] = useState<ComboSelection[]>([])

  useEffect(() => {
    const loadData = async () => {
      await initializeSupabaseStore()
      setCombos(getComboMeals())
      setProducts(getProducts())
      setIngredients(getIngredients())
    }

    void loadData()
  }, [])

  const comboIngredients = useMemo(() => ingredients, [ingredients])

  const getIngredientById = (ingredientId: number) =>
    comboIngredients.find((ingredient) => ingredient.id === ingredientId)

  const getLinkedProducts = (ingredientId: number) => {
    const ingredient = getIngredientById(ingredientId)
    if (!ingredient) return []

    return ingredient.assignedProducts
      .map((productId) => products.find((product) => product.id === productId))
      .filter((product): product is Product => Boolean(product))
  }

  const buildDefaultSelection = (): ComboSelection | null => {
    const ingredient = comboIngredients[0]
    if (!ingredient) return null

    const linkedProduct = getLinkedProducts(ingredient.id)[0]
    if (!linkedProduct) return null

    return {
      ingredientId: ingredient.id,
      productId: linkedProduct.id,
      quantity: 1,
    }
  }

  const normalizeComboItems = (items: ComboMeal["items"]): ComboSelection[] => {
    return items
      .map((item) => {
        const fallbackIngredient =
          item.ingredientId !== undefined
            ? getIngredientById(item.ingredientId)
            : comboIngredients.find((ingredient) => ingredient.assignedProducts.includes(item.productId))

        if (!fallbackIngredient) return null

        const linkedProducts = getLinkedProducts(fallbackIngredient.id)
        const resolvedProduct =
          linkedProducts.find((product) => product.id === item.productId) || linkedProducts[0]

        if (!resolvedProduct) return null

        return {
          ingredientId: fallbackIngredient.id,
          productId: resolvedProduct.id,
          quantity: item.quantity,
        }
      })
      .filter((item): item is ComboSelection => Boolean(item))
  }

  const resetForm = () => {
    setFormData({ name: "", description: "", price: "" })
    setSelectedItems([])
    setEditingCombo(null)
    setMode("list")
  }

  const handleAdd = () => {
    setMode("add")
    setFormData({ name: "", description: "", price: "" })
    const defaultSelection = buildDefaultSelection()
    setSelectedItems(defaultSelection ? [defaultSelection] : [])
  }

  const handleEdit = (combo: ComboMeal) => {
    setEditingCombo(combo)
    setFormData({
      name: combo.name,
      description: combo.description,
      price: combo.price.toString(),
    })
    setSelectedItems(normalizeComboItems(combo.items))
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
    const comboItems = selectedItems.map((item) => ({
      ingredientId: item.ingredientId,
      productId: item.productId,
      quantity: item.quantity,
    }))

    if (mode === "add") {
      addComboMeal({
        name: formData.name,
        description: formData.description,
        price,
        items: comboItems,
      })
    } else if (editingCombo) {
      updateComboMeal(editingCombo.id, {
        name: formData.name,
        description: formData.description,
        price,
        items: comboItems,
      })
    }

    setCombos(getComboMeals())
    resetForm()
  }

  const addIngredientToCombo = () => {
    const defaultSelection = buildDefaultSelection()
    if (defaultSelection) {
      setSelectedItems([...selectedItems, defaultSelection])
    }
  }

  const updateIngredientSelection = (index: number, ingredientId: number) => {
    const updated = [...selectedItems]
    const linkedProduct = getLinkedProducts(ingredientId)[0]

    updated[index] = {
      ingredientId,
      productId: linkedProduct?.id || updated[index].productId,
      quantity: updated[index].quantity,
    }

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

  const getItemSummary = (item: ComboMeal["items"][number]) => {
    const ingredient =
      item.ingredientId !== undefined
        ? getIngredientById(item.ingredientId)
        : comboIngredients.find((entry) => entry.assignedProducts.includes(item.productId))

    return {
      ingredientLabel: ingredient ? `${ingredient.productId} • ${ingredient.name}` : "Unknown ingredient",
    }
  }

  const hasUnlinkedSelections = selectedItems.some((item) => getLinkedProducts(item.ingredientId).length === 0)

  const pageShellClass =
    "rounded-[28px] border border-[rgba(74,52,42,0.08)] bg-[rgba(245,241,234,0.72)] shadow-[0_24px_60px_rgba(74,52,42,0.08)] backdrop-blur-xl"

  if (mode === "add" || mode === "edit") {
    return (
      <div className="flex min-h-screen bg-transparent">
        <Sidebar />
        <main className="relative flex-1 flex items-center justify-center overflow-hidden p-4 pt-20 lg:p-6 lg:pt-6">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-4 top-8 h-56 w-56 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
            <div className="absolute bottom-10 right-10 h-64 w-64 rounded-full bg-[#b2967d]/14 blur-3xl" />
          </div>

          <div className={`${pageShellClass} relative z-10 w-full max-w-3xl p-6 lg:p-8`}>
            <h1 className="mb-6 text-center text-2xl font-bold text-[#4a342a] lg:mb-8 lg:text-3xl">
              {mode === "add" ? "Create Combo Meal" : "Edit Combo Meal"}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#7d5a44]">Combo Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Linen Brunch Pairing"
                  className="w-full rounded-2xl border border-[#d7c9b8] bg-[#f5f1ea] px-4 py-3 outline-none focus:border-[#7d5a44] focus:ring-2 focus:ring-[#b2967d]"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#7d5a44]">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the ingredient-led pairing."
                  className="h-24 w-full resize-none rounded-2xl border border-[#d7c9b8] bg-[#f5f1ea] px-4 py-3 outline-none focus:border-[#7d5a44] focus:ring-2 focus:ring-[#b2967d]"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#7d5a44]">Combo Price (P)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-[#d7c9b8] bg-[#f5f1ea] px-4 py-3 outline-none focus:border-[#7d5a44] focus:ring-2 focus:ring-[#b2967d]"
                  required
                />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="block text-sm font-semibold text-[#7d5a44]">Items in Combo</label>
                  <button
                    type="button"
                    onClick={addIngredientToCombo}
                    className="flex items-center gap-1 text-sm font-medium text-[#4a342a] hover:text-[#7d5a44]"
                  >
                    <Plus className="h-4 w-4" />
                    Add Ingredient Item
                  </button>
                </div>

                {selectedItems.length === 0 ? (
                  <p className="text-sm italic text-muted-foreground">No combo ingredients selected yet</p>
                ) : (
                  <div className="space-y-3">
                    {selectedItems.map((item, index) => (
                      <div
                        key={index}
                        className="grid gap-3 rounded-2xl border border-[#d7c9b8] bg-[rgba(245,241,234,0.74)] p-4 backdrop-blur-md lg:grid-cols-[1.4fr_110px_auto]"
                      >
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">
                            Ingredient Source
                          </label>
                          <select
                            value={item.ingredientId}
                            onChange={(e) => updateIngredientSelection(index, parseInt(e.target.value))}
                            className="w-full rounded-xl border border-[#d7c9b8] bg-[#f5f1ea] px-3 py-2 outline-none focus:border-[#7d5a44] focus:ring-2 focus:ring-[#b2967d]"
                          >
                            {comboIngredients.map((ingredient) => (
                              <option key={ingredient.id} value={ingredient.id}>
                                {ingredient.productId} • {ingredient.name}
                                {ingredient.assignedProducts.length === 0 ? " (not linked)" : ""}
                              </option>
                            ))}
                          </select>
                          {getLinkedProducts(item.ingredientId).length === 0 && (
                            <p className="mt-2 text-xs text-[#7d5a44]">
                              This ingredient is visible here, but it still needs a linked POS product before this combo can be saved.
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#7d5a44]">
                            Qty
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateProductQuantity(index, parseInt(e.target.value))}
                            className="w-full rounded-xl border border-[#d7c9b8] bg-[#f5f1ea] px-3 py-2 text-center outline-none focus:border-[#7d5a44] focus:ring-2 focus:ring-[#b2967d]"
                          />
                        </div>

                        <div className="flex items-end justify-end">
                          <button
                            type="button"
                            onClick={() => removeProductFromCombo(index)}
                            className="rounded-xl p-2 text-[#7d5a44] transition-colors hover:bg-[#d7c9b8] hover:text-[#4a342a]"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {hasUnlinkedSelections && (
                  <div className="rounded-xl border border-[#d7c9b8] bg-[rgba(245,241,234,0.72)] px-4 py-3 text-sm text-[#7d5a44]">
                    Some selected ingredients do not have linked POS products yet. They are now visible in the picker, but you’ll need to assign them first before saving this combo.
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={selectedItems.length === 0 || hasUnlinkedSelections}
                className="w-full rounded-2xl bg-[#4a342a] py-4 font-semibold text-[#f5f1ea] transition-colors hover:bg-[#7d5a44] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mode === "add" ? "CREATE COMBO MEAL" : "SAVE CHANGES"}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="w-full text-center text-muted-foreground transition-colors hover:text-foreground"
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
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />
      <main className="relative flex-1 overflow-hidden p-4 pt-20 lg:p-6 lg:pt-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-10 h-64 w-64 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
          <div className="absolute right-10 top-24 h-56 w-56 rounded-full bg-[#7d5a44]/10 blur-3xl" />
        </div>

        <div className={`${pageShellClass} relative z-10 p-5 lg:p-7`}>
          <div className="mb-6 flex flex-col items-start justify-between gap-4 lg:mb-8 sm:flex-row">
            <div>
              <h1 className="text-2xl font-bold text-[#4a342a] lg:text-3xl">Combo Meals</h1>
              <p className="mt-1 text-sm text-[#7d5a44] lg:mt-2 lg:text-base">
                Build combos from ingredient records and quantities.
              </p>
            </div>

            <button
              onClick={handleAdd}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4a342a] px-4 py-2 text-sm font-semibold text-[#f5f1ea] transition-colors hover:bg-[#7d5a44] sm:w-auto lg:px-5 lg:py-3 lg:text-base"
            >
              <Plus className="h-5 w-5" />
              Create Combo Meal
            </button>
          </div>

          {combos.length === 0 ? (
            <div className="py-8 text-center lg:py-12">
              <p className="mb-4 text-sm text-[#7d5a44] lg:text-base">No combo meals created yet</p>
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#4a342a] px-4 py-2 text-sm font-semibold text-[#f5f1ea] transition-colors hover:bg-[#7d5a44] lg:px-5 lg:py-3 lg:text-base"
              >
                <Plus className="h-5 w-5" />
                Create Your First Combo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 lg:gap-6">
              {combos.map((combo) => (
                <div
                  key={combo.id}
                  className="rounded-[24px] border border-[#d7c9b8] bg-[rgba(245,241,234,0.76)] p-4 shadow-[0_16px_30px_rgba(74,52,42,0.06)] backdrop-blur-md transition-shadow hover:shadow-[0_20px_40px_rgba(74,52,42,0.12)] lg:p-6"
                >
                  <div className="mb-2 flex items-start justify-between lg:mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold text-[#4a342a] lg:text-lg">{combo.name}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-[#7d5a44] lg:text-sm">{combo.description}</p>
                    </div>
                  </div>

                  <div className="mb-3 rounded-2xl bg-[#f5f1ea] p-4 lg:mb-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7d5a44] lg:text-xs">
                      Ingredient-Led Items
                    </p>
                    <ul className="space-y-2 text-xs lg:text-sm">
                      {combo.items.map((item, idx) => {
                        const summary = getItemSummary(item)

                        return (
                          <li key={idx} className="text-[#4a342a]">
                            <span className="font-medium">{summary.ingredientLabel}</span>
                            <span className="block text-[#7d5a44]">Qty x{item.quantity}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-[#4a342a] lg:text-2xl">P{combo.price.toFixed(2)}</span>
                    <div className="flex gap-1 lg:gap-2">
                      <button
                        onClick={() => handleEdit(combo)}
                        className="rounded-xl p-1.5 transition-colors hover:bg-[#d7c9b8] lg:p-2"
                      >
                        <Pencil className="h-4 w-4 text-[#7d5a44] lg:h-5 lg:w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(combo.id)}
                        className="rounded-xl p-1.5 transition-colors hover:bg-[#d7c9b8] lg:p-2"
                      >
                        <Trash2 className="h-4 w-4 text-[#4a342a] lg:h-5 lg:w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function ComboMealsPage() {
  return <ComboMealsPageContent />
}
