"use client"

import Image from "next/image"
import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { notifyPrivilegedLogin, shouldNotifyPrivilegedLogin } from "@/lib/browser-notifications"
import { getDefaultRouteForRole, persistAuthSession, validatePassword } from "@/lib/store"
import { toast } from "@/hooks/use-toast"
import { Eye, EyeOff, Loader2, Mail } from "lucide-react"

const REMEMBERED_USERNAME_KEY = "alfresco_remembered_username"
const REMEMBER_ME_PREFERENCE_KEY = "alfresco_remember_me"

function isUserRevoked(user: { is_active?: boolean | null; deactivated_at?: string | null }) {
  return user.is_active === false || Boolean(user.deactivated_at)
}

function LoginPageContent() {
  const searchParams = useSearchParams()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [resetStep, setResetStep] = useState<"email" | "verify" | "password">("email")
  const [resetEmail, setResetEmail] = useState("")
  const [resetOtp, setResetOtp] = useState(["", "", "", "", "", ""])
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false)
  const [resetError, setResetError] = useState("")
  const [resetSuccess, setResetSuccess] = useState("")
  const [isResetLoading, setIsResetLoading] = useState(false)
  const [sendAgainTimer, setSendAgainTimer] = useState(0)
  const resetOtpInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()

  useEffect(() => {
    if (typeof window === "undefined") return

    const storedRememberMe = localStorage.getItem(REMEMBER_ME_PREFERENCE_KEY)
    const rememberedUsername = localStorage.getItem(REMEMBERED_USERNAME_KEY)
    const shouldRemember = storedRememberMe !== "false"
    const registered = searchParams.get("registered") === "1"
    const registeredUsername = searchParams.get("username")

    setRememberMe(shouldRemember)
    if (registered) {
      setSuccessMessage("Registration successful. Please log in with your new account.")
      if (registeredUsername) {
        setUsername(registeredUsername)
      }
      return
    }

    if (shouldRemember && rememberedUsername) {
      setUsername(rememberedUsername)
    }
  }, [searchParams])

  useEffect(() => {
    if (sendAgainTimer <= 0) return
    const timer = window.setTimeout(() => setSendAgainTimer((current) => current - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [sendAgainTimer])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const supabase = createClient()

      const fetchUserBy = async (column: "username" | "email", value: string) => {
        let response = await supabase
          .from("users")
          .select("id, username, email, password_hash, role, is_active, deactivated_at")
          .eq(column, value)
          .single()

        if (response.error?.message?.toLowerCase().includes("is_active")) {
          response = await supabase
            .from("users")
            .select("id, username, email, password_hash, role, deactivated_at")
            .eq(column, value)
            .single()
        }

        return response
      }

      let { data: user, error: queryError } = await fetchUserBy("username", username.toLowerCase())

      if (!user) {
        const { data: userByEmail, error: emailError } = await fetchUserBy("email", username.toLowerCase())

        user = userByEmail
        queryError = emailError
      }

      if (queryError || !user) {
        setError("Invalid username or password")
        setIsLoading(false)
        return
      }

      if (user.password_hash !== password) {
        setError("Invalid username or password")
        setIsLoading(false)
        return
      }

      if (isUserRevoked(user)) {
        setError("This account has been deactivated. Please contact an administrator.")
        setIsLoading(false)
        return
      }

      persistAuthSession(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role || "cashier",
          isActive: !isUserRevoked(user),
        },
        rememberMe
      )

      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_PREFERENCE_KEY, "true")
        localStorage.setItem(REMEMBERED_USERNAME_KEY, user.email || user.username)
      } else {
        localStorage.setItem(REMEMBER_ME_PREFERENCE_KEY, "false")
        localStorage.removeItem(REMEMBERED_USERNAME_KEY)
      }

      const userRole = user.role === "admin" || user.role === "inventory_staff" || user.role === "cashier" || user.role === "kitchen"
        ? user.role
        : "cashier"

      if (shouldNotifyPrivilegedLogin(userRole)) {
        const normalizedRole = userRole === "admin" ? "Admin" : "Inventory Staff"
        toast({
          title: "Login successful",
          description: `${normalizedRole} login confirmed for ${user.username}.`,
        })
        await notifyPrivilegedLogin(user.username, userRole)
      }

      router.push(getDefaultRouteForRole(userRole))
    } catch (err) {
      console.error("Login error:", err)
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const resetForgotPasswordState = () => {
    setResetStep("email")
    setResetEmail("")
    setResetOtp(["", "", "", "", "", ""])
    setNewPassword("")
    setConfirmNewPassword("")
    setShowResetPassword(false)
    setShowResetConfirmPassword(false)
    setResetError("")
    setResetSuccess("")
    setSendAgainTimer(0)
    setIsResetLoading(false)
  }

  const handleForgotPasswordOtp = async () => {
    setIsResetLoading(true)
    setResetError("")
    setResetSuccess("")

    try {
      const response = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      })

      const data = await response.json()
      if (!data.success) {
        setResetError(data.error || "Failed to send verification code.")
        setIsResetLoading(false)
        return
      }

      setResetStep("verify")
      setResetSuccess("Verification code sent. Check your email.")
      setSendAgainTimer(60)
    } catch {
      setResetError("Failed to send verification code. Please try again.")
    } finally {
      setIsResetLoading(false)
    }
  }

  const handleResetOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return

    const nextOtp = [...resetOtp]
    nextOtp[index] = value
    setResetOtp(nextOtp)
    setResetError("")

    if (value && index < 5) {
      resetOtpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleResetOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !resetOtp[index] && index > 0) {
      resetOtpInputRefs.current[index - 1]?.focus()
    }
  }

  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) {
      setResetError("Email is required.")
      return
    }

    if (newPassword !== confirmNewPassword) {
      setResetError("Passwords do not match.")
      return
    }

    const validation = validatePassword(newPassword)
    if (!validation.valid) {
      setResetError(validation.errors[0] || "Password does not meet requirements.")
      return
    }

    setIsResetLoading(true)
    setResetError("")
    setResetSuccess("")

    try {
      const response = await fetch("/api/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail,
          password: newPassword,
        }),
      })

      const data = await response.json()
      if (!data.success) {
        setResetError(data.error || "Failed to reset password.")
        setIsResetLoading(false)
        return
      }

      setResetSuccess("Password reset successfully. You can log in now.")
      setPassword("")
      setForgotPasswordOpen(false)
      resetForgotPasswordState()
    } catch {
      setResetError("Failed to reset password. Please try again.")
    } finally {
      setIsResetLoading(false)
    }
  }

  const handleVerifyResetOtp = async () => {
    const otp = resetOtp.join("")

    if (!resetEmail.trim()) {
      setResetError("Email is required.")
      return
    }

    if (otp.length !== 6) {
      setResetError("Please enter the complete 6-digit code.")
      return
    }

    setIsResetLoading(true)
    setResetError("")
    setResetSuccess("")

    try {
      const response = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, otp }),
      })

      const data = await response.json()
      if (!data.success) {
        setResetError(data.error || "Failed to verify code.")
        setIsResetLoading(false)
        return
      }

      setResetStep("password")
      setResetSuccess("OTP verified. You can now set a new password.")
    } catch {
      setResetError("Failed to verify code. Please try again.")
    } finally {
      setIsResetLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-[#b2967d]/20 blur-3xl" />
        <div className="absolute right-10 top-16 h-64 w-64 rounded-full bg-[#7d5a44]/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-[#4a342a]/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-[30px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/55 p-8 shadow-[0_28px_70px_rgba(123,111,25,0.12),inset_0_1px_0_rgba(245,241,234,0.75)] backdrop-blur-xl lg:p-10">
        <div className="mb-8 text-center">
          <Image src="/alfresco-logo.png" alt="Al Fresco Cafe" width={320} height={160} className="mx-auto mb-4 h-auto w-full max-w-[280px] object-contain" priority />
          <p className="text-sm text-muted-foreground">Sign in to access the cafe system.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full rounded-2xl border border-[#f5f1ea]/60 bg-[#f5f1ea]/90 px-4 py-3 text-foreground outline-none transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onPaste={(e) => e.preventDefault()}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                placeholder="password"
                className="w-full rounded-2xl border border-[#f5f1ea]/60 bg-[#f5f1ea]/90 px-4 py-3 pr-12 text-foreground outline-none transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7d5a44]/70 hover:text-[#4a342a]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border border-[#4a342a]/30 text-[#4a342a] focus:ring-[#4a342a]"
            />
            <span>Remember Me</span>
          </label>

          <div className="text-right">
            <button
              type="button"
              onClick={() => {
                setForgotPasswordOpen(true)
                setResetEmail(username.includes("@") ? username : "")
                setResetError("")
                setResetSuccess("")
              }}
              className="text-sm font-medium text-[#4a342a] hover:underline"
            >
              Forgot password?
            </button>
          </div>

          {successMessage && <p className="text-center text-sm font-medium text-[#7d5a44]">{successMessage}</p>}
          {error && <p className="text-center text-sm font-medium text-[#4a342a]">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-gradient-to-r from-[#4a342a] to-[#b2967d] py-4 font-semibold text-[#f5f1ea] shadow-[0_16px_28px_rgba(187,62,0,0.18)] transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Logging in..." : "LOGIN"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Need a new account?{" "}
            Ask an administrator to create your account
          </p>
        </form>
      </div>

      <Dialog
        open={forgotPasswordOpen}
        onOpenChange={(open) => {
          setForgotPasswordOpen(open)
          if (!open) {
            resetForgotPasswordState()
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Forgot Password</DialogTitle>
            <DialogDescription>
              {resetStep === "email"
                ? "Enter your account email and we'll send a 6-digit verification code."
                : resetStep === "verify"
                  ? "Verify the 6-digit code sent to your email."
                  : "Choose your new password after successful OTP verification."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d5a44]/70" />
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full rounded-2xl border border-[#f5f1ea]/60 bg-[#f5f1ea]/90 py-3 pl-11 pr-4 text-foreground outline-none transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
                />
              </div>
            </div>

            {resetStep === "verify" ? (
              <>
                <div>
                  <label className="mb-3 block text-sm font-medium text-foreground">Verification Code</label>
                  <div className="flex justify-between gap-2">
                    {resetOtp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(element) => {
                          resetOtpInputRefs.current[index] = element
                        }}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleResetOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleResetOtpKeyDown(index, e)}
                        className="h-12 w-12 rounded-2xl border border-[#f5f1ea]/60 bg-[#f5f1ea]/90 text-center text-lg font-semibold text-foreground outline-none transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {resetStep === "password" ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">New Password</label>
                  <div className="relative">
                    <input
                      type={showResetPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-2xl border border-[#f5f1ea]/60 bg-[#f5f1ea]/90 px-4 py-3 pr-12 text-foreground outline-none transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7d5a44]/70 hover:text-[#4a342a]"
                    >
                      {showResetPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showResetConfirmPassword ? "text" : "password"}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full rounded-2xl border border-[#f5f1ea]/60 bg-[#f5f1ea]/90 px-4 py-3 pr-12 text-foreground outline-none transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetConfirmPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7d5a44]/70 hover:text-[#4a342a]"
                    >
                      {showResetConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {resetSuccess ? <p className="text-center text-sm font-medium text-[#7d5a44]">{resetSuccess}</p> : null}
            {resetError ? <p className="text-center text-sm font-medium text-[#4a342a]">{resetError}</p> : null}

            <button
              type="button"
              onClick={
                resetStep === "email"
                  ? handleForgotPasswordOtp
                  : resetStep === "verify"
                    ? handleVerifyResetOtp
                    : handlePasswordReset
              }
              disabled={isResetLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4a342a] to-[#b2967d] py-3.5 font-semibold text-[#f5f1ea] transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>
                {resetStep === "email"
                  ? "Send Verification Code"
                  : resetStep === "verify"
                    ? "Verify Code"
                    : "Reset Password"}
              </span>
            </button>

            {resetStep !== "email" ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setResetStep(resetStep === "password" ? "verify" : "email")
                    if (resetStep === "verify") {
                      setResetOtp(["", "", "", "", "", ""])
                    }
                    setResetError("")
                    setResetSuccess("")
                  }}
                  className="font-medium text-[#4a342a] hover:underline"
                >
                  Back
                </button>
                {resetStep === "verify" ? (
                  <button
                    type="button"
                    onClick={handleForgotPasswordOtp}
                    disabled={sendAgainTimer > 0 || isResetLoading}
                    className="font-medium text-[#4a342a] hover:underline disabled:cursor-not-allowed disabled:text-[#7d5a44]/70"
                  >
                    {sendAgainTimer > 0 ? `Send again in ${sendAgainTimer}s` : "Send code again"}
                  </button>
                ) : <span />}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f5f1ea]" />}>
      <LoginPageContent />
    </Suspense>
  )
}

