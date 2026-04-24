"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { validatePassword, validateEmail } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import { Check, X, Loader2, Mail, Eye, EyeOff } from "lucide-react"

export default function RegisterPage() {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])
  const [emailError, setEmailError] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const router = useRouter()

  // OTP states
  const [step, setStep] = useState<"form" | "otp">("form")
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [otpError, setOtpError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendTimer])

  const handleEmailChange = (value: string) => {
    setEmail(value)
    if (value) {
      setEmailError(validateEmail(value) ? "" : "Invalid email address")
    } else {
      setEmailError("")
    }
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    if (value) {
      const validation = validatePassword(value)
      setPasswordErrors(validation.errors)
    } else {
      setPasswordErrors([])
    }
  }

  const handleSendOtp = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (data.success) {
        setStep("otp")
        setResendTimer(60) // 60 second cooldown
      } else {
        setError(data.error || "Failed to send verification code")
      }
    } catch {
      setError("Failed to send verification code. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!username.trim()) {
      setError("Username is required")
      return
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    const validation = validatePassword(password)
    if (!validation.valid) {
      setError("Password does not meet requirements")
      return
    }

    if (!agreedToTerms) {
      setError("You must agree to the Terms and Conditions")
      return
    }

    // Send OTP
    await handleSendOtp()
  }

  const handleOtpChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setOtpError("")

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerifyOtp = async () => {
    const otpCode = otp.join("")

    if (otpCode.length !== 6) {
      setOtpError("Please enter the complete 6-digit code")
      return
    }

    setIsLoading(true)
    setOtpError("")

    try {
      const response = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpCode }),
      })

      const data = await response.json()

      if (data.success) {
        // OTP verified, now register the user in database
        const supabase = createClient()
        
        // Check if username or email already exists
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .or(`username.eq.${username},email.eq.${email}`)
          .single()

        if (existingUser) {
          setOtpError("Username or email already exists")
          setIsLoading(false)
          return
        }

        // Insert new user as CASHIER
        const { data: newUser, error: insertError } = await supabase
          .from("users")
          .insert({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password_hash: password,
            role: "cashier", // Always register as cashier
          })
          .select("id, username, email, role")
          .single()

        if (insertError || !newUser) {
          setOtpError(insertError?.message || "Registration failed")
          setIsLoading(false)
          return
        }

        // Save user data to localStorage and redirect
        localStorage.setItem("alfresco_auth", "true")
        localStorage.setItem("currentUserData", JSON.stringify({
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role
        }))

        router.push("/dashboard")
      } else {
        setOtpError(data.error || "Invalid verification code")
      }
    } catch {
      setOtpError("Verification failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendTimer > 0) return
    await handleSendOtp()
  }

  const checkRequirement = (requirement: string): boolean => {
    switch (requirement) {
      case "length":
        return password.length >= 8 && password.length <= 30
      case "case":
        return /[a-z]/.test(password) && /[A-Z]/.test(password)
      case "number":
        return /\d/.test(password)
      case "special":
        return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
      case "sequence":
        const forbiddenSequences = ["abc", "bcd", "cde", "def", "efg", "fgh", "ghi", "hij", "ijk", "jkl", "klm", "lmn", "mno", "nop", "opq", "pqr", "qrs", "rst", "stu", "tuv", "uvw", "vwx", "wxy", "xyz", "123", "234", "345", "456", "567", "678", "789", "0123", "1234", "2345", "3456", "4567", "5678", "6789", "11", "22", "33", "44", "55", "66", "77", "88", "99", "00", "qwerty", "asdf", "zxcv"]
        return !forbiddenSequences.some((seq) => password.toLowerCase().includes(seq))
      default:
        return false
    }
  }

  const requirements = [
    { key: "length", label: "Contain 8 to 30 characters" },
    { key: "case", label: "Contain both lower and uppercase letters" },
    { key: "number", label: "Contain a number" },
    { key: "special", label: "Contain a special character (!@#$%...)" },
    { key: "sequence", label: "Not contain sequences like 'abc', '123', 'qwerty'" },
  ]

  // OTP Verification Step
  if (step === "otp") {
    return (
      <main className="min-h-screen bg-[#f9f5f7] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md border border-[#F1646E]/30">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#f9f5f7] rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-[#A61F30]" />
            </div>
            <h1 className="text-2xl font-bold text-[#A61F30] mb-2">Verify Your Email</h1>
            <p className="text-muted-foreground text-sm">
              We&apos;ve sent a 6-digit verification code to
            </p>
            <p className="text-foreground font-medium">{email}</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-4 text-center">
                Enter verification code
              </label>
              <div className="flex justify-center gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { otpInputRefs.current[index] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={(e) => e.preventDefault()}
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    className="w-12 h-14 text-center text-xl font-bold rounded-lg bg-[#f9f5f7] border-2 border-[#F1646E]/50 focus:border-[#A61F30] focus:ring-0 outline-none transition-colors"
                  />
                ))}
              </div>
            </div>

            {otpError && (
              <p className="text-destructive text-sm text-center bg-destructive/10 p-3 rounded-lg">
                {otpError}
              </p>
            )}

            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={isLoading || otp.join("").length !== 6}
              className="w-full py-4 bg-[#A61F30] hover:bg-[#8B1826] disabled:bg-[#F1646E]/50 disabled:text-[#8B1826] text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                "VERIFY & REGISTER"
              )}
            </button>

            <div className="text-center">
              <p className="text-muted-foreground text-sm mb-2">
                Didn&apos;t receive the code?
              </p>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendTimer > 0 || isLoading}
                className="text-[#A61F30] hover:underline font-medium disabled:text-[#8B1826] disabled:no-underline"
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setStep("form")
                setOtp(["", "", "", "", "", ""])
                setOtpError("")
              }}
              className="w-full py-3 text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              Back to Registration
            </button>
          </div>
        </div>
      </main>
    )
  }

  // Registration Form Step
  return (
    <main className="min-h-screen bg-[#f9f5f7] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md border border-[#F1646E]/30">
        <h1 className="text-4xl font-bold text-[#A61F30] text-center mb-2">
          Al Fresco
        </h1>
        <p className="text-[#8B1826] text-center mb-8">Create a new account</p>

        <form onSubmit={handleContinue} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#8B1826] mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full px-4 py-3 rounded-lg bg-[#f9f5f7] border border-[#F1646E]/50 focus:ring-2 focus:ring-[#A61F30] focus:border-[#A61F30] outline-none text-foreground placeholder:text-[#8B1826]/60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#8B1826] mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="Enter email address"
              className="w-full px-4 py-3 rounded-lg bg-[#f9f5f7] border border-[#F1646E]/50 focus:ring-2 focus:ring-[#A61F30] focus:border-[#A61F30] outline-none text-foreground placeholder:text-[#8B1826]/60"
            />
            {emailError && <p className="text-[#A61F30] text-xs mt-2">{emailError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#8B1826] mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onPaste={(e) => e.preventDefault()}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                placeholder="Enter password"
                className="w-full px-4 py-3 pr-12 rounded-lg bg-[#f9f5f7] border border-[#F1646E]/50 focus:ring-2 focus:ring-[#A61F30] focus:border-[#A61F30] outline-none text-foreground placeholder:text-[#8B1826]/60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B1826]/70 hover:text-[#A61F30]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {password && (
              <div className="mt-4 bg-white p-4 rounded-lg border border-[#F1646E]/50">
                <p className="text-sm font-bold text-foreground mb-3">Password must:</p>
                <div className="space-y-2">
                  {requirements.map((req) => {
                    const isMet = checkRequirement(req.key)
                    return (
                      <div key={req.key} className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          {isMet ? (
                            <div className="flex items-center justify-center w-5 h-5 bg-green-100 rounded-full">
                              <Check className="h-3 w-3 text-green-600" />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center w-5 h-5 bg-red-100 rounded-full">
                              <X className="h-3 w-3 text-red-600" />
                            </div>
                          )}
                        </div>
                        <span className={`text-sm font-medium ${isMet ? "text-green-600" : "text-red-600"}`}>
                          {req.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#8B1826] mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onPaste={(e) => e.preventDefault()}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                placeholder="Confirm password"
                className="w-full px-4 py-3 pr-12 rounded-lg bg-[#f9f5f7] border border-[#F1646E]/50 focus:ring-2 focus:ring-[#A61F30] focus:border-[#A61F30] outline-none text-foreground placeholder:text-[#8B1826]/60"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B1826]/70 hover:text-[#A61F30]"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-[#A61F30] text-xs mt-2">Passwords do not match</p>
            )}
          </div>

          {/* Terms and Conditions */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-[#F1646E] text-[#A61F30] focus:ring-[#A61F30]"
            />
            <label htmlFor="terms" className="text-sm text-[#8B1826]">
              I agree to the{" "}
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="text-[#A61F30] hover:underline font-medium"
              >
                Terms and Conditions
              </button>
            </label>
          </div>

          {error && (
            <p className="text-destructive text-sm text-center bg-destructive/10 p-3 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !username || !email || emailError !== "" || password !== confirmPassword || passwordErrors.length > 0 || !agreedToTerms}
            className="w-full py-4 bg-[#A61F30] hover:bg-[#8B1826] disabled:bg-[#F1646E]/50 disabled:text-[#8B1826] text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending Code...
              </>
            ) : (
              "CONTINUE"
            )}
          </button>

          <p className="text-center text-[#8B1826] text-sm">
            Already have an account?{" "}
            <a href="/" className="text-[#A61F30] hover:underline font-medium">
              Login here
            </a>
          </p>
        </form>
      </div>

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col border border-[#F1646E]/30">
            <div className="p-6 border-b border-[#F1646E]/30">
              <h2 className="text-2xl font-bold text-[#A61F30]">Terms and Conditions</h2>
              <p className="text-sm text-[#8B1826] mt-1">Al Fresco Cafe POS System</p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-sm text-foreground">
              <section>
                <h3 className="font-bold text-base mb-2 text-[#A61F30]">1. Acceptance of Terms</h3>
                <p className="text-[#8B1826]">
                  By creating an account and using the Al Fresco Cafe POS System, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not register or use the system.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-base mb-2 text-[#A61F30]">2. User Account</h3>
                <p className="text-[#8B1826]">
                  You are responsible for maintaining the confidentiality of your account credentials. You agree to notify the administrator immediately of any unauthorized use of your account. All activities performed under your account are your responsibility.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-base mb-2 text-[#A61F30]">3. Authorized Use</h3>
                <p className="text-[#8B1826]">
                  This system is intended solely for authorized employees of Al Fresco Cafe for business operations including but not limited to: processing customer orders, managing inventory, and handling transactions. Any unauthorized use or access is strictly prohibited.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-base mb-2 text-[#A61F30]">4. Data Privacy</h3>
                <p className="text-[#8B1826]">
                  We collect and store user information necessary for system operation. Your personal data including username, email, and activity logs will be stored securely. We do not share your personal information with third parties except as required by law.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-base mb-2 text-[#A61F30]">5. Employee Responsibilities</h3>
                <p className="text-[#8B1826]">
                  As a cashier or employee, you agree to: process transactions accurately, handle cash responsibly, report any discrepancies to management, maintain customer confidentiality, and follow all company policies regarding the use of this system.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-base mb-2 text-[#A61F30]">6. Prohibited Activities</h3>
                <p className="text-[#8B1826]">
                  You agree not to: share your login credentials, manipulate transaction records, void transactions without proper authorization, access areas of the system beyond your role permissions, or use the system for any illegal activities.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-base mb-2 text-[#A61F30]">7. System Availability</h3>
                <p className="text-[#8B1826]">
                  While we strive to maintain system availability, we do not guarantee uninterrupted access. Scheduled maintenance or unforeseen circumstances may result in temporary unavailability.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-base mb-2 text-[#A61F30]">8. Limitation of Liability</h3>
                <p className="text-[#8B1826]">
                  Al Fresco Cafe shall not be liable for any indirect, incidental, or consequential damages arising from the use of this system. Users are responsible for verifying transaction accuracy before completion.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-base mb-2 text-[#A61F30]">9. Termination</h3>
                <p className="text-[#8B1826]">
                  Your access to this system may be terminated at any time by management without prior notice, especially in cases of policy violations, employment termination, or security concerns.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-base mb-2 text-[#A61F30]">10. Changes to Terms</h3>
                <p className="text-[#8B1826]">
                  These terms may be updated from time to time. Continued use of the system after changes constitutes acceptance of the new terms.
                </p>
              </section>
            </div>

            <div className="p-6 border-t border-[#F1646E]/30 flex gap-3">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="flex-1 py-3 bg-[#f9f5f7] hover:bg-[#F1646E]/30 text-foreground font-semibold rounded-lg transition-colors border border-[#F1646E]/50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgreedToTerms(true)
                  setShowTermsModal(false)
                }}
                className="flex-1 py-3 bg-[#A61F30] hover:bg-[#8B1826] text-white font-semibold rounded-lg transition-colors"
              >
                I Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
