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
      className={`flex items-center gap-3 px-4 py-3 mb-1 rounded-lg transition-colors ${
        isActive ? "bg-[#A61F30] text-white" : "text-foreground hover:bg-muted"
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
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-border px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Coffee className="h-7 w-7 text-[#A61F30]" />
          <span className="text-xl font-bold text-[#A61F30]">Al Fresco</span>
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
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
          className="lg:hidden fixed inset-0 bg-black/50 z-40 pt-16"
          onClick={closeMobileMenu}
        >
          <aside 
            className="w-72 h-full bg-white border-r border-border flex flex-col overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User info */}
            <div className="p-4">
              <div className="bg-[#F5E6E8] rounded-lg p-3">
                <p className="text-sm font-medium text-foreground truncate">{username || "User"}</p>
                <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
              </div>
            </div>

            <nav className="flex-1 px-3">
              {navItems.map((item) => (
                <NavItemComponent 
                  key={item.href} 
                  item={item} 
                  isActive={pathname === item.href} 
                  onClick={closeMobileMenu}
                />
              ))}
            </nav>

            <div className="p-3 border-t border-border">
              <button
                onClick={() => {
                  closeMobileMenu()
                  handleLogout()
                }}
                className="flex items-center gap-3 px-4 py-3 w-full text-[#A61F30] hover:bg-muted rounded-lg transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 h-screen bg-white border-r border-border flex-col sticky top-0">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Coffee className="h-8 w-8 text-[#A61F30]" />
            <span className="text-2xl font-bold text-[#A61F30]">Al Fresco</span>
          </Link>
        </div>

        {/* User info */}
        <div className="px-4 pb-4">
          <div className="bg-[#F5E6E8] rounded-lg p-3">
            <p className="text-sm font-medium text-foreground truncate">{username || "User"}</p>
            <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 overflow-y-auto">
          {navItems.map((item) => (
            <NavItemComponent key={item.href} item={item} isActive={pathname === item.href} />
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-[#A61F30] hover:bg-muted rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
})
