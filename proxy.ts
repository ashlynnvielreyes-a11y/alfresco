import { NextResponse, type NextRequest } from "next/server"

type AuthCookiePayload = {
  id: string
  role: "admin" | "cashier" | "inventory_staff"
  isActive: boolean
}

const publicPaths = ["/"]

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
  if (
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/ingredients") ||
    pathname.startsWith("/expiration-logs") ||
    pathname.startsWith("/combos") ||
    pathname.startsWith("/addons") ||
    pathname.startsWith("/register")
  ) {
    return role === "admin" || role === "inventory_staff"
  }

  if (pathname.startsWith("/pos") || pathname.startsWith("/sales-history")) {
    return role === "admin" || role === "cashier"
  }

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/settings")) {
    return true
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
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
