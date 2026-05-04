import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import * as nodemailer from "nodemailer"
import { Resend } from "resend"

export const runtime = "nodejs"

type EmailSenderConfig =
  | {
      provider: "resend"
      sender: string
      resend: Resend
    }
  | {
      provider: "smtp"
      sender: string
      transporter: nodemailer.Transporter
    }

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

function getEmailSenderConfig(): EmailSenderConfig {
  const resendApiKey = process.env.RESEND_API_KEY
  const resendFrom = process.env.OTP_EMAIL_FROM || process.env.RESEND_FROM_EMAIL

  if (resendApiKey && resendFrom) {
    return {
      provider: "resend",
      sender: resendFrom,
      resend: new Resend(resendApiKey),
    }
  }

  const user = process.env.OTP_EMAIL_USER || process.env.SMTP_USER
  const pass = process.env.OTP_EMAIL_PASS || process.env.SMTP_PASS
  const service = process.env.OTP_EMAIL_SERVICE || process.env.SMTP_SERVICE || "gmail"
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
  const secure = process.env.SMTP_SECURE === "true"
  const sender = process.env.OTP_EMAIL_FROM || process.env.SMTP_FROM || user

  if (!sender) {
    throw new Error("OTP email sender is not configured")
  }

  if (host && port && user && pass) {
    return {
      provider: "smtp",
      sender,
      transporter: nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      }),
    } satisfies EmailSenderConfig
  }

  if (user && pass) {
    return {
      provider: "smtp",
      sender,
      transporter: nodemailer.createTransport({
        service,
        auth: {
          user,
          pass,
        },
      }),
    } satisfies EmailSenderConfig
  }

  throw new Error(
    "OTP email is not configured. Set RESEND_API_KEY and OTP_EMAIL_FROM, or SMTP/OTP_EMAIL credentials."
  )
}

async function sendOtpEmail(config: EmailSenderConfig, email: string, otpCode: string) {
  const subject = "Your Al Fresco Cafe Verification Code"
  const html = `
    <div style="font-family: Arial, sans-serif; color: #4a342a;">
      <h2>Verify Your Registration</h2>
      <p>Your one-time verification code is:</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 16px 0;">${otpCode}</div>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request this code, you can ignore this email.</p>
    </div>
  `

  if (config.provider === "resend") {
    const { error } = await config.resend.emails.send({
      from: config.sender,
      to: email,
      subject,
      html,
    })

    if (error) {
      throw new Error(error.message || "Failed to send email with Resend")
    }

    return
  }

  await config.transporter.verify()

  await config.transporter.sendMail({
    from: `"Al Fresco Cafe" <${config.sender}>`,
    to: email,
    subject,
    html,
  })
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)

    if (!isValidEmail) {
      return NextResponse.json({ success: false, error: "Please enter a valid email address" }, { status: 400 })
    }

    const emailConfig = getEmailSenderConfig()
    const supabase = createAdminClient()
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null
    const userAgent = request.headers.get("user-agent")

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { count, error: rateLimitError } = await supabase
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("email", normalizedEmail)
      .gte("created_at", oneHourAgo)

    if (rateLimitError) {
      return NextResponse.json({ success: false, error: "Failed to validate OTP request limit" }, { status: 500 })
    }

    if ((count ?? 0) >= 5) {
      return NextResponse.json(
        { success: false, error: "Too many OTP requests. Please try again later." },
        { status: 429 }
      )
    }

    let invalidateError: { message?: string } | null = null

    const invalidateCurrentOtp = await supabase
      .from("otp_codes")
      .update({ is_used: true })
      .eq("email", normalizedEmail)
      .eq("is_used", false)

    if (invalidateCurrentOtp.error && isMissingColumnError(invalidateCurrentOtp.error, "is_used", "otp_codes")) {
      const legacyInvalidate = await supabase
        .from("otp_codes")
        .delete()
        .eq("email", normalizedEmail)

      invalidateError = legacyInvalidate.error
    } else {
      invalidateError = invalidateCurrentOtp.error
    }

    if (invalidateError) {
      return NextResponse.json({ success: false, error: "Failed to reset existing OTP code" }, { status: 500 })
    }

    let insertError: { message?: string } | null = null

    const insertWithCurrentSchema = await supabase.from("otp_codes").insert({
      email: normalizedEmail,
      otp_code: otpCode,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      attempts: 0,
      max_attempts: 3,
      is_used: false,
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    if (
      insertWithCurrentSchema.error &&
      (
        isMissingColumnError(insertWithCurrentSchema.error, "max_attempts", "otp_codes") ||
        isMissingColumnError(insertWithCurrentSchema.error, "is_used", "otp_codes") ||
        isMissingColumnError(insertWithCurrentSchema.error, "ip_address", "otp_codes") ||
        isMissingColumnError(insertWithCurrentSchema.error, "user_agent", "otp_codes")
      )
    ) {
      const legacyInsert = await supabase.from("otp_codes").insert({
        email: normalizedEmail,
        otp_code: otpCode,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        verified: false,
        attempts: 0,
      })

      insertError = legacyInsert.error
    } else {
      insertError = insertWithCurrentSchema.error
    }

    if (insertError) {
      return NextResponse.json({ success: false, error: "Failed to store OTP code" }, { status: 500 })
    }

    await sendOtpEmail(emailConfig, normalizedEmail, otpCode)

    return NextResponse.json({ success: true, message: "OTP sent successfully" })
  } catch (error: any) {
    console.error("OTP send error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send verification code" },
      { status: 500 }
    )
  }
}
