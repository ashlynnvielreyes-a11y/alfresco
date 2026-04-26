import type { ProductCategory } from "./types"

export const DEFAULT_PRODUCT_CATEGORY = "Coffee" as const satisfies ProductCategory

export const PRODUCT_CATEGORY_OPTIONS = [
  "Coffee",
  "Milk Tea",
  "Fruit Tea",
  "Silog",
] as const satisfies readonly ProductCategory[]

const PRODUCT_CATEGORY_ALIASES: Record<string, ProductCategory> = {
  coffee: "Coffee",
  "milk tea": "Milk Tea",
  milktea: "Milk Tea",
  "fruit tea": "Fruit Tea",
  fruittea: "Fruit Tea",
  silog: "Silog",
  pastry: "Fruit Tea",
}

export function normalizeProductCategory(category: string | null | undefined): ProductCategory {
  const compactCategory = String(category || "")
    .replace(/\s+/g, " ")
    .trim()

  if (!compactCategory) return DEFAULT_PRODUCT_CATEGORY

  const canonicalCategory = PRODUCT_CATEGORY_ALIASES[compactCategory.toLowerCase()]
  return canonicalCategory || compactCategory
}

