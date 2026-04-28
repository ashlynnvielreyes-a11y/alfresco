"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Plus, Pencil, Trash2, Coffee, UtensilsCrossed, Search } from "lucide-react"
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
import { initializeSupabaseStore, getAddOns, addAddOn, updateAddOn, deleteAddOn, getIngredients } from "@/lib/store"
import type { AddOn, Ingredient } from "@/lib/types"

type FormMode = "list" | "add" | "edit"
type CategoryFilter = "all" | "drink" | "meal"

function AddOnsPageContent() {
  const [addOns, setAddOns] = useState<AddOn[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [mode, setMode] = useState<FormMode>("list")
  const [editingAddOn, setEditingAddOn] = useState<AddOn | null>(null)
  const [addOnToDelete, setAddOnToDelete] = useState<AddOn | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    category: "drink" as "drink" | "meal",
    ingredientId: "",
    productId: "",
    quantity: "1",
  })

  useEffect(() => {
    const loadData = async () => {
      await initializeSupabaseStore()
      setAddOns(getAddOns())
      setIngredients(getIngredients())
    }

    void loadData()
  }, [])

  const resetForm = () => {
    setFormData({ name: "", price: "", category: "drink", ingredientId: "", productId: "", quantity: "1" })
    setEditingAddOn(null)
    setMode("list")
  }

  const handleAdd = () => {
    setMode("add")
    setFormData({ name: "", price: "", category: "drink", ingredientId: "", productId: "", quantity: "1" })
  }

  const handleEdit = (addOn: AddOn) => {
    setEditingAddOn(addOn)
    setFormData({
      name: addOn.name,
      price: addOn.price.toString(),
      category: addOn.category,
      ingredientId: addOn.ingredientId?.toString() || "",
      productId: addOn.productId || "",
      quantity: addOn.quantity?.toString() || "1",
    })
    setMode("edit")
  }

  const handleIngredientChange = (ingredientId: string) => {
    const selectedIngredient = ingredients.find((ingredient) => ingredient.id === Number(ingredientId))
    setFormData((prev) => ({
      ...prev,
      ingredientId,
      productId: selectedIngredient?.productId || "",
      quantity: ingredientId ? prev.quantity || "1" : "",
    }))
  }

  const handleDelete = (id: string) => {
    const addOn = addOns.find((entry) => entry.id === id)
    if (!addOn) return
    setAddOnToDelete(addOn)
  }

  const confirmDelete = () => {
    if (!addOnToDelete) return
    deleteAddOn(addOnToDelete.id)
    setAddOns(getAddOns())
    setAddOnToDelete(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const price = parseFloat(formData.price) || 0
    const quantity = parseFloat(formData.quantity) || 0
    const ingredientId = formData.ingredientId ? parseInt(formData.ingredientId, 10) : undefined
    const productId = formData.productId.trim() || undefined

    if (mode === "add") {
      addAddOn({
        name: formData.name,
        price,
        category: formData.category,
        ingredientId,
        productId,
        quantity,
      })
    } else if (editingAddOn) {
      updateAddOn(editingAddOn.id, {
        name: formData.name,
        price,
        category: formData.category,
        ingredientId,
        productId,
        quantity,
      })
    }

    setAddOns(getAddOns())
    resetForm()
  }

  const filteredAddOns = addOns.filter((addOn) => {
    const matchesCategory = categoryFilter === "all" || addOn.category === categoryFilter
    const query = searchQuery.trim().toLowerCase()
    const matchesSearch =
      !query ||
      addOn.name.toLowerCase().includes(query) ||
      addOn.category.toLowerCase().includes(query)

    return matchesCategory && matchesSearch
  })

  const drinkAddOns = addOns.filter(a => a.category === "drink")
  const mealAddOns = addOns.filter(a => a.category === "meal")

  if (mode === "add" || mode === "edit") {
    return (
      <div className="flex min-h-screen bg-transparent">
        <Sidebar />
        <main className="relative flex-1 flex items-center justify-center overflow-hidden p-4 pt-20 lg:pt-6 lg:p-6">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-4 top-8 h-56 w-56 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
            <div className="absolute bottom-12 right-12 h-56 w-56 rounded-full bg-[#b2967d]/14 blur-3xl" />
          </div>
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[#f5f1ea]/55 bg-[rgba(245,241,234,0.76)] p-6 shadow-[0_24px_56px_rgba(74,52,42,0.08)] backdrop-blur-xl lg:p-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#4a342a] text-center mb-6 lg:mb-8">
              {mode === "add" ? "Add New Add-on" : "Edit Add-on"}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-[#7d5a44] mb-2">
                  Add-on Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Extra Shot, Pearl (Boba)"
                  className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border border-[#b2967d]/50 focus:ring-2 focus:ring-[#4a342a] focus:border-[#4a342a] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#7d5a44] mb-2">
                  Price (P)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border border-[#b2967d]/50 focus:ring-2 focus:ring-[#4a342a] focus:border-[#4a342a] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#7d5a44] mb-2">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, category: "drink" })}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                      formData.category === "drink"
                        ? "border-[#4a342a] bg-[#f5f1ea] text-[#4a342a]"
                        : "border-border bg-[#f5f1ea] text-muted-foreground hover:border-[#b2967d]"
                    }`}
                  >
                    <Coffee className="h-5 w-5" />
                    <span className="font-medium">Drinks</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, category: "meal" })}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                      formData.category === "meal"
                        ? "border-[#4a342a] bg-[#f5f1ea] text-[#4a342a]"
                        : "border-border bg-[#f5f1ea] text-muted-foreground hover:border-[#b2967d]"
                    }`}
                  >
                    <UtensilsCrossed className="h-5 w-5" />
                    <span className="font-medium">Meals</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#7d5a44] mb-2">
                  Ingredient
                </label>
                <select
                  value={formData.ingredientId}
                  onChange={(e) => handleIngredientChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border border-[#b2967d]/50 focus:ring-2 focus:ring-[#4a342a] focus:border-[#4a342a] outline-none"
                >
                  <option value="">No ingredient link</option>
                  {ingredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.productId} - {ingredient.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-muted-foreground">
                  Choosing an ingredient auto-fills the product ID for inventory tracking.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#7d5a44] mb-2">
                    Product ID
                  </label>
                  <input
                    type="text"
                    value={formData.productId}
                    readOnly
                    placeholder="Auto-filled from ingredient"
                    className="w-full px-4 py-3 rounded-lg bg-muted border border-[#b2967d]/30 outline-none text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#7d5a44] mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="0"
                    disabled={!formData.ingredientId}
                    className="w-full px-4 py-3 rounded-lg bg-[#f5f1ea] border border-[#b2967d]/50 focus:ring-2 focus:ring-[#4a342a] focus:border-[#4a342a] outline-none disabled:bg-muted disabled:text-muted-foreground"
                  />
                </div>
              </div>

              <button
                type="submit"
                className={`w-full py-4 font-semibold rounded-lg transition-colors ${
                  mode === "add"
                    ? "bg-[#4a342a] hover:bg-[#7d5a44] text-[#f5f1ea]"
                    : "bg-[#7d5a44] hover:bg-[#4a342a] text-[#f5f1ea]"
                }`}
              >
                {mode === "add" ? "ADD ADD-ON" : "SAVE CHANGES"}
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
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />
      <main className="relative flex-1 overflow-hidden p-4 pt-20 lg:pt-6 lg:p-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-10 h-64 w-64 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
          <div className="absolute right-8 top-24 h-52 w-52 rounded-full bg-[#7d5a44]/10 blur-3xl" />
        </div>
        <div className="relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#4a342a]">
              Add-ons Management
            </h1>
            <p className="text-muted-foreground mt-1 text-sm lg:text-base">
              Manage add-ons for drinks and meals
            </p>
          </div>

          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-3 bg-[#4a342a] hover:bg-[#7d5a44] text-[#f5f1ea] font-semibold rounded-lg transition-colors text-sm lg:text-base w-full sm:w-auto justify-center"
          >
            <Plus className="h-5 w-5" />
            Add New
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search add-ons by name or type"
            className="w-full rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 py-3 pl-12 pr-4 text-foreground outline-none shadow-[inset_0_1px_0_rgba(245,241,234,0.75)] backdrop-blur-sm transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-hide">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap text-sm lg:text-base ${
              categoryFilter === "all"
                ? "bg-[#4a342a] text-[#f5f1ea]"
                : "bg-[#f5f1ea] border border-border text-foreground hover:bg-muted"
            }`}
          >
            All ({addOns.length})
          </button>
          <button
            onClick={() => setCategoryFilter("drink")}
            className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap text-sm lg:text-base flex items-center gap-2 ${
              categoryFilter === "drink"
                ? "bg-[#4a342a] text-[#f5f1ea]"
                : "bg-[#f5f1ea] border border-border text-foreground hover:bg-muted"
            }`}
          >
            <Coffee className="h-4 w-4" />
            Drinks ({drinkAddOns.length})
          </button>
          <button
            onClick={() => setCategoryFilter("meal")}
            className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap text-sm lg:text-base flex items-center gap-2 ${
              categoryFilter === "meal"
                ? "bg-[#4a342a] text-[#f5f1ea]"
                : "bg-[#f5f1ea] border border-border text-foreground hover:bg-muted"
            }`}
          >
            <UtensilsCrossed className="h-4 w-4" />
            Meals ({mealAddOns.length})
          </button>
        </div>

        {filteredAddOns.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No add-ons found</p>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#4a342a] hover:bg-[#7d5a44] text-[#f5f1ea] font-semibold rounded-lg transition-colors"
            >
              <Plus className="h-5 w-5" />
              Add Your First Add-on
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAddOns.map((addOn) => (
              <div
                key={addOn.id}
                className="rounded-lg border border-border bg-[rgba(245,241,234,0.74)] p-4 backdrop-blur-md transition-shadow hover:shadow-md"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{addOn.name}</h3>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1 ${
                      addOn.category === "drink"
                        ? "bg-[#d7c9b8] text-[#4a342a]"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {addOn.category === "drink" ? (
                        <Coffee className="h-3 w-3" />
                      ) : (
                        <UtensilsCrossed className="h-3 w-3" />
                      )}
                      {addOn.category === "drink" ? "Drink" : "Meal"}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-[#4a342a] ml-2">
                    P{addOn.price.toFixed(0)}
                  </span>
                </div>

                {addOn.productId && addOn.quantity ? (
                  <p className="text-xs text-muted-foreground">
                    {addOn.productId} • Qty {addOn.quantity}
                  </p>
                ) : null}

                <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-border">
                  <button
                    onClick={() => handleEdit(addOn)}
                    className="p-2 hover:bg-[#f5f1ea] rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4 text-[#7d5a44]" />
                  </button>
                  <button
                    onClick={() => handleDelete(addOn.id)}
                    className="p-2 hover:bg-[#f5f1ea] rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-[#4a342a]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
        <AlertDialog open={Boolean(addOnToDelete)} onOpenChange={(open) => !open && setAddOnToDelete(null)}>
          <AlertDialogContent className="border-[#f5f1ea]/60 bg-[rgba(245,241,234,0.96)] shadow-[0_24px_56px_rgba(74,52,42,0.16)] backdrop-blur-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[#4a342a]">Delete Add-on</AlertDialogTitle>
              <AlertDialogDescription className="text-[#7d5a44]">
                {addOnToDelete
                  ? `Remove ${addOnToDelete.name}? This action cannot be undone.`
                  : "Remove this add-on? This action cannot be undone."}
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

export default function AddOnsPage() {
  return <AddOnsPageContent />
}



