import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return "Unknown error"
  }
}

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  const senderName = process.env.BREVO_SENDER_NAME || "Al Fresco Cafe"

  if (!apiKey || !senderEmail) {
    throw new Error("Brevo is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL.")
  }

  return {
    apiKey,
    senderEmail,
    senderName,
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000} seconds`))
    }, ms)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function sendOtpEmail(email: string, otpCode: string) {
  const { apiKey, senderEmail, senderName } = getBrevoConfig()

  const response = await withTimeout(
    fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [{ email }],
        subject: "Your OTP Code",
        htmlContent: `
          <h2>Your OTP Code</h2>
          <h1>${otpCode}</h1>
          <p>This code is valid for 5 minutes.</p>
        `,
      }),
    }),
    30000,
    "Brevo API send"
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Brevo API send failed: ${response.status} ${errorText}`)
  }
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

    const supabase = createAdminClient()
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null
    const userAgent = request.headers.get("user-agent")
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { count, error: rateLimitError } = await withTimeout(
      supabase
        .from("otp_codes")
        .select("id", { count: "exact", head: true })
        .eq("email", normalizedEmail)
        .gte("created_at", oneHourAgo),
      15000,
      "OTP rate-limit check"
    )

    if (rateLimitError) {
      return NextResponse.json({ success: false, error: "Failed to validate OTP request limit" }, { status: 500 })
    }

    if ((count ?? 0) >= 5) {
      return NextResponse.json(
        { success: false, error: "Too many OTP requests. Please try again later." },
        { status: 429 }
      )
    }

    const { error: resetError } = await withTimeout(
      supabase
        .from("otp_codes")
        .update({ is_used: true })
        .eq("email", normalizedEmail)
        .eq("is_used", false),
      15000,
      "OTP reset"
    )

    if (resetError) {
      return NextResponse.json({ success: false, error: "Failed to reset existing OTP code" }, { status: 500 })
    }

    const { error: insertError } = await withTimeout(
      supabase.from("otp_codes").insert({
        email: normalizedEmail,
        otp_code: otpCode,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        attempts: 0,
        max_attempts: 3,
        is_used: false,
        ip_address: ipAddress,
        user_agent: userAgent,
      }),
      15000,
      "OTP insert"
    )

    if (insertError) {
      return NextResponse.json({ success: false, error: "Failed to store OTP code" }, { status: 500 })
    }

    await sendOtpEmail(normalizedEmail, otpCode)

    return NextResponse.json({ success: true, message: "OTP sent successfully" })
  } catch (error) {
    console.error("OTP ERROR:", error)
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) || "Failed to send OTP" },
      { status: 500 }
    )
  }
}
