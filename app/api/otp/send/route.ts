import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import * as nodemailer from "nodemailer"

function getOtpTransport() {
  const user = process.env.OTP_EMAIL_USER || process.env.SMTP_USER
  const pass = process.env.OTP_EMAIL_PASS || process.env.SMTP_PASS
  const service = process.env.OTP_EMAIL_SERVICE || process.env.SMTP_SERVICE || "gmail"

  if (!user || !pass) {
    throw new Error("OTP email credentials are not configured")
  }

  return {
    sender: user,
    transporter: nodemailer.createTransport({
      service,
      auth: {
        user,
        pass,
      },
    }),
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const { sender, transporter } = getOtpTransport()
    const supabase = await createClient()
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

    const { error: deleteError } = await supabase.from("otp_codes").delete().eq("email", normalizedEmail)
    if (deleteError) {
      return NextResponse.json({ success: false, error: "Failed to reset existing OTP code" }, { status: 500 })
    }

    const { error: insertError } = await supabase.from("otp_codes").insert({
      email: normalizedEmail,
      otp_code: otpCode,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      verified: false,
      attempts: 0,
    })

    if (insertError) {
      return NextResponse.json({ success: false, error: "Failed to store OTP code" }, { status: 500 })
    }

    await transporter.verify()

    await transporter.sendMail({
      from: `"Al Fresco Cafe" <${sender}>`,
      to: normalizedEmail,
      subject: "Your Al Fresco Cafe Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; color: #4a342a;">
          <h2>Verify Your Registration</h2>
          <p>Your one-time verification code is:</p>
          <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">${otpCode}</div>
          <p>This code expires in 10 minutes.</p>
          <p>If you did not request this code, you can ignore this email.</p>
        </div>
      `,
    })

    return NextResponse.json({ success: true, message: "OTP sent successfully" })
  } catch (error: any) {
    console.error("OTP send error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send verification code" },
      { status: 500 }
    )
  }
}
