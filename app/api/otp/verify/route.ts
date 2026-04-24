import { createClient } from "@/lib/supabase/server"
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

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: "Invalid OTP format. Must be 6 digits." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Find the OTP record
    const { data: otpRecord, error: fetchError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (fetchError || !otpRecord) {
      return NextResponse.json(
        { success: false, error: "No OTP found for this email. Please request a new one." },
        { status: 400 }
      )
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabase.from("otp_codes").delete().eq("id", otpRecord.id)
      return NextResponse.json(
        { success: false, error: "OTP has expired. Please request a new one." },
        { status: 400 }
      )
    }

    // Check attempts (max 3)
    if (otpRecord.attempts >= 3) {
      await supabase.from("otp_codes").delete().eq("id", otpRecord.id)
      return NextResponse.json(
        { success: false, error: "Too many failed attempts. Please request a new OTP." },
        { status: 400 }
      )
    }

    // Verify OTP
    if (otpRecord.otp_code === otp) {
      await supabase
        .from("otp_codes")
        .update({ verified: true })
        .eq("id", otpRecord.id)
      
      return NextResponse.json({
        success: true,
        message: "OTP verified successfully",
      })
    } else {
      await supabase
        .from("otp_codes")
        .update({ attempts: otpRecord.attempts + 1 })
        .eq("id", otpRecord.id)
      
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
