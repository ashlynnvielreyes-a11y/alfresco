"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
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

      // Query the users table to find the user by username first
      let { data: user, error: queryError } = await supabase
        .from("users")
        .select("id, username, email, password_hash, role")
        .eq("username", username.toLowerCase())
        .single()

      // If not found by username, try email
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

      // Check password (plain text comparison for simplicity)
      if (user.password_hash !== password) {
        setError("Invalid username or password")
        setIsLoading(false)
        return
      }

      // Save user data to localStorage
      localStorage.setItem("alfresco_auth", "true")
      localStorage.setItem("currentUserData", JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || "cashier"
      }))

      router.push("/dashboard")
    } catch (err) {
      console.error("Login error:", err)
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f9f5f7] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md border border-[#F1646E]/30">
        <h1 className="text-4xl font-bold text-[#A61F30] text-center mb-2">
          Al Fresco
        </h1>
        <p className="text-[#666666] text-center mb-8">Please login to your account</p>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full px-4 py-3 rounded-lg bg-[#f5f5f5] border border-[#F1646E]/50 focus:ring-2 focus:ring-[#A61F30] focus:border-[#A61F30] outline-none text-foreground placeholder:text-[#999999]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onPaste={(e) => e.preventDefault()}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                placeholder="password"
                className="w-full px-4 py-3 pr-12 rounded-lg bg-[#f5f5f5] border border-[#F1646E]/50 focus:ring-2 focus:ring-[#A61F30] focus:border-[#A61F30] outline-none text-foreground placeholder:text-[#999999]"
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
          </div>

          {error && (
            <p className="text-[#A61F30] text-sm text-center font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-[#A61F30] hover:bg-[#8B1826] disabled:bg-[#F1646E]/50 disabled:text-white text-white font-semibold rounded-lg transition-colors"
          >
            {isLoading ? "Logging in..." : "LOGIN"}
          </button>

          <p className="text-center text-[#666666] text-sm">
            Don&apos;t have an account?{" "}
            <a href="/register" className="text-[#A61F30] hover:underline font-medium">
              Register here
            </a>
          </p>
        </form>
      </div>
    </main>
  )
}
