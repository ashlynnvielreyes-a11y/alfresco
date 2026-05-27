"use client"

import { memo, useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronLeft,
  FileText,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  MonitorPlay,
  Package,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react"
import {
  canAccessDashboard,
  canAccessInventory,
  canAccessPos,
  canAccessQueue,
  canAccessSales,
  canAccessSalesAnalytics,
  getCurrentUser,
  getDefaultRouteForRole,
  getUserRole,
  logout,
  type UserRole,
} from "@/lib/store"

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  description: string
  section: "Core" | "Operations" | "Admin"
  permission?: "dashboard" | "pos" | "queue" | "inventory" | "sales" | "sales_analytics" | "admin" | "kitchen_queue"
}

const SIDEBAR_COLLAPSE_KEY = "alfresco_sidebar_collapsed"

const allNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Role-tailored overview", section: "Core", permission: "dashboard" },
  { href: "/pos", label: "POS", icon: ShoppingCart, description: "Process active orders", section: "Core", permission: "pos" },
  { href: "/queue-management", label: "Kitchen Dashboard", icon: ReceiptText, description: "Update preparing and ready orders", section: "Core", permission: "kitchen_queue" },
  { href: "/queue-display", label: "Queue Display", icon: MonitorPlay, description: "Show the live customer board", section: "Core", permission: "queue" },
  { href: "/sales-history", label: "Sales History", icon: FileText, description: "Search receipts and export records", section: "Core", permission: "sales" },
  { href: "/sales-analytics", label: "Sales Analytics", icon: TrendingUp, description: "Review KPIs and business insights", section: "Core", permission: "sales_analytics" },
  { href: "/inventory", label: "Inventory", icon: Package, description: "Monitor stock levels", section: "Operations", permission: "inventory" },
  { href: "/ingredients", label: "Ingredients", icon: Leaf, description: "Manage raw materials", section: "Operations", permission: "inventory" },
  { href: "/expiration-logs", label: "Expiry Logs", icon: AlertTriangle, description: "Review expiring items", section: "Operations", permission: "inventory" },
  { href: "/combos", label: "Combo Meals", icon: UtensilsCrossed, description: "Adjust bundled offers", section: "Operations", permission: "inventory" },
  { href: "/addons", label: "Add-ons", icon: Plus, description: "Refine upsell options", section: "Operations", permission: "inventory" },
  { href: "/user-management", label: "Team Access", icon: Users, description: "Control account permissions", section: "Admin", permission: "admin" },
  { href: "/settings", label: "Settings", icon: Settings, description: "Preferences and controls", section: "Admin" },
]

