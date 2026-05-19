import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/server-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateEmail, validatePassword, type UserRole } from "@/lib/store"

type SupportedAction = "create" | "update" | "reset_password"

const ALLOWED_ROLES: UserRole[] = ["admin", "cashier", "inventory_staff", "barista", "manager", "kitchen"]

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

function isAllowedRole(role: string): role is UserRole {
  return ALLOWED_ROLES.includes(role as UserRole)
}

async function insertAuditLog(
  supabase: ReturnType<typeof createAdminClient>,
  actorUserId: string,
  action: string,
  entityId: string,
  details: string
) {
  const actorResponse = await supabase
    .from("users")
    .select("username")
    .eq("id", actorUserId)
    .maybeSingle()

  const actorUsername = actorResponse.data?.username || "admin"

  const { error } = await supabase.from("audit_logs").insert([
    {
      id: crypto.randomUUID(),
      actor_user_id: actorUserId,
      actor_username: actorUsername,
      action,
      entity_type: "user",
      entity_id: entityId,
      details,
      created_at: new Date().toISOString(),
    },
  ])

  if (error) {
    const message = getErrorMessage(error).toLowerCase()
    if (!message.includes("audit_logs")) {
      throw error
    }
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request)
  if (!session.success) {
    return session.response
  }

  try {
    const body = await request.json()
    const action = String(body.action || "create") as SupportedAction
    const supabase = createAdminClient()

    if (action === "create") {
      const username = String(body.username || "").trim()
      const email = String(body.email || "").trim().toLowerCase()
      const password = String(body.password || "")
      const role = String(body.role || "").trim()

      if (!username) {
        return NextResponse.json({ success: false, error: "Username is required." }, { status: 400 })
      }

      if (!validateEmail(email)) {
        return NextResponse.json({ success: false, error: "Valid email is required." }, { status: 400 })
      }

      if (!isAllowedRole(role)) {
        return NextResponse.json({ success: false, error: "Valid role is required." }, { status: 400 })
      }

      const passwordValidation = validatePassword(password)
      if (!passwordValidation.valid) {
        return NextResponse.json({ success: false, error: passwordValidation.errors[0] }, { status: 400 })
      }

      const existingUserResponse = await supabase
        .from("users")
        .select("id")
        .or(`username.eq.${username},email.eq.${email}`)
        .maybeSingle()

      if (existingUserResponse.error) {
        throw existingUserResponse.error
      }

      if (existingUserResponse.data) {
        return NextResponse.json({ success: false, error: "Username or email already exists." }, { status: 409 })
      }

      let includeIsActive = true
      let includeCreatedAt = true
      let includeUpdatedAt = true
      const userId = crypto.randomUUID()

      while (true) {
        const { data, error } = await supabase
          .from("users")
          .insert([
            {
              id: userId,
              username,
              email,
              password_hash: password,
              role,
              ...(includeIsActive ? { is_active: true } : {}),
              ...(includeCreatedAt ? { created_at: new Date().toISOString() } : {}),
              ...(includeUpdatedAt ? { updated_at: new Date().toISOString() } : {}),
            },
          ])
          .select("id, username, email, role, is_active, created_at, updated_at, deactivated_at")
          .single()

        if (!error) {
          await insertAuditLog(supabase, session.auth.id, "user_created", data.id, `${data.username} (${data.role}) created`)
          return NextResponse.json({ success: true, user: data, message: "User created successfully." })
        }

        if (includeIsActive && isSupabaseMissingColumnError(error, "is_active", "users")) {
          includeIsActive = false
          continue
        }

        if (includeCreatedAt && isSupabaseMissingColumnError(error, "created_at", "users")) {
          includeCreatedAt = false
          continue
        }

        if (includeUpdatedAt && isSupabaseMissingColumnError(error, "updated_at", "users")) {
          includeUpdatedAt = false
          continue
        }

        throw error
      }
    }

    if (action === "reset_password") {
      const userId = String(body.userId || "").trim()
      const password = String(body.password || "")

      if (!userId) {
        return NextResponse.json({ success: false, error: "User ID is required." }, { status: 400 })
      }

      const passwordValidation = validatePassword(password)
      if (!passwordValidation.valid) {
        return NextResponse.json({ success: false, error: passwordValidation.errors[0] }, { status: 400 })
      }

      let includeUpdatedAt = true

      while (true) {
        const { error } = await supabase
          .from("users")
          .update({
            password_hash: password,
            ...(includeUpdatedAt ? { updated_at: new Date().toISOString() } : {}),
          })
          .eq("id", userId)

        if (!error) {
          await insertAuditLog(supabase, session.auth.id, "user_password_reset", userId, "Password reset by admin")
          return NextResponse.json({ success: true, message: "Password reset successfully." })
        }

        if (includeUpdatedAt && isSupabaseMissingColumnError(error, "updated_at", "users")) {
          includeUpdatedAt = false
          continue
        }

        throw error
      }
    }

    return NextResponse.json({ success: false, error: "Unsupported action." }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession(request)
  if (!session.success) {
    return session.response
  }

  try {
    const body = await request.json()
    const userId = String(body.userId || "").trim()
    const username = String(body.username || "").trim()
    const email = String(body.email || "").trim().toLowerCase()
    const role = String(body.role || "").trim()

    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID is required." }, { status: 400 })
    }

    if (!username) {
      return NextResponse.json({ success: false, error: "Username is required." }, { status: 400 })
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ success: false, error: "Valid email is required." }, { status: 400 })
    }

    if (!isAllowedRole(role)) {
      return NextResponse.json({ success: false, error: "Valid role is required." }, { status: 400 })
    }

    const supabase = createAdminClient()
    let includeUpdatedAt = true

    while (true) {
      const { error } = await supabase
        .from("users")
        .update({
          username,
          email,
          role,
          ...(includeUpdatedAt ? { updated_at: new Date().toISOString() } : {}),
        })
        .eq("id", userId)

      if (!error) {
        await insertAuditLog(supabase, session.auth.id, "user_updated", userId, `${username} updated`)
        return NextResponse.json({ success: true, message: "User updated successfully." })
      }

      if (includeUpdatedAt && isSupabaseMissingColumnError(error, "updated_at", "users")) {
        includeUpdatedAt = false
        continue
      }

      throw error
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 })
  }
}
