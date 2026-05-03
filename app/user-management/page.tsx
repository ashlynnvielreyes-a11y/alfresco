"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { AdminOnly } from "@/components/auth-guard"
import {
  createUserAccount,
  deactivateUserAccount,
  getUsers,
  resetUserPassword,
  updateUserAccount,
  type UserRole,
} from "@/lib/store"
import type { AppUser } from "@/lib/types"
import { Plus, Pencil, UserX, KeyRound, Search, ShieldCheck } from "lucide-react"
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

type EditorMode = "create" | "edit"

const roleOptions: Array<{ value: UserRole; label: string; description: string }> = [
  { value: "admin", label: "Admin", description: "Full access" },
  { value: "cashier", label: "Cashier", description: "POS and sales access" },
  { value: "inventory_staff", label: "Inventory Staff", description: "Inventory management only" },
]

function emptyForm() {
  return {
    username: "",
    email: "",
    password: "",
    role: "cashier" as UserRole,
  }
}

function UserManagementPageContent() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editorMode, setEditorMode] = useState<EditorMode>("create")
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [deactivatingUser, setDeactivatingUser] = useState<AppUser | null>(null)
  const [resettingUser, setResettingUser] = useState<AppUser | null>(null)
  const [form, setForm] = useState(emptyForm())

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    const nextUsers = await getUsers()
    setUsers(nextUsers)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return users

    return users.filter((user) =>
      user.username.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query) ||
      (user.isActive ? "active" : "inactive").includes(query)
    )
  }, [search, users])

  const openCreate = () => {
    setEditorMode("create")
    setEditingUser(null)
    setForm(emptyForm())
    setError("")
    setSuccess("")
    setIsEditorOpen(true)
  }

  const openEdit = (user: AppUser) => {
    setEditorMode("edit")
    setEditingUser(user)
    setForm({
      username: user.username,
      email: user.email,
      password: "",
      role: user.role,
    })
    setError("")
    setSuccess("")
    setIsEditorOpen(true)
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError("")
    setSuccess("")

    const result =
      editorMode === "create"
        ? await createUserAccount(form)
        : editingUser
          ? await updateUserAccount(editingUser.id, {
              username: form.username,
              email: form.email,
              role: form.role,
            })
          : { success: false, error: "No user selected" }

    setIsSaving(false)

    if (!result.success) {
      setError(result.error || "Unable to save user")
      return
    }

    setSuccess(editorMode === "create" ? "User created successfully." : "User updated successfully.")
    setIsEditorOpen(false)
    setForm(emptyForm())
    setEditingUser(null)
    await loadUsers()
  }

  const handleDeactivate = async () => {
    if (!deactivatingUser) return

    setIsSaving(true)
    setError("")
    const result = await deactivateUserAccount(deactivatingUser.id)
    setIsSaving(false)

    if (!result.success) {
      setError(result.error || "Unable to deactivate user")
      return
    }

    setSuccess(`${deactivatingUser.username} has been deactivated.`)
    setDeactivatingUser(null)
    await loadUsers()
  }

  const handleResetPassword = async () => {
    if (!resettingUser) return

    if (!form.password) {
      setError("Please enter a new password.")
      return
    }

    setIsSaving(true)
    setError("")
    const result = await resetUserPassword(resettingUser.id, form.password)
    setIsSaving(false)

    if (!result.success) {
      setError(result.error || "Unable to reset password")
      return
    }

    setSuccess(`Password reset for ${resettingUser.username}.`)
    setResettingUser(null)
    setForm((current) => ({ ...current, password: "" }))
    await loadUsers()
  }

  return (
    <AdminOnly>
      <div className="flex min-h-screen bg-transparent">
        <Sidebar />

        <main className="relative flex-1 overflow-hidden p-4 pt-20 lg:p-6 lg:pt-6">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 top-10 h-64 w-64 rounded-full bg-[#d7c9b8]/18 blur-3xl" />
            <div className="absolute right-8 top-24 h-52 w-52 rounded-full bg-[#7d5a44]/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#4a342a] lg:text-3xl">User Management</h1>
                <p className="text-sm text-muted-foreground lg:text-base">
                  Manage staff accounts, role-based access, and deactivated users without losing audit history.
                </p>
              </div>
              <button
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#4a342a] px-5 py-3 font-semibold text-[#f5f1ea] transition-colors hover:bg-[#7d5a44]"
              >
                <Plus className="h-5 w-5" />
                Add User
              </button>
            </div>

            <div className="mb-4 rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/45 p-4 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search username, email, role, or status"
                  className="w-full rounded-2xl border border-[#f5f1ea]/60 bg-[#f5f1ea]/90 py-3 pl-12 pr-4 text-foreground outline-none transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
                />
              </div>
            </div>

            {error ? <p className="mb-4 text-sm font-medium text-[#7d5a44]">{error}</p> : null}
            {success ? <p className="mb-4 text-sm font-medium text-[#4f8a63]">{success}</p> : null}

            <div className="overflow-x-auto rounded-[28px] border border-[#f5f1ea]/55 bg-[#f5f1ea]/40 shadow-[0_24px_48px_rgba(123,111,25,0.08),inset_0_1px_0_rgba(245,241,234,0.7)] backdrop-blur-xl">
              <table className="min-w-[980px] w-full">
                <thead>
                  <tr className="border-b border-[#d7c9b8]/55">
                    <th className="px-5 py-4 text-left font-semibold text-foreground">User</th>
                    <th className="px-5 py-4 text-left font-semibold text-foreground">Role</th>
                    <th className="px-5 py-4 text-left font-semibold text-foreground">Status</th>
                    <th className="px-5 py-4 text-left font-semibold text-foreground">Created</th>
                    <th className="px-5 py-4 text-left font-semibold text-foreground">Updated</th>
                    <th className="px-5 py-4 text-right font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">Loading users...</td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No users found.</td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-[#d7c9b8]/35 last:border-0">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-foreground">{user.username}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-2 rounded-full bg-[#ede3d8] px-3 py-1 text-sm font-medium text-[#4a342a]">
                            <ShieldCheck className="h-4 w-4" />
                            {roleOptions.find((option) => option.value === user.role)?.label || user.role}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${user.isActive ? "bg-[#dcefdc] text-[#2f7d32]" : "bg-red-100 text-red-700"}`}>
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US") : "Unknown"}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{user.updatedAt ? new Date(user.updatedAt).toLocaleDateString("en-US") : "Unknown"}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEdit(user)}
                              className="inline-flex items-center gap-2 rounded-xl border border-[#d7c9b8] bg-[#f5f1ea] px-3 py-2 text-sm font-medium text-[#4a342a] transition-colors hover:bg-[#ede3d8]"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setResettingUser(user)
                                setForm((current) => ({ ...current, password: "" }))
                                setError("")
                              }}
                              className="inline-flex items-center gap-2 rounded-xl border border-[#d7c9b8] bg-[#f5f1ea] px-3 py-2 text-sm font-medium text-[#4a342a] transition-colors hover:bg-[#ede3d8]"
                            >
                              <KeyRound className="h-4 w-4" />
                              Reset Password
                            </button>
                            {user.isActive ? (
                              <button
                                onClick={() => setDeactivatingUser(user)}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#7d5a44] px-3 py-2 text-sm font-medium text-[#f5f1ea] transition-colors hover:bg-[#4a342a]"
                              >
                                <UserX className="h-4 w-4" />
                                Deactivate
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        <AlertDialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{editorMode === "create" ? "Add User" : "Edit User"}</AlertDialogTitle>
              <AlertDialogDescription>
                {editorMode === "create"
                  ? "Create a new account and assign the correct access level."
                  : "Update the account details and access role."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                  className="w-full rounded-2xl border border-[#f5f1ea]/60 bg-[#f5f1ea]/90 px-4 py-3 outline-none transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-2xl border border-[#f5f1ea]/60 bg-[#f5f1ea]/90 px-4 py-3 outline-none transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
                  required
                />
              </div>
              {editorMode === "create" ? (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground">Temporary Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    className="w-full rounded-2xl border border-[#f5f1ea]/60 bg-[#f5f1ea]/90 px-4 py-3 outline-none transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
                    required
                  />
                </div>
              ) : null}
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Role</label>
                <select
                  value={form.role}
                  onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}
                  className="w-full rounded-2xl border border-[#f5f1ea]/60 bg-[#f5f1ea]/90 px-4 py-3 outline-none transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} - {option.description}
                    </option>
                  ))}
                </select>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel type="button" onClick={() => setIsEditorOpen(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : editorMode === "create" ? "Create User" : "Save Changes"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(deactivatingUser)} onOpenChange={(open) => !open && setDeactivatingUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate Account</AlertDialogTitle>
              <AlertDialogDescription>
                {deactivatingUser
                  ? `Deactivate ${deactivatingUser.username}? Their login access will be revoked, but their records and transaction history will remain.`
                  : "Deactivate this account?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeactivate} disabled={isSaving}>
                {isSaving ? "Deactivating..." : "Deactivate"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(resettingUser)} onOpenChange={(open) => !open && setResettingUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Password</AlertDialogTitle>
              <AlertDialogDescription>
                {resettingUser
                  ? `Set a new password for ${resettingUser.username}.`
                  : "Set a new password for this account."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">New Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-2xl border border-[#f5f1ea]/60 bg-[#f5f1ea]/90 px-4 py-3 outline-none transition-all focus:border-[#b2967d] focus:ring-2 focus:ring-[#4a342a]/15"
                  placeholder="Enter new password"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setResettingUser(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetPassword} disabled={isSaving}>
                {isSaving ? "Resetting..." : "Reset Password"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminOnly>
  )
}

export default function UserManagementPage() {
  return <UserManagementPageContent />
}
