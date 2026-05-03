"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { isAuthenticated, getUserRole, canAccessInventory, canAccessPos, canAccessSales, canManageUsers, validateCurrentSession, type UserRole } from "@/lib/store"
import { Loader2 } from "lucide-react"

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: UserRole
  requiredPermission?: "pos" | "inventory" | "sales" | "user_management"
}

export function AuthGuard({ children, requiredRole, requiredPermission }: AuthGuardProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Wait for component to mount before checking auth
    if (!mounted) return

    const checkAuth = async () => {
      const authenticated = isAuthenticated()

      if (!authenticated) {
        setIsAuthorized(false)
        setIsLoading(false)
        router.replace("/")
        return
      }

      const currentUser = await validateCurrentSession()
      if (!currentUser) {
        setIsAuthorized(false)
        setIsLoading(false)
        router.replace("/")
        return
      }

      const userRole = getUserRole()

      // If a specific role is required, check it
      if (requiredRole && requiredRole === "admin" && userRole !== "admin") {
        // Redirect cashiers trying to access admin pages
        setIsAuthorized(false)
        setIsLoading(false)
        router.replace("/dashboard")
        return
      }

      if (requiredPermission === "pos" && !canAccessPos(userRole)) {
        setIsAuthorized(false)
        setIsLoading(false)
        router.replace("/dashboard")
        return
      }

      if (requiredPermission === "inventory" && !canAccessInventory(userRole)) {
        setIsAuthorized(false)
        setIsLoading(false)
        router.replace("/dashboard")
        return
      }

      if (requiredPermission === "sales" && !canAccessSales(userRole)) {
        setIsAuthorized(false)
        setIsLoading(false)
        router.replace("/dashboard")
        return
      }

      if (requiredPermission === "user_management" && !canManageUsers(userRole)) {
        setIsAuthorized(false)
        setIsLoading(false)
        router.replace("/dashboard")
        return
      }

      setIsAuthorized(true)
      setIsLoading(false)
    }

    void checkAuth()

    const intervalId = window.setInterval(() => {
      void checkAuth()
    }, 30000)

    const handleFocus = () => {
      void checkAuth()
    }

    window.addEventListener("focus", handleFocus)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", handleFocus)
    }
  }, [mounted, router, requiredRole, requiredPermission])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#4a342a]" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}

// HOC for wrapping admin-only pages
export function AdminOnly({ children }: { children: React.ReactNode }) {
  return <AuthGuard requiredRole="admin">{children}</AuthGuard>
}

// HOC for wrapping any authenticated pages
export function RequireAuth({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}

