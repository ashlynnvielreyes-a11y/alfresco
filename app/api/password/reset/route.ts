import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

function validatePassword(password: string): string | null {
  if (password.length < 8 || password.length > 30) {
    return "Password must be 8 to 30 characters"
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return "Password must contain both lower and uppercase letters"
  }

  if (!/\d/.test(password)) {
    return "Password must contain a number"
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return "Password must contain a special character"
  }

  const forbiddenSequences = ["abc", "123", "234", "345", "456", "567", "678", "789", "qwerty", "asdf", "zxcv", "11", "22", "33", "44", "55", "66", "77", "88", "99", "00"]
  const normalizedPassword = password.toLowerCase()

  if (forbiddenSequences.some((sequence) => normalizedPassword.includes(sequence))) {
    return "Password contains forbidden sequences"
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email and new password are required." }, { status: 400 })
    }

    const passwordError = validatePassword(String(password))
    if (passwordError) {
      return NextResponse.json({ success: false, error: passwordError }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const supabase = createAdminClient()

    const { data: otpRecord, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("is_used", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (otpError || !otpRecord) {
      return NextResponse.json({ success: false, error: "No verified OTP found. Please verify a new code first." }, { status: 400 })
    }

    if (!otpRecord.verified_at) {
      return NextResponse.json({ success: false, error: "OTP has not been verified yet. Please verify the code first." }, { status: 400 })
    }

    const verifiedAt = new Date(otpRecord.verified_at)
    if (Number.isNaN(verifiedAt.getTime()) || Date.now() - verifiedAt.getTime() > 10 * 60 * 1000) {
      return NextResponse.json({ success: false, error: "Verified OTP has expired. Please request a new code." }, { status: 400 })
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .single()

    if (userError || !user) {
      return NextResponse.json({ success: false, error: "No account found for this email address." }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: String(password), updated_at: new Date().toISOString() })
      .eq("id", user.id)

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message || "Failed to update password." }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Password reset successfully." })
  } catch (error) {
    console.error("Password reset error:", error)
    return NextResponse.json({ success: false, error: "An unexpected error occurred." }, { status: 500 })
  }
}
