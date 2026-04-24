"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { getCurrentUser, validatePassword } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import { Eye, EyeOff, Check, X, Loader2, Settings, Lock, Key } from "lucide-react"

export default function SettingsPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [user, setUser] = useState<{ id: string; username: string; email: string; role: string } | null>(null)
  
  // Admin Void Key state
  const [voidKey, setVoidKey] = useState("")
  const [newVoidKey, setNewVoidKey] = useState("")
  const [showVoidKey, setShowVoidKey] = useState(false)
  const [showNewVoidKey, setShowNewVoidKey] = useState(false)
  const [isLoadingVoidKey, setIsLoadingVoidKey] = useState(false)
  const [voidKeyError, setVoidKeyError] = useState("")
  const [voidKeySuccess, setVoidKeySuccess] = useState("")
  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    uppercase: false,
    number: false,
    special: false,
    noSequence: false,
  })

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.push("/")
      return
    }
    setUser(currentUser)
    
    // Fetch void key for admin users
    if (currentUser.role === "admin") {
      fetchVoidKey()
    }
  }, [router])

  const fetchVoidKey = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("admin_settings")
      .select("void_key")
      .eq("id", 1)
      .single()
    
    if (data && !error) {
      setVoidKey(data.void_key || "")
    }
  }

  const handleUpdateVoidKey = async (e: React.FormEvent) => {
    e.preventDefault()
    setVoidKeyError("")
    setVoidKeySuccess("")

    if (!newVoidKey || newVoidKey.length < 4) {
      setVoidKeyError("Void key must be at least 4 characters")
      return
    }

    setIsLoadingVoidKey(true)

    try {
      const supabase = createClient()
      
      // Upsert the void key
      const { error: updateError } = await supabase
        .from("admin_settings")
        .upsert({ 
          id: 1, 
          void_key: newVoidKey,
          updated_at: new Date().toISOString()
        })

      if (updateError) {
        setVoidKeyError("Failed to update void key")
        setIsLoadingVoidKey(false)
        return
      }

      setVoidKey(newVoidKey)
      setNewVoidKey("")
      setVoidKeySuccess("Void key updated successfully!")
    } catch (err) {
      console.error("Void key update error:", err)
      setVoidKeyError("An error occurred. Please try again.")
    } finally {
      setIsLoadingVoidKey(false)
    }
  }

  const handleNewPasswordChange = (value: string) => {
    setNewPassword(value)
    setPasswordValidation({
      length: value.length >= 8 && value.length <= 30,
      uppercase: /[a-z]/.test(value) && /[A-Z]/.test(value),
      number: /\d/.test(value),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value),
      noSequence: !["abc", "123", "qwerty", "password"].some((seq) =>
        value.toLowerCase().includes(seq)
      ),
    })
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!user) return

    // Validate new password
    const validation = validatePassword(newPassword)
    if (!validation.valid) {
      setError(validation.errors[0])
      return
    }

    // Check passwords match
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match")
      return
    }

    // Check new password is different from current
    if (currentPassword === newPassword) {
      setError("New password must be different from current password")
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()

      // Verify current password
      const { data: userData, error: fetchError } = await supabase
        .from("users")
        .select("password_hash")
        .eq("id", user.id)
        .single()

      if (fetchError || !userData) {
        setError("Failed to verify current password")
        setIsLoading(false)
        return
      }

      if (userData.password_hash !== currentPassword) {
        setError("Current password is incorrect")
        setIsLoading(false)
        return
      }

      // Update password
      const { error: updateError } = await supabase
        .from("users")
        .update({ password_hash: newPassword, updated_at: new Date().toISOString() })
        .eq("id", user.id)

      if (updateError) {
        setError("Failed to update password")
        setIsLoading(false)
        return
      }

      setSuccess("Password changed successfully!")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordValidation({
        length: false,
        uppercase: false,
        number: false,
        special: false,
        noSequence: false,
      })
    } catch (err) {
      console.error("Password change error:", err)
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const ValidationItem = ({ valid, text }: { valid: boolean; text: string }) => (
    <div className="flex items-center gap-2">
      {valid ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <X className="h-4 w-4 text-red-500" />
      )}
      <span className={valid ? "text-green-600" : "text-red-500"}>{text}</span>
    </div>
  )

  if (!user) return null

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 pt-20 lg:pt-8 lg:p-8">
        <div className="max-w-2xl mx-auto lg:mx-0">
          <div className="flex items-center gap-3 mb-6 lg:mb-8">
            <Settings className="h-6 w-6 lg:h-8 lg:w-8 text-[#bb3e00]" />
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Settings</h1>
          </div>

          {/* User Info Card */}
          <div className="bg-white rounded-xl p-4 lg:p-6 shadow-sm border border-border mb-6 lg:mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">Account Information</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Username</span>
                <span className="font-medium">{user.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium capitalize px-3 py-1 bg-[#fff7e9] rounded-full text-sm">
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="bg-white rounded-xl p-4 lg:p-6 shadow-sm border border-border">
            <div className="flex items-center gap-2 mb-4 lg:mb-6">
              <Lock className="h-5 w-5 text-[#bb3e00]" />
              <h2 className="text-base lg:text-lg font-semibold text-foreground">Change Password</h2>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-5">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    onPaste={(e) => e.preventDefault()}
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    placeholder="Enter current password"
                    className="w-full px-4 py-3 rounded-lg bg-[#fff7e9] border-0 focus:ring-2 focus:ring-[#bb3e00] outline-none pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => handleNewPasswordChange(e.target.value)}
                    onPaste={(e) => e.preventDefault()}
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    placeholder="Enter new password"
                    className="w-full px-4 py-3 rounded-lg bg-[#fff7e9] border-0 focus:ring-2 focus:ring-[#bb3e00] outline-none pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                {/* Password Requirements */}
                {newPassword && (
                  <div className="mt-3 p-3 bg-muted rounded-lg text-sm space-y-1">
                    <p className="font-medium text-foreground mb-2">Password must:</p>
                    <ValidationItem valid={passwordValidation.length} text="Contain 8 to 30 characters" />
                    <ValidationItem valid={passwordValidation.uppercase} text="Contain both lower and uppercase letters" />
                    <ValidationItem valid={passwordValidation.number} text="Contain a number" />
                    <ValidationItem valid={passwordValidation.special} text="Contain a special character (!@#$%...)" />
                    <ValidationItem valid={passwordValidation.noSequence} text="Not contain sequences like 'abc', '123', 'qwerty'" />
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onPaste={(e) => e.preventDefault()}
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-3 rounded-lg bg-[#fff7e9] border-0 focus:ring-2 focus:ring-[#bb3e00] outline-none pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-red-500 text-sm mt-2">Passwords do not match</p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
                  {success}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                className="w-full py-3 bg-[#bb3e00] hover:bg-[#8f2f00] disabled:bg-muted disabled:text-muted-foreground text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Changing Password...
                  </>
                ) : (
                  "Change Password"
                )}
              </button>
            </form>
          </div>

          {/* Admin Void Key Card - Only for Admin */}
          {user.role === "admin" && (
            <div className="bg-white rounded-xl p-4 lg:p-6 shadow-sm border border-border mt-6 lg:mt-8">
              <div className="flex items-center gap-2 mb-4 lg:mb-6">
                <Key className="h-5 w-5 text-[#bb3e00]" />
                <h2 className="text-base lg:text-lg font-semibold text-foreground">Admin Void Key</h2>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                The void key is used to authorize voiding transactions in the POS system.
              </p>

              {/* Current Void Key */}
              <div className="mb-6 p-4 bg-[#fff7e9] rounded-lg">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Current Void Key
                </label>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg tracking-widest">
                    {showVoidKey ? (voidKey || "Not set") : (voidKey ? "****" : "Not set")}
                  </span>
                  {voidKey && (
                    <button
                      type="button"
                      onClick={() => setShowVoidKey(!showVoidKey)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {showVoidKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  )}
                </div>
              </div>

              <form onSubmit={handleUpdateVoidKey} className="space-y-5">
                {/* New Void Key */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    New Void Key
                  </label>
                  <div className="relative">
                    <input
                      type={showNewVoidKey ? "text" : "password"}
                      value={newVoidKey}
                      onChange={(e) => setNewVoidKey(e.target.value)}
                      onPaste={(e) => e.preventDefault()}
                      onCopy={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                      placeholder="Enter new void key (min 4 characters)"
                      className="w-full px-4 py-3 rounded-lg bg-[#fff7e9] border-0 focus:ring-2 focus:ring-[#bb3e00] outline-none pr-12 font-mono tracking-widest"
                      minLength={4}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewVoidKey(!showNewVoidKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewVoidKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {voidKeyError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {voidKeyError}
                  </div>
                )}

                {/* Success Message */}
                {voidKeySuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
                    {voidKeySuccess}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoadingVoidKey || !newVoidKey || newVoidKey.length < 4}
                  className="w-full py-3 bg-[#bb3e00] hover:bg-[#8f2f00] disabled:bg-muted disabled:text-muted-foreground text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isLoadingVoidKey ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Updating Void Key...
                    </>
                  ) : (
                    "Update Void Key"
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

