"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Plus, Pencil, Trash2, X, Coffee, UtensilsCrossed } from "lucide-react"
import { getAddOns, addAddOn, updateAddOn, deleteAddOn } from "@/lib/store"
import type { AddOn } from "@/lib/types"

type FormMode = "list" | "add" | "edit"
type CategoryFilter = "all" | "drink" | "meal"

function AddOnsPageContent() {
  const [addOns, setAddOns] = useState<AddOn[]>([])
  const [mode, setMode] = useState<FormMode>("list")
  const [editingAddOn, setEditingAddOn] = useState<AddOn | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    category: "drink" as "drink" | "meal",
  })

  useEffect(() => {
    setAddOns(getAddOns())
  }, [])

  const resetForm = () => {
    setFormData({ name: "", price: "", category: "drink" })
    setEditingAddOn(null)
    setMode("list")
  }

  const handleAdd = () => {
    setMode("add")
    setFormData({ name: "", price: "", category: "drink" })
  }

  const handleEdit = (addOn: AddOn) => {
    setEditingAddOn(addOn)
    setFormData({
      name: addOn.name,
      price: addOn.price.toString(),
      category: addOn.category,
    })
    setMode("edit")
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this add-on?")) {
      deleteAddOn(id)
      setAddOns(getAddOns())
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const price = parseFloat(formData.price) || 0

    if (mode === "add") {
      addAddOn({
        name: formData.name,
        price,
        category: formData.category,
      })
    } else if (editingAddOn) {
      updateAddOn(editingAddOn.id, {
        name: formData.name,
        price,
        category: formData.category,
      })
    }

    setAddOns(getAddOns())
    resetForm()
  }

  const filteredAddOns = categoryFilter === "all" 
    ? addOns 
    : addOns.filter(a => a.category === categoryFilter)

  const drinkAddOns = addOns.filter(a => a.category === "drink")
  const mealAddOns = addOns.filter(a => a.category === "meal")

  if (mode === "add" || mode === "edit") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-4 pt-20 lg:pt-6 lg:p-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 lg:p-8 w-full max-w-lg">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#bb3e00] text-center mb-6 lg:mb-8">
              {mode === "add" ? "Add New Add-on" : "Edit Add-on"}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-[#8f2f00] mb-2">
                  Add-on Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Extra Shot, Pearl (Boba)"
                  className="w-full px-4 py-3 rounded-lg bg-[#fff1d7] border border-[#f7a645]/50 focus:ring-2 focus:ring-[#bb3e00] focus:border-[#bb3e00] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#8f2f00] mb-2">
                  Price (P)
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
                <label className="block text-sm font-semibold text-[#8f2f00] mb-2">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, category: "drink" })}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                      formData.category === "drink"
                        ? "border-[#bb3e00] bg-[#fff1d7] text-[#bb3e00]"
                        : "border-border bg-white text-muted-foreground hover:border-[#f7a645]"
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
                        ? "border-[#bb3e00] bg-[#fff1d7] text-[#bb3e00]"
                        : "border-border bg-white text-muted-foreground hover:border-[#f7a645]"
                    }`}
                  >
                    <UtensilsCrossed className="h-5 w-5" />
                    <span className="font-medium">Meals</span>
                  </button>
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
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 pt-20 lg:pt-6 lg:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#bb3e00]">
              Add-ons Management
            </h1>
            <p className="text-muted-foreground mt-1 text-sm lg:text-base">
              Manage add-ons for drinks and meals
            </p>
          </div>

          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-3 bg-[#bb3e00] hover:bg-[#8f2f00] text-white font-semibold rounded-lg transition-colors text-sm lg:text-base w-full sm:w-auto justify-center"
          >
            <Plus className="h-5 w-5" />
            Add New
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-hide">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap text-sm lg:text-base ${
              categoryFilter === "all"
                ? "bg-[#bb3e00] text-white"
                : "bg-white border border-border text-foreground hover:bg-muted"
            }`}
          >
            All ({addOns.length})
          </button>
          <button
            onClick={() => setCategoryFilter("drink")}
            className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap text-sm lg:text-base flex items-center gap-2 ${
              categoryFilter === "drink"
                ? "bg-[#bb3e00] text-white"
                : "bg-white border border-border text-foreground hover:bg-muted"
            }`}
          >
            <Coffee className="h-4 w-4" />
            Drinks ({drinkAddOns.length})
          </button>
          <button
            onClick={() => setCategoryFilter("meal")}
            className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap text-sm lg:text-base flex items-center gap-2 ${
              categoryFilter === "meal"
                ? "bg-[#bb3e00] text-white"
                : "bg-white border border-border text-foreground hover:bg-muted"
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
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#bb3e00] hover:bg-[#8f2f00] text-white font-semibold rounded-lg transition-colors"
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
                className="bg-white rounded-lg border border-border p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{addOn.name}</h3>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1 ${
                      addOn.category === "drink"
                        ? "bg-blue-100 text-blue-700"
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
                  <span className="text-lg font-bold text-[#bb3e00] ml-2">
                    P{addOn.price.toFixed(0)}
                  </span>
                </div>

                <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-border">
                  <button
                    onClick={() => handleEdit(addOn)}
                    className="p-2 hover:bg-[#fff1d7] rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4 text-[#8f2f00]" />
                  </button>
                  <button
                    onClick={() => handleDelete(addOn.id)}
                    className="p-2 hover:bg-[#fff1d7] rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-[#bb3e00]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default function AddOnsPage() {
  return <AddOnsPageContent />
}

