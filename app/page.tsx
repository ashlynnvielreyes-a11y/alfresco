"use client"

import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { persistAuthSession } from "@/lib/store"
import { Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const supabase = createClient()

      let { data: user, error: queryError } = await supabase
        .from("users")
        .select("id, username, email, password_hash, role")
        .eq("username", username.toLowerCase())
        .single()

      if (!user) {
        const { data: userByEmail, error: emailError } = await supabase
          .from("users")
          .select("id, username, email, password_hash, role")
          .eq("email", username.toLowerCase())
          .single()

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

      persistAuthSession(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role || "cashier",
        },
        rememberMe
      )

      router.push("/dashboard")
    } catch (err) {
      console.error("Login error:", err)
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
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

          {error && <p className="text-center text-sm font-medium text-[#4a342a]">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-gradient-to-r from-[#4a342a] to-[#b2967d] py-4 font-semibold text-[#f5f1ea] shadow-[0_16px_28px_rgba(187,62,0,0.18)] transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Logging in..." : "LOGIN"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <a href="/register" className="font-medium text-[#4a342a] hover:underline">
              Register here
            </a>
          </p>
        </form>
      </div>
    </main>
  )
}


