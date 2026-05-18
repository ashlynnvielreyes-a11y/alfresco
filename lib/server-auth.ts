import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

type AuthCookiePayload = {
  id: string
  role: "admin" | "cashier" | "inventory_staff"
  isActive: boolean
}

type AdminSessionResult =
  | { success: true; auth: AuthCookiePayload }
  | { success: false; response: NextResponse }

const AUTH_COOKIE_KEY = "alfresco_auth_state"

function parseAuthCookie(request: NextRequest): AuthCookiePayload | null {
  const raw = request.cookies.get(AUTH_COOKIE_KEY)?.value
  if (!raw) return null

  try {
    return JSON.parse(decodeURIComponent(raw)) as AuthCookiePayload
  } catch {
    return null
  }
}

function isSupabaseMissingColumnError(error: unknown, columnName: string, tableName: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
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

export async function requireAdminSession(request: NextRequest): Promise<AdminSessionResult> {
  const auth = parseAuthCookie(request)

  if (!auth?.id || auth.isActive === false) {
    return {
      success: false,
      response: NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 }),
    }
  }

  if (auth.role !== "admin") {
    return {
      success: false,
      response: NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 }),
    }
  }

  try {
    const supabase = createAdminClient()
    let user: { id: string; role: string; is_active?: boolean | null; deactivated_at?: string | null } | null = null
    let responseError: { message?: string } | null = null

    const primaryResponse = await supabase
      .from("users")
      .select("id, role, is_active, deactivated_at")
      .eq("id", auth.id)
      .maybeSingle()

    if (primaryResponse.error && isSupabaseMissingColumnError(primaryResponse.error, "is_active", "users")) {
      const fallbackResponse = await supabase
        .from("users")
        .select("id, role, deactivated_at")
        .eq("id", auth.id)
        .maybeSingle()

      user = fallbackResponse.data
      responseError = fallbackResponse.error
    } else {
      user = primaryResponse.data
      responseError = primaryResponse.error
    }

    if (responseError) {
      throw responseError
    }

    if (!user || user.role !== "admin" || user.is_active === false || Boolean(user.deactivated_at)) {
      return {
        success: false,
        response: NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 }),
      }
    }
  } catch (error) {
    console.error("Admin session validation error:", error)
    return {
      success: false,
      response: NextResponse.json({ success: false, error: "Unable to validate admin session." }, { status: 500 }),
    }
  }

  return { success: true, auth }
}
