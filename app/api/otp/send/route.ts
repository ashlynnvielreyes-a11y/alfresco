import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Create transporter (Brevo SMTP)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Send email
    await transporter.sendMail({
      from: `"TG Alfresco Cafe" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your OTP Code",
      html: `
        <h2>Your OTP Code</h2>
        <h1>${otp}</h1>
        <p>This code is valid for 5 minutes.</p>
      `,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("OTP ERROR:", error);
    return Response.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}