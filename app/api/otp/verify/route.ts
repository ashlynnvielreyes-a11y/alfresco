import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json()

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: "Email and OTP are required" },
        { status: 400 }
      )
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: "Invalid OTP format. Must be 6 digits." },
        { status: 400 }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const supabase = createAdminClient()

    const { data: otpRecord, error: fetchError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("is_used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (fetchError || !otpRecord) {
      return NextResponse.json(
        { success: false, error: "No OTP found for this email. Please request a new one." },
        { status: 400 }
      )
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabase.from("otp_codes").update({ is_used: true }).eq("id", otpRecord.id)
      return NextResponse.json(
        { success: false, error: "OTP has expired. Please request a new one." },
        { status: 400 }
      )
    }

    const maxAttempts = typeof otpRecord.max_attempts === "number" ? otpRecord.max_attempts : 3

    if (otpRecord.attempts >= maxAttempts) {
      await supabase.from("otp_codes").update({ is_used: true }).eq("id", otpRecord.id)
      return NextResponse.json(
        { success: false, error: "Too many failed attempts. Please request a new OTP." },
        { status: 400 }
      )
    }

    if (otpRecord.otp_code === otp) {
      await supabase
        .from("otp_codes")
        .update({ is_used: true, verified_at: new Date().toISOString() })
        .eq("id", otpRecord.id)

      return NextResponse.json({
        success: true,
        message: "OTP verified successfully",
      })
    }

    const nextAttemptCount = otpRecord.attempts + 1
    await supabase
      .from("otp_codes")
      .update({
        attempts: nextAttemptCount,
        ...(nextAttemptCount >= maxAttempts ? { is_used: true } : {}),
      })
      .eq("id", otpRecord.id)

    return NextResponse.json(
      { success: false, error: "Invalid OTP. Please try again." },
      { status: 400 }
    )
  } catch (error) {
    console.error("OTP verify error:", error)
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
