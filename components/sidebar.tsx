"use client"

import { memo, useCallback, useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, ShoppingCart, Package, FileText, LogOut, Coffee, Leaf, Settings, UtensilsCrossed, Menu, X, Plus } from "lucide-react"
import { logout, getUserRole, getCurrentUser, type UserRole } from "@/lib/store"

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  adminOnly?: boolean
}

const allNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", icon: Package, adminOnly: true },
  { href: "/ingredients", label: "Ingredients", icon: Leaf, adminOnly: true },
  { href: "/combos", label: "Combo Meals", icon: UtensilsCrossed, adminOnly: true },
  { href: "/addons", label: "Add-ons", icon: Plus, adminOnly: true },
  { href: "/sales-history", label: "Sales History", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
]

const getNavItemsForRole = (role: UserRole): NavItem[] => {
  if (role === "admin") {
    return allNavItems
  }
  // Cashiers can only see Dashboard, POS, and Sales History
  return allNavItems.filter(item => !item.adminOnly)
}

const NavItemComponent = memo(({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick?: () => void }) => {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      prefetch={false}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 mb-1.5 rounded-xl transition-all duration-200 ${
        isActive
          ? "bg-gradient-to-r from-[#bb3e00] via-[#d5661f] to-[#f7a645] text-white shadow-[0_14px_28px_rgba(187,62,0,0.18)]"
          : "text-foreground hover:bg-white/65 hover:backdrop-blur-sm"
      }`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="font-medium">{item.label}</span>
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
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 border-b border-white/40 bg-[#fff8eb]/85 backdrop-blur-xl px-4 py-3 flex items-center justify-between shadow-[0_10px_24px_rgba(123,111,25,0.08)]">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Coffee className="h-7 w-7 text-[#bb3e00]" />
          <span className="brand-wordmark text-xl text-[#bb3e00]">Al Fresco</span>
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-white/70 rounded-xl transition-colors"
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
            className="sidebar-scrollbar w-72 h-full bg-[#fff8eb]/95 border-r border-white/40 flex flex-col overflow-y-auto backdrop-blur-xl shadow-[18px_0_40px_rgba(123,111,25,0.12)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User info */}
            <div className="p-4">
              <div className="rounded-2xl border border-white/60 bg-white/65 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-sm">
                <p className="text-sm font-medium text-foreground truncate">{username || "User"}</p>
                <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
              </div>
            </div>

            <nav className="sidebar-scrollbar flex-1 px-3 overflow-y-auto">
              {navItems.map((item) => (
                <NavItemComponent 
                  key={item.href} 
                  item={item} 
                  isActive={pathname === item.href} 
                  onClick={closeMobileMenu}
                />
              ))}
            </nav>

            <div className="p-3 border-t border-white/40">
              <button
                onClick={() => {
                  closeMobileMenu()
                  handleLogout()
                }}
                className="flex items-center gap-3 px-4 py-3 w-full text-[#bb3e00] hover:bg-white/70 rounded-xl transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 h-screen bg-[#fff8eb]/80 border-r border-white/40 flex-col sticky top-0 backdrop-blur-xl shadow-[20px_0_45px_rgba(123,111,25,0.08)]">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#bb3e00] to-[#f7a645] text-white shadow-[0_12px_24px_rgba(187,62,0,0.2)]">
              <Coffee className="h-6 w-6" />
            </div>
            <div>
              <span className="brand-wordmark block text-2xl text-[#bb3e00]">Al Fresco</span>
              <span className="text-xs uppercase tracking-[0.24em] text-[#7b6f19]">Cafe Panel</span>
            </div>
          </Link>
        </div>

        {/* User info */}
        <div className="px-4 pb-4">
          <div className="rounded-2xl border border-white/60 bg-white/70 p-3 shadow-[0_8px_24px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm">
            <p className="text-sm font-medium text-foreground truncate">{username || "User"}</p>
            <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
          </div>
        </div>

        <nav className="sidebar-scrollbar flex-1 px-3 overflow-y-auto">
          {navItems.map((item) => (
            <NavItemComponent key={item.href} item={item} isActive={pathname === item.href} />
          ))}
        </nav>

        <div className="p-3 border-t border-white/40">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-[#bb3e00] hover:bg-white/70 rounded-xl transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
})

