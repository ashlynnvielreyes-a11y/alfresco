import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import * as nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    // 1. Dito natin ilalagay ang credentials. 
    // Gamitin muna natin ang hardcoded para 100% sure na hindi "Missing credentials".
    const userEmail = "baleanannenicole@gmail.com";
    const userPass = "ikinsbgybrxfsfkg"; 

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: userEmail,
        pass: userPass,
      },
    });

    const supabase = await createClient();
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Insert OTP sa database (keep your existing logic here)
    await supabase.from("otp_codes").delete().eq("email", email.toLowerCase());
    await supabase.from("otp_codes").insert({
      email: email.toLowerCase(),
      otp_code: otpCode,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      verified: false,
    });

    console.log("Attempting to send email to:", email);

    // 2. I-verify ang connection bago mag-send
    try {
      await transporter.verify();
      console.log("SMTP Connection verified!");
    } catch (verifyError) {
      console.error("SMTP Verify Error:", verifyError);
      return NextResponse.json({ success: false, error: "SMTP Connection failed" }, { status: 500 });
    }

    // 3. Send the email
    await transporter.sendMail({
      from: `"Al Fresco Cafe" <${userEmail}>`,
      to: email,
      subject: "Your Al Fresco Cafe Verification Code",
      html: `<h1>Your OTP: ${otpCode}</h1>`,
    });

    return NextResponse.json({ success: true, message: "OTP sent successfully" });

  } catch (error: any) {
    console.error("Full Error Details:", error);
    return NextResponse.json({ success: false, error: error.message || "Server error" }, { status: 500 });
  }
}
