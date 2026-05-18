import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdminSession } from "@/lib/server-auth"

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return "Unknown error"
  }
}

function isSupabaseMissingColumnError(error: unknown, columnName: string, tableName: string) {
  const message = getErrorMessage(error).toLowerCase()
  const normalizedColumnName = columnName.toLowerCase()
  const normalizedTableName = tableName.toLowerCase()

  return (
    (
      message.includes(`could not find the '${normalizedColumnName}' column`) ||
      message.includes(`could not find the "${normalizedColumnName}" column`) ||
      message.includes(`column "${normalizedColumnName}" does not exist`) ||
      message.includes(`column '${normalizedColumnName}' does not exist`)
    ) &&
    (
      message.includes(`'${normalizedTableName}'`) ||
      message.includes(`"${normalizedTableName}"`) ||
      message.includes(normalizedTableName)
    )
  )
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession(request)
  if (!session.success) {
    return session.response
  }

  try {
    const { userId, action } = await request.json()

    if (!userId || (action !== "activate" && action !== "revoke")) {
      return NextResponse.json({ success: false, error: "Valid userId and action are required." }, { status: 400 })
    }

    const supabase = createAdminClient()
    const isActivate = action === "activate"
    let includeDeactivatedAt = true
    let includeUpdatedAt = true

    while (true) {
      const { error } = await supabase
        .from("users")
        .update({
          is_active: isActivate,
          ...(includeDeactivatedAt ? { deactivated_at: isActivate ? null : new Date().toISOString() } : {}),
          ...(includeUpdatedAt ? { updated_at: new Date().toISOString() } : {}),
        })
        .eq("id", userId)

      if (!error) {
        break
      }

      if (includeDeactivatedAt && isSupabaseMissingColumnError(error, "deactivated_at", "users")) {
        includeDeactivatedAt = false
        continue
      }

      if (includeUpdatedAt && isSupabaseMissingColumnError(error, "updated_at", "users")) {
        includeUpdatedAt = false
        continue
      }

      if (isSupabaseMissingColumnError(error, "is_active", "users")) {
        return NextResponse.json(
          {
            success: false,
            error: `The users table is missing the is_active column required to ${isActivate ? "activate" : "revoke"} accounts.`,
          },
          { status: 400 }
        )
      }

      throw error
    }

    return NextResponse.json({
      success: true,
      action,
      userId,
      message: isActivate ? "Account activated successfully." : "Account revoked successfully.",
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 })
  }
}
