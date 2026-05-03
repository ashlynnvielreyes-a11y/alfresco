"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { isAuthenticated, validateCurrentSession } from "@/lib/store"

const PUBLIC_PATHS = ["/"]

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/api/")
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
