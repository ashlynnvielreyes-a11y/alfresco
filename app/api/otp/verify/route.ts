import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return "Unknown error"
  }
}

function isMissingColumnError(error: unknown, columnName: string, tableName: string) {
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes(`could not find the '${columnName.toLowerCase()}' column`) &&
    message.includes(`'${tableName.toLowerCase()}'`)
  )
}

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json()

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: "Email and OTP are required" },
        { status: 400 }
      )
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: "Invalid OTP format. Must be 6 digits." },
        { status: 400 }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const supabase = createAdminClient()

    // Find the OTP record
    let otpRecord: any = null
    let fetchError: { message?: string } | null = null

    const currentSchemaFetch = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("is_used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (currentSchemaFetch.error && isMissingColumnError(currentSchemaFetch.error, "is_used", "otp_codes")) {
      const legacyFetch = await supabase
        .from("otp_codes")
        .select("*")
        .eq("email", normalizedEmail)
        .eq("verified", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      otpRecord = legacyFetch.data
      fetchError = legacyFetch.error
    } else {
      otpRecord = currentSchemaFetch.data
      fetchError = currentSchemaFetch.error
    }

    if (fetchError || !otpRecord) {
      return NextResponse.json(
        { success: false, error: "No OTP found for this email. Please request a new one." },
        { status: 400 }
      )
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      const expireCurrentOtp = await supabase.from("otp_codes").update({ is_used: true }).eq("id", otpRecord.id)
      if (expireCurrentOtp.error && isMissingColumnError(expireCurrentOtp.error, "is_used", "otp_codes")) {
        await supabase.from("otp_codes").delete().eq("id", otpRecord.id)
      }
      return NextResponse.json(
        { success: false, error: "OTP has expired. Please request a new one." },
        { status: 400 }
      )
    }

    // Check attempts (max 3)
    const maxAttempts = typeof otpRecord.max_attempts === "number" ? otpRecord.max_attempts : 3

    if (otpRecord.attempts >= maxAttempts) {
      const lockCurrentOtp = await supabase.from("otp_codes").update({ is_used: true }).eq("id", otpRecord.id)
      if (lockCurrentOtp.error && isMissingColumnError(lockCurrentOtp.error, "is_used", "otp_codes")) {
        await supabase.from("otp_codes").delete().eq("id", otpRecord.id)
      }
      return NextResponse.json(
        { success: false, error: "Too many failed attempts. Please request a new OTP." },
        { status: 400 }
      )
    }

    // Verify OTP
    if (otpRecord.otp_code === otp) {
      const verifyCurrentOtp = await supabase
        .from("otp_codes")
        .update({ is_used: true, verified_at: new Date().toISOString() })
        .eq("id", otpRecord.id)

      if (
        verifyCurrentOtp.error &&
        (
          isMissingColumnError(verifyCurrentOtp.error, "is_used", "otp_codes") ||
          isMissingColumnError(verifyCurrentOtp.error, "verified_at", "otp_codes")
        )
      ) {
        await supabase
          .from("otp_codes")
          .update({ verified: true })
          .eq("id", otpRecord.id)
      }
      
      return NextResponse.json({
        success: true,
        message: "OTP verified successfully",
      })
    } else {
      const nextAttemptCount = otpRecord.attempts + 1
      const failCurrentOtp = await supabase
        .from("otp_codes")
        .update({
          attempts: nextAttemptCount,
          ...(nextAttemptCount >= maxAttempts ? { is_used: true } : {}),
        })
        .eq("id", otpRecord.id)

      if (failCurrentOtp.error && isMissingColumnError(failCurrentOtp.error, "is_used", "otp_codes")) {
        if (nextAttemptCount >= maxAttempts) {
          await supabase
            .from("otp_codes")
            .delete()
            .eq("id", otpRecord.id)
        } else {
          await supabase
            .from("otp_codes")
            .update({ attempts: nextAttemptCount })
            .eq("id", otpRecord.id)
        }
      }
      
      return NextResponse.json(
        { success: false, error: "Invalid OTP. Please try again." },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("OTP verify error:", error)
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

