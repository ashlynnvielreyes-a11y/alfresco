import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/server-auth"
import { createAdminClient } from "@/lib/supabase/admin"

type RegistrationRole = "admin" | "cashier" | "inventory_staff" | "kitchen"

function validatePassword(password: string) {
  const errors: string[] = []

  if (password.length < 8 || password.length > 30) {
    errors.push("Password must be 8 to 30 characters long.")
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    errors.push("Password must contain both lowercase and uppercase letters.")
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number.")
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?]/.test(password)) {
    errors.push("Password must contain at least one special character.")
  }

  const forbiddenSequences = [
    "abc", "bcd", "cde", "def", "efg", "fgh", "ghi", "hij", "ijk", "jkl", "klm", "lmn", "mno",
    "nop", "opq", "pqr", "qrs", "rst", "stu", "tuv", "uvw", "vwx", "wxy", "xyz", "123", "234",
    "345", "456", "567", "678", "789", "0123", "1234", "2345", "3456", "4567", "5678", "6789",
    "11", "22", "33", "44", "55", "66", "77", "88", "99", "00", "qwerty", "asdf", "zxcv",
  ]

  if (forbiddenSequences.some((seq) => password.toLowerCase().includes(seq))) {
    errors.push("Password cannot contain common sequences or repeated characters.")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

function isRegistrationRole(value: string): value is RegistrationRole {
  return value === "admin" || value === "cashier" || value === "inventory_staff" || value === "kitchen"
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request)
  if (!session.success) {
    return session.response
  }

  try {
    const { username, email, password, role } = await request.json()

    const normalizedUsername = String(username || "").trim().toLowerCase()
    const normalizedEmail = String(email || "").trim().toLowerCase()
    const normalizedPassword = String(password || "")
    const normalizedRole = String(role || "")

    if (!normalizedUsername) {
      return NextResponse.json({ success: false, error: "Username is required" }, { status: 400 })
    }

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ success: false, error: "Please enter a valid email address" }, { status: 400 })
    }

    if (!isRegistrationRole(normalizedRole)) {
      return NextResponse.json({ success: false, error: "A valid role is required" }, { status: 400 })
    }

    const passwordValidation = validatePassword(normalizedPassword)
    if (!passwordValidation.valid) {
      return NextResponse.json({ success: false, error: passwordValidation.errors[0] }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: otpRecord, error: otpError } = await supabase
      .from("otp_codes")
      .select("id, verified_at")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (otpError || !otpRecord?.verified_at) {
      return NextResponse.json(
        { success: false, error: "No verified OTP found. Please verify a new code first." },
        { status: 400 }
      )
    }

    const verifiedAt = new Date(otpRecord.verified_at)
    if (Number.isNaN(verifiedAt.getTime()) || Date.now() - verifiedAt.getTime() > 10 * 60 * 1000) {
      return NextResponse.json(
        { success: false, error: "Verified OTP has expired. Please request a new code." },
        { status: 400 }
      )
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .or(`username.eq.${normalizedUsername},email.eq.${normalizedEmail}`)
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json({ success: false, error: "Username or email already exists" }, { status: 409 })
    }

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        username: normalizedUsername,
        email: normalizedEmail,
        password_hash: normalizedPassword,
        role: normalizedRole,
        is_active: true,
      })
      .select("id, username, email, role, is_active")
      .single()

    if (insertError || !newUser) {
      return NextResponse.json(
        { success: false, error: insertError?.message || "Registration failed" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: newUser,
      message: "Registration successful.",
    })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ success: false, error: "An unexpected error occurred" }, { status: 500 })
  }
}
