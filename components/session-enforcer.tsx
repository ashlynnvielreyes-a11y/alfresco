"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { canAccessDashboard, canAccessInventory, canAccessPos, canAccessSales, getUserRole, isAuthenticated, validateCurrentSession } from "@/lib/store"

const PUBLIC_PATHS = ["/", "/register"]

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/api/")
}

function canAccessPath(pathname: string, role: ReturnType<typeof getUserRole>) {
  if (pathname.startsWith("/dashboard")) return canAccessDashboard(role)
  if (pathname.startsWith("/pos")) return canAccessPos(role)
  if (
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/ingredients") ||
    pathname.startsWith("/expiration-logs") ||
    pathname.startsWith("/combos") ||
    pathname.startsWith("/addons")
  ) {
    return canAccessInventory(role)
  }
  if (pathname.startsWith("/sales-history")) return canAccessSales(role)

  return true
}

export function SessionEnforcer() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!pathname || isPublicPath(pathname) || pathname.startsWith("/_next")) {
      return
    }

    const checkSession = async () => {
      if (!isAuthenticated()) {
        router.replace("/")
        return
      }

      const currentUser = await validateCurrentSession()
      if (!currentUser) {
        router.replace("/")
        return
      }

      const role = getUserRole()
      if (!canAccessPath(pathname, role)) {
        router.replace("/dashboard")
      }
    }

    void checkSession()

    const intervalId = window.setInterval(() => {
      void checkSession()
    }, 30000)

    const handleFocus = () => {
      void checkSession()
    }

    window.addEventListener("focus", handleFocus)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", handleFocus)
    }
  }, [pathname, router])

  return null
}
