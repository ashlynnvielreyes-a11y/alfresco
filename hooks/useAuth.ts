import { useCallback, useEffect, useState } from "react"
import { isAuthenticated, login, register, logout, validatePassword, validateEmail } from "@/lib/store"
import { useLocalStorage } from "./useLocalStorage"

export function useAuth() {
  const [isAuth, setIsAuth] = useLocalStorage("isAuthenticated", false)
  const [currentUser, setCurrentUser] = useLocalStorage("currentUser", "")
  const [currentEmail, setCurrentEmail] = useLocalStorage("currentEmail", "")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check authentication on mount
    const authenticated = isAuthenticated()
    setIsAuth(authenticated)
    setLoading(false)
  }, [setIsAuth])

  const handleLogin = useCallback(
    (username: string, password: string) => {
      const success = login(username, password)
      if (success) {
        setIsAuth(true)
        setCurrentUser(username)
      }
      return success
    },
    [setIsAuth, setCurrentUser]
  )

  const handleRegister = useCallback(
    (username: string, email: string, password: string) => {
      const result = register(username, email, password)
      if (result.success) {
        setIsAuth(true)
        setCurrentUser(username)
        setCurrentEmail(email)
      }
      return result
    },
    [setIsAuth, setCurrentUser, setCurrentEmail]
  )

  const handleLogout = useCallback(() => {
    logout()
    setIsAuth(false)
    setCurrentUser("")
    setCurrentEmail("")
  }, [setIsAuth, setCurrentUser, setCurrentEmail])

  return {
    isAuthenticated: isAuth,
    currentUser,
    currentEmail,
    loading,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    validatePassword,
    validateEmail,
  }
}