const getNavItemsForRole = (role: UserRole): NavItem[] => {
  if (role === "cashier") {
    return allNavItems.filter((item) => item.href === "/pos" || item.href === "/sales-history")
  }

  return allNavItems.filter((item) => {
    switch (item.permission) {
      case "dashboard":
        return canAccessDashboard(role)
      case "pos":
        return canAccessPos(role)
      case "queue":
        return canAccessQueue(role)
      case "inventory":
        return canAccessInventory(role)
      case "sales":
        return canAccessSales(role)
      case "sales_analytics":
        return canAccessSalesAnalytics(role)
      case "admin":
        return role === "admin"
      case "kitchen_queue":
        return role === "admin" || role === "kitchen"
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
      return "Staff"
    case "barista":
      return "Barista"
    case "manager":
      return "Manager"
    case "inventory_staff":
      return "Manager"
    case "kitchen":
      return "Kitchen"
    default:
      return role
  }
}

function getRoleAccent(role: UserRole) {
  switch (role) {
    case "admin":
      return {
        icon: ShieldCheck,
        gradient: "from-[#4a342a] via-[#7d5a44] to-[#b2967d]",
        summary: "Full platform visibility and control",
      }
    case "inventory_staff":
    case "manager":
      return {
        icon: BriefcaseBusiness,
        gradient: "from-[#5a4134] via-[#8a6a55] to-[#d7c9b8]",
        summary: "Operations, stock health, and planning",
      }
    case "barista":
    case "kitchen":
      return {
        icon: ReceiptText,
        gradient: "from-[#4d3f34] via-[#8d6b55] to-[#d7c4ae]",
        summary: "Queue flow, preparation speed, and handoff readiness",
      }
    default:
      return {
        icon: ArrowUpRight,
        gradient: "from-[#6a4b3a] via-[#9a7258] to-[#d7c4ae]",
        summary: "Frontline transactions and daily momentum",
      }
  }
}

const NavItemComponent = memo(function NavItemComponent({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  onClick?: () => void
}) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      prefetch={false}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`group flex items-center rounded-2xl text-[0.95rem] leading-6 transition-all duration-300 ${
        isActive
          ? "bg-[#171412] text-[#f8f4ef] shadow-[0_18px_34px_rgba(23,20,18,0.18)]"
          : "text-[#5f544c] hover:bg-white/70 hover:text-[#1d1917] hover:shadow-[0_10px_24px_rgba(48,37,30,0.08)]"
      } ${collapsed ? "justify-center px-0 py-3.5" : "gap-3 px-4 py-3.5"}`}
    >
      <span
        className={`flex items-center justify-center rounded-2xl border transition-all duration-300 ${
          isActive
            ? "border-white/10 bg-white/10 text-[#f8f4ef]"
            : "border-[#ddd0c4] bg-[#fbf8f3] text-[#7c695d] group-hover:border-[#cfbfb1] group-hover:bg-white"
        } ${collapsed ? "h-11 w-11" : "h-10 w-10"}`}
      >
        <Icon className={`transition-transform duration-300 ${collapsed ? "h-[1.2rem] w-[1.2rem]" : "h-[1.05rem] w-[1.05rem]"} ${isActive ? "" : "group-hover:scale-105"}`} />
      </span>

      <span className={`min-w-0 flex-1 overflow-hidden transition-all duration-300 ${collapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>
        <span className={`block truncate font-semibold tracking-[-0.02em] ${isActive ? "text-[#f8f4ef]" : ""}`}>{item.label}</span>
        <span className={`mt-0.5 block truncate text-xs ${isActive ? "text-[#d8cec3]" : "text-[#918176]"}`}>{item.description}</span>
      </span>
    </Link>
  )
})

const SidebarSection = memo(function SidebarSection({
  title,
  items,
  pathname,
  collapsed,
  onClick,
}: {
  title: NavItem["section"]
  items: NavItem[]
  pathname: string
  collapsed: boolean
  onClick?: () => void
}) {
  if (items.length === 0) return null

  return (
    <section className="space-y-2">
      {!collapsed && <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#9c8d83]">{title}</p>}
      <div className="space-y-2">
        {items.map((item) => (
          <NavItemComponent
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            collapsed={collapsed}
            onClick={onClick}
          />
        ))}
      </div>
    </section>
  )
})

const LogoutButton = memo(function LogoutButton({
  collapsed,
  onClick,
}: {
  collapsed: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? "Logout" : undefined}
      className={`flex w-full items-center rounded-2xl text-left font-semibold text-[#4a342a] transition-colors hover:bg-white/70 ${
        collapsed ? "justify-center px-0 py-3.5" : "gap-3 px-4 py-3.5"
      }`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#ddd0c4] bg-[#fbf8f3] text-[#715d50]">
        <LogOut className="h-4 w-4" />
      </span>
      {!collapsed && <span>Logout</span>}
    </button>
  )
})

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userRole, setUserRole] = useState<UserRole>("cashier")
  const [username, setUsername] = useState("")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const role = getUserRole()
    const user = getCurrentUser()
    setUserRole(role)
    setUsername(user?.username || "")

    if (typeof window !== "undefined") {
      setIsCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "true")
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, String(isCollapsed))
  }, [isCollapsed])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }

    return () => {
      document.body.style.overflow = ""
    }
  }, [isMobileMenuOpen])

  const navItems = useMemo(() => getNavItemsForRole(userRole), [userRole])
  const homeRoute = getDefaultRouteForRole(userRole)
  const roleAccent = getRoleAccent(userRole)
  const RoleIcon = roleAccent.icon
  const groupedNavItems = useMemo(
    () => ({
      Core: navItems.filter((item) => item.section === "Core"),
      Operations: navItems.filter((item) => item.section === "Operations"),
      Admin: navItems.filter((item) => item.section === "Admin"),
    }),
    [navItems]
  )

  const handleLogout = useCallback(() => {
    logout()
    router.push("/")
  }, [router])

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false)
  }, [])

  const desktopSections = (
    <div className="space-y-5">
      <SidebarSection title="Core" items={groupedNavItems.Core} pathname={pathname} collapsed={isCollapsed} />
      <SidebarSection title="Operations" items={groupedNavItems.Operations} pathname={pathname} collapsed={isCollapsed} />
      <SidebarSection title="Admin" items={groupedNavItems.Admin} pathname={pathname} collapsed={isCollapsed} />
    </div>
  )

  const mobileSections = (
    <div className="space-y-5">
      <SidebarSection title="Core" items={groupedNavItems.Core} pathname={pathname} collapsed={false} onClick={closeMobileMenu} />
      <SidebarSection title="Operations" items={groupedNavItems.Operations} pathname={pathname} collapsed={false} onClick={closeMobileMenu} />
      <SidebarSection title="Admin" items={groupedNavItems.Admin} pathname={pathname} collapsed={false} onClick={closeMobileMenu} />
    </div>
  )

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/35 bg-[rgba(248,244,239,0.88)] px-4 py-3 shadow-[0_12px_30px_rgba(42,30,23,0.08)] backdrop-blur-2xl lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href={homeRoute} className="flex min-w-0 items-center gap-3">
            <div className="rounded-2xl border border-[#eadfd5] bg-[rgba(255,251,247,0.82)] px-3 py-2 shadow-[0_10px_22px_rgba(42,30,23,0.08)]">
              <Image src="/alfresco-logo.png" alt="Al Fresco Cafe" width={150} height={54} className="h-10 w-auto object-contain" priority />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs uppercase tracking-[0.22em] text-[#86766a]">{formatRoleLabel(userRole)} Workspace</p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e1d6cb] bg-white/75 text-[#2e2622] transition-colors hover:bg-white"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[rgba(27,20,16,0.32)] pt-[4.75rem] backdrop-blur-sm lg:hidden" onClick={closeMobileMenu}>
          <aside
            className="sidebar-scrollbar h-full w-[19rem] overflow-y-auto border-r border-white/30 bg-[rgba(248,244,239,0.96)] px-4 py-4 shadow-[20px_0_64px_rgba(41,29,23,0.14)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`rounded-[30px] bg-gradient-to-br ${roleAccent.gradient} p-[1px] shadow-[0_18px_40px_rgba(26,19,15,0.12)]`}>
              <div className="rounded-[29px] bg-[rgba(248,244,239,0.9)] p-4 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#171412] text-[#f8f4ef]">
                    <RoleIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold tracking-[-0.03em] text-[#221b18]">{username || "User"}</p>
                    <p className="text-xs uppercase tracking-[0.22em] text-[#87776b]">{formatRoleLabel(userRole)}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-[#6f6157]">{roleAccent.summary}</p>
              </div>
            </div>

            <nav className="mt-5">{mobileSections}</nav>

            <div className="mt-4 border-t border-[#ece3db] pt-4">
              <LogoutButton
                collapsed={false}
                onClick={() => {
                  closeMobileMenu()
                  handleLogout()
                }}
              />
            </div>
          </aside>
        </div>
      )}

      <aside
        className={`sidebar-scrollbar sticky top-0 hidden h-screen flex-col overflow-y-auto border-r border-white/35 bg-[rgba(248,244,239,0.8)] shadow-[20px_0_58px_rgba(40,29,23,0.08)] backdrop-blur-2xl transition-[width] duration-300 lg:flex ${
          isCollapsed ? "w-[6.25rem]" : "w-[18.5rem]"
        }`}
      >
        <div className={`p-4 ${isCollapsed ? "pb-4" : "pb-3"}`}>
          <div className="flex items-center justify-between gap-3">
            <Link href={homeRoute} className={`min-w-0 ${isCollapsed ? "mx-auto" : "block"}`}>
              {isCollapsed ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#eadfd5] bg-[rgba(255,251,247,0.82)] shadow-[0_12px_24px_rgba(42,30,23,0.08)]">
                  <Image src="/alfresco-logo.png" alt="Al Fresco Cafe" width={34} height={34} className="h-8 w-8 object-contain" priority />
                </div>
              ) : (
                <div className="rounded-[26px] border border-[#eadfd5] bg-[rgba(255,251,247,0.82)] px-4 py-3 shadow-[0_14px_28px_rgba(42,30,23,0.08)]">
                  <Image src="/alfresco-logo.png" alt="Al Fresco Cafe" width={220} height={78} className="h-14 w-auto object-contain" priority />
                </div>
              )}
            </Link>

            {!isCollapsed && (
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e1d6cb] bg-white/75 text-[#49352c] transition-colors hover:bg-white"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </div>

          {isCollapsed && (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="mx-auto mt-4 flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e1d6cb] bg-white/75 text-[#49352c] transition-colors hover:bg-white"
              aria-label="Expand sidebar"
            >
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </button>
          )}
        </div>

        <div className={`px-4 transition-all duration-300 ${isCollapsed ? "pb-3" : "pb-5"}`}>
          <div className={`rounded-[30px] bg-gradient-to-br ${roleAccent.gradient} p-[1px] shadow-[0_18px_40px_rgba(27,20,15,0.08)]`}>
            <div className={`rounded-[29px] bg-[rgba(248,244,239,0.84)] backdrop-blur-xl transition-all duration-300 ${isCollapsed ? "px-3 py-4" : "p-4"}`}>
              <div className={`flex ${isCollapsed ? "justify-center" : "items-center gap-3"}`}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#171412] text-[#f8f4ef]">
                  <RoleIcon className="h-5 w-5" />
                </div>
                {!isCollapsed && (
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold tracking-[-0.03em] text-[#221b18]">{username || "User"}</p>
                    <p className="text-xs uppercase tracking-[0.22em] text-[#87776b]">{formatRoleLabel(userRole)}</p>
                  </div>
                )}
              </div>
              {!isCollapsed && <p className="mt-4 text-sm text-[#6f6157]">{roleAccent.summary}</p>}
            </div>
          </div>
        </div>

        <nav className="px-4">{desktopSections}</nav>

        <div className="px-4 pb-4 pt-4">
          <div className="border-t border-white/35 pt-4">
            <LogoutButton collapsed={isCollapsed} onClick={handleLogout} />
          </div>
        </div>
      </aside>
    </>
  )
})
