"use client"

import { memo, useCallback, useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, ShoppingCart, Package, FileText, LogOut, Leaf, Settings, UtensilsCrossed, Menu, X, Plus, AlertTriangle, Users } from "lucide-react"
import { logout, getUserRole, getCurrentUser, canAccessDashboard, canAccessInventory, canAccessPos, canAccessSales, type UserRole } from "@/lib/store"

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  permission?: "dashboard" | "pos" | "inventory" | "sales" | "admin"
}

const allNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { href: "/pos", label: "POS", icon: ShoppingCart, permission: "pos" },
  { href: "/inventory", label: "Inventory", icon: Package, permission: "inventory" },
  { href: "/ingredients", label: "Ingredients", icon: Leaf, permission: "inventory" },
  { href: "/expiration-logs", label: "Expiration Logs", icon: AlertTriangle, permission: "inventory" },
  { href: "/combos", label: "Combo Meals", icon: UtensilsCrossed, permission: "inventory" },
  { href: "/addons", label: "Add-ons", icon: Plus, permission: "inventory" },
  { href: "/sales-history", label: "Sales History", icon: FileText, permission: "sales" },
  { href: "/user-management", label: "User Management", icon: Users, permission: "admin" },
  { href: "/settings", label: "Settings", icon: Settings },
]

const getNavItemsForRole = (role: UserRole): NavItem[] => {
  return allNavItems.filter((item) => {
    switch (item.permission) {
      case "dashboard":
        return canAccessDashboard(role)
      case "pos":
        return canAccessPos(role)
      case "inventory":
        return canAccessInventory(role)
      case "sales":
        return canAccessSales(role)
      case "admin":
        return role === "admin"
      default:
        return true
    }
  })
}

function formatRoleLabel(role: UserRole) {
  switch (role) {
    case "admin":
      return "Admin"
    case "cashier":
      return "Cashier"
    case "inventory_staff":
      return "Inventory Staff"
    default:
      return role
  }
}

const NavItemComponent = memo(({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick?: () => void }) => {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      prefetch={false}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-[0.95rem] leading-6 transition-all duration-200 ${
        isActive
          ? "bg-gradient-to-r from-[#4a342a] via-[#7d5a44] to-[#b2967d] text-[#f5f1ea] shadow-[0_14px_28px_rgba(74,52,42,0.18)]"
          : "text-[#5f493f] hover:bg-[#f5f1ea]/72 hover:text-[#3f2b22] hover:backdrop-blur-sm"
      }`}
    >
      <Icon className={`h-[1.15rem] w-[1.15rem] flex-shrink-0 transition-transform duration-200 ${isActive ? "text-[#f5f1ea]" : "text-[#7d5a44] group-hover:scale-[1.03]"}`} />
      <span className={`truncate font-semibold tracking-[-0.015em] ${isActive ? "text-[#f5f1ea]" : ""}`}>{item.label}</span>
    </Link>
  )
})

NavItemComponent.displayName = "NavItemComponent"

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userRole, setUserRole] = useState<UserRole>("cashier")
  const [username, setUsername] = useState<string>("")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const role = getUserRole()
    const user = getCurrentUser()
    setUserRole(role)
    setUsername(user?.username || "")
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  const navItems = getNavItemsForRole(userRole)

  const handleLogout = useCallback(() => {
    logout()
    router.push("/")
  }, [router])

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false)
  }, [])

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 border-b border-[rgba(74,52,42,0.08)] bg-[rgba(245,241,234,0.88)] backdrop-blur-xl px-4 py-3 flex items-center justify-between shadow-[0_10px_24px_rgba(74,52,42,0.08)]">
        <Link href="/dashboard" className="flex items-center justify-center">
          <Image src="/alfresco-logo.png" alt="Al Fresco Cafe" width={210} height={86} className="h-12 w-auto object-contain" priority />
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-[#f5f1ea]/70 rounded-xl transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6 text-foreground" />
          ) : (
            <Menu className="h-6 w-6 text-foreground" />
          )}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-[rgba(61,36,16,0.35)] backdrop-blur-sm z-40 pt-16"
          onClick={closeMobileMenu}
        >
          <aside 
            className="sidebar-scrollbar w-72 h-full bg-[rgba(245,241,234,0.96)] border-r border-[rgba(74,52,42,0.08)] flex flex-col overflow-y-auto backdrop-blur-xl shadow-[18px_0_40px_rgba(74,52,42,0.12)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User info */}
            <div className="p-4 pb-3">
              <div className="rounded-2xl border border-[#f5f1ea]/60 bg-[#f5f1ea]/65 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(245,241,234,0.6)] backdrop-blur-sm">
                <p className="truncate text-sm font-semibold tracking-[-0.02em] text-foreground">{username || "User"}</p>
                <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8a6c5b]">{formatRoleLabel(userRole)}</p>
              </div>
            </div>

            <nav className="sidebar-scrollbar flex-1 space-y-1 px-3.5 overflow-y-auto">
              {navItems.map((item) => (
                <NavItemComponent 
                  key={item.href} 
                  item={item} 
                  isActive={pathname === item.href} 
                  onClick={closeMobileMenu}
                />
              ))}
            </nav>

            <div className="border-t border-[#f5f1ea]/40 p-3.5">
              <button
                onClick={() => {
                  closeMobileMenu()
                  handleLogout()
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[0.95rem] font-semibold tracking-[-0.015em] text-[#4a342a] transition-colors hover:bg-[#f5f1ea]/70"
              >
                <LogOut className="h-[1.15rem] w-[1.15rem] text-[#7d5a44]" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex h-screen w-64 flex-col border-r border-[rgba(74,52,42,0.08)] bg-[rgba(245,241,234,0.88)] shadow-[20px_0_45px_rgba(74,52,42,0.08)] sticky top-0 backdrop-blur-xl">
        <div className="p-5 pb-3">
          <Link href="/dashboard" className="flex items-center justify-center">
            <Image src="/alfresco-logo.png" alt="Al Fresco Cafe" width={240} height={100} className="h-16 w-auto object-contain" priority />
          </Link>
        </div>

        {/* User info */}
        <div className="px-4 pb-4">
          <div className="rounded-2xl border border-[#f5f1ea]/60 bg-[#f5f1ea]/70 px-4 py-3.5 shadow-[0_8px_24px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-sm">
            <p className="truncate text-sm font-semibold tracking-[-0.02em] text-foreground">{username || "User"}</p>
            <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8a6c5b]">{formatRoleLabel(userRole)}</p>
          </div>
        </div>

        <nav className="sidebar-scrollbar flex-1 space-y-1 px-3.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavItemComponent key={item.href} item={item} isActive={pathname === item.href} />
          ))}
        </nav>

        <div className="border-t border-[#f5f1ea]/40 p-3.5">
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[0.95rem] font-semibold tracking-[-0.015em] text-[#4a342a] transition-colors hover:bg-[#f5f1ea]/70">
            <LogOut className="h-[1.15rem] w-[1.15rem] text-[#7d5a44]" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
})



