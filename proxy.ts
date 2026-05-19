import { NextResponse, type NextRequest } from "next/server"

type AuthCookiePayload = {
  id: string
  role: "admin" | "cashier" | "inventory_staff" | "barista" | "manager" | "kitchen"
  isActive: boolean
}

const publicPaths = ["/"]

function getDefaultRouteForRole(role: AuthCookiePayload["role"]) {
  if (role === "cashier") return "/pos"
  if (role === "barista") return "/queue-display"
  if (role === "kitchen") return "/queue-management"
  if (role === "admin" || role === "manager" || role === "inventory_staff") return "/dashboard"
  return "/dashboard"
}

function parseAuthCookie(request: NextRequest): AuthCookiePayload | null {
  const raw = request.cookies.get("alfresco_auth_state")?.value
  if (!raw) return null

  try {
    return JSON.parse(decodeURIComponent(raw)) as AuthCookiePayload
  } catch {
    return null
  }
}

function isPublicPath(pathname: string) {
  return publicPaths.includes(pathname) || pathname.startsWith("/api/")
}

function isAllowed(role: AuthCookiePayload["role"], pathname: string) {
  if (role === "admin") {
    return !pathname.startsWith("/queue-management") && !pathname.startsWith("/kitchen-dashboard")
  }

  if (pathname.startsWith("/queue-management") || pathname.startsWith("/kitchen-dashboard")) {
    return role === "kitchen"
  }

  if (
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/ingredients") ||
    pathname.startsWith("/expiration-logs") ||
    pathname.startsWith("/combos") ||
    pathname.startsWith("/addons")
  ) {
    return role === "inventory_staff"
  }

  if (pathname.startsWith("/pos") || pathname.startsWith("/sales-history")) {
    return role === "cashier"
  }

  if (pathname.startsWith("/sales-analytics")) {
    return role === "inventory_staff" || role === "manager"
  }

  if (pathname.startsWith("/queue-display")) {
    return role === "cashier" || role === "inventory_staff" || role === "barista" || role === "manager" || role === "kitchen"
  }

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/settings")) {
    return role === "inventory_staff" || role === "manager"
  }

  if (pathname.startsWith("/user-management") || pathname.startsWith("/register")) {
    return false
  }

  return true
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname) || pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next()
  }

  const auth = parseAuthCookie(request)
  if (!auth?.id || auth.isActive === false) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (!isAllowed(auth.role, pathname)) {
    return NextResponse.redirect(new URL(getDefaultRouteForRole(auth.role), request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
