import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend("re_NDUv5zPF_LQNevXkCG8REpsgrzjWVwGu4")

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      )
    }

    // Free Resend tier - only verified email can receive emails
    const VERIFIED_EMAIL = "baleanannenicole@gmail.com"
    const recipientEmail = VERIFIED_EMAIL // All OTPs sent to verified email for free tier

    const supabase = await createClient()

    // Generate OTP directly instead of using RPC
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    
    // Delete any existing OTPs for this email
    await supabase
      .from("otp_codes")
      .delete()
      .eq("email", email.toLowerCase())
    
    // Insert new OTP
    const { error: insertError } = await supabase
      .from("otp_codes")
      .insert({
        email: email.toLowerCase(),
        otp_code: otpCode,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        verified: false,
        attempts: 0,
      })

    if (insertError) {
      console.error("[v0] OTP insert error:", insertError)
      return NextResponse.json(
        { success: false, error: insertError.message || "Failed to create OTP" },
        { status: 500 }
      )
    }

    console.log("[v0] OTP inserted successfully, code:", otpCode)

    const otp = otpCode

    // Send email with OTP using Resend
    console.log("[v0] Sending email to:", recipientEmail, "for account:", email)
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Al Fresco Cafe <onboarding@resend.dev>",
      to: recipientEmail,
      subject: "Your Al Fresco Cafe Verification Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f1ea; margin: 0; padding: 20px;">
          <div style="max-width: 500px; margin: 0 auto; background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #4a342a; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Al Fresco Cafe</h1>
            </div>
            <div style="padding: 40px;">
              <h2 style="color: #4a342a; margin-bottom: 20px; text-align: center;">Email Verification</h2>
              <p style="color: #7d5a44; font-size: 16px; line-height: 1.5; margin-bottom: 10px; text-align: center;">
                <strong>Account:</strong> ${email}
              </p>
              <p style="color: #7d5a44; font-size: 16px; line-height: 1.5; margin-bottom: 30px; text-align: center;">
                Use the following code to verify your email address. This code will expire in 10 minutes.
              </p>
              <div style="background-color: #f5f1ea; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4a342a;">${otp}</span>
              </div>
              <p style="color: #b2967d; font-size: 14px; text-align: center;">
                If you did not request this code, please ignore this email.
              </p>
            </div>
            <div style="background-color: #f5f1ea; padding: 20px; text-align: center; border-top: 1px solid #d7c9b8;">
              <p style="color: #b2967d; font-size: 12px; margin: 0;">
                &copy; ${new Date().getFullYear()} Al Fresco Cafe. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    })

    console.log("[v0] Resend response - data:", emailData, "error:", emailError)

    if (emailError) {
      console.error("[v0] Email sending error:", JSON.stringify(emailError))
      return NextResponse.json(
        { success: false, error: emailError.message || "Failed to send verification email" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email",
    })
  } catch (error) {
    console.error("OTP send error:", error)
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

