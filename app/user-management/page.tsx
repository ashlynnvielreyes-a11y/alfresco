"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Ban, CheckCircle2, Search, ShieldCheck, UserCog, Users } from "lucide-react"
import { getCurrentUser, getUserRole, getUsers, logout } from "@/lib/store"
import type { AppUser } from "@/lib/types"

function formatRole(role: AppUser["role"]) {
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

function formatDate(date?: string | null) {
  if (!date) return "Unknown"
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return "Unknown"
  return parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function UserManagementPage() {
  const router = useRouter()
  const [users, setUsers] = useState<AppUser[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null)

  const currentUser = useMemo(() => getCurrentUser(), [])

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setError("")

    const role = getUserRole()
    if (role !== "admin") {
      router.replace("/dashboard")
      return
    }

    const nextUsers = await getUsers()
    setUsers(nextUsers)
    setIsLoading(false)
  }, [router])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return true

    return (
      user.username.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      formatRole(user.role).toLowerCase().includes(query)
    )
  })

  const activeUsers = users.filter((user) => user.isActive).length
  const revokedUsers = users.length - activeUsers

  const handleAccessChange = async () => {
    if (!selectedUser) return

    setIsSubmitting(true)
    setError("")

    let result: { success: boolean; error?: string } = { success: false, error: "Unknown access update failure." }

    try {
      const response = await fetch("/api/users/access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          action: selectedUser.isActive ? "revoke" : "activate",
        }),
      })

      const data = await response.json()
      result = { success: Boolean(data.success), error: data.error }
    } catch {
      result = { success: false, error: "Failed to contact the server." }
    }

    if (!result.success) {
      setError(result.error || `Failed to ${selectedUser.isActive ? "revoke" : "restore"} access.`)
      setIsSubmitting(false)
      return
    }

    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === selectedUser.id
          ? {
              ...user,
              isActive: !selectedUser.isActive,
              deactivatedAt: selectedUser.isActive ? new Date().toISOString() : null,
            }
          : user
      )
    )

    if (selectedUser.isActive && currentUser?.id === selectedUser.id) {
      logout()
      router.replace("/")
      return
    }

    setSelectedUser(null)
    setIsSubmitting(false)
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />

      <main className="relative flex-1 overflow-hidden p-4 pt-20 lg:p-6 lg:pt-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-10 h-64 w-64 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
          <div className="absolute right-8 top-24 h-56 w-56 rounded-full bg-[#7d5a44]/10 blur-3xl" />
        </div>

        <div className="relative z-10 space-y-6">
          <section className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-5 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.75)] backdrop-blur-xl lg:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.32em] text-[#7d5a44]">ADMIN CONTROLS</p>
                <h1 className="text-2xl font-bold text-[#4a342a] lg:text-4xl">User Management</h1>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground lg:text-base">
                  Review registered accounts and revoke access when needed without changing the registration flow.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#7d5a44]">Active Users</p>
                  <p className="mt-1 text-2xl font-bold text-[#4a342a]">{activeUsers}</p>
                </div>
                <div className="rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#7d5a44]">Revoked Access</p>
                  <p className="mt-1 text-2xl font-bold text-[#4a342a]">{revokedUsers}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl lg:p-6">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground lg:text-xl">Registered Users</h2>
                <p className="text-xs text-muted-foreground lg:text-sm">
                  Accounts created through registration remain available here for admin review and access control.
                </p>
              </div>

              <label className="flex items-center gap-2 rounded-2xl border border-[#f5f1ea]/55 bg-[#f5f1ea]/60 px-3 py-2 backdrop-blur-sm lg:min-w-[320px]">
                <Search className="h-4 w-4 text-[#4a342a]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username, email, or role"
                  className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
            </div>

            {error ? (
              <div className="mb-4 rounded-2xl border border-[#d7c9b8] bg-[#f5f1ea]/80 px-4 py-3 text-sm text-[#7d5a44]">
                {error}
              </div>
            ) : null}

            {isLoading ? (
              <div className="rounded-2xl border border-dashed border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-10 text-center text-sm text-muted-foreground">
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d7c9b8] bg-[#f5f1ea]/70 px-4 py-10 text-center text-sm text-muted-foreground">
                {users.length === 0 ? "No registered users found." : "No users match the current search."}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {filteredUsers.map((user) => {
                  const isCurrentUser = currentUser?.id === user.id
                  const canDeactivate = user.isActive && !isCurrentUser
                  const canActivate = !user.isActive

                  return (
                    <article
                      key={user.id}
                      className="rounded-[24px] border border-[#d7c9b8]/70 bg-[rgba(245,241,234,0.78)] p-5 shadow-[0_16px_30px_rgba(74,52,42,0.06)] backdrop-blur-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="rounded-2xl bg-[#f5f1ea] p-2">
                              {user.role === "admin" ? (
                                <ShieldCheck className="h-5 w-5 text-[#4a342a]" />
                              ) : (
                                <UserCog className="h-5 w-5 text-[#4a342a]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">{user.username}</p>
                              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            user.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-[#d7c9b8] text-[#7d5a44]"
                          }`}
                        >
                          {user.isActive ? "Active" : "Revoked"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                        <p>
                          Role
                          <span className="mt-1 block font-medium text-foreground">{formatRole(user.role)}</span>
                        </p>
                        <p>
                          Joined
                          <span className="mt-1 block font-medium text-foreground">{formatDate(user.createdAt)}</span>
                        </p>
                        <p>
                          Revoked At
                          <span className="mt-1 block font-medium text-foreground">{formatDate(user.deactivatedAt)}</span>
                        </p>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-4 w-4" />
                          {isCurrentUser ? "Your current admin account" : "Account created through registration"}
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedUser(user)}
                          disabled={user.isActive ? !canDeactivate : !canActivate}
                          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:bg-[#d7c9b8] disabled:text-[#7d5a44] ${
                            user.isActive
                              ? "bg-[#4a342a] text-[#f5f1ea] hover:bg-[#7d5a44]"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {user.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          {user.isActive ? "Revoke Access" : "Activate Access"}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <AlertDialog open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{selectedUser?.isActive ? "Revoke User Access" : "Activate User Access"}</AlertDialogTitle>
              <AlertDialogDescription>
                {selectedUser
                  ? selectedUser.isActive
                    ? `Revoke access for ${selectedUser.username}? Their existing account will remain in the system, but they will no longer be able to log in until an admin restores access.`
                    : `Restore access for ${selectedUser.username}? Their existing account details will remain unchanged and they will be able to log in again.`
                  : "Update this user's access?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleAccessChange} disabled={isSubmitting}>
                {isSubmitting ? (selectedUser?.isActive ? "Revoking..." : "Activating...") : selectedUser?.isActive ? "Revoke Access" : "Activate Access"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}
