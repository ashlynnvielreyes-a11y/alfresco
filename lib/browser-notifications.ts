"use client"

import type { AppUserRole } from "./types"

const LOGIN_NOTIFICATION_PERMISSION_KEY = "alfresco_login_notification_permission_requested"

export function shouldNotifyPrivilegedLogin(role: AppUserRole | string | null | undefined) {
  return role === "admin" || role === "inventory_staff"
}

export async function notifyPrivilegedLogin(username: string, role: AppUserRole) {
  if (typeof window === "undefined") return
  if (!shouldNotifyPrivilegedLogin(role)) return

  const normalizedRole = role === "admin" ? "Admin" : "Inventory Staff"
  const notificationTitle = "Login successful"
  const notificationBody = `${normalizedRole} ${username} has signed in successfully.`

  if (!("Notification" in window)) return

  if (
    Notification.permission === "default" &&
    !window.localStorage.getItem(LOGIN_NOTIFICATION_PERMISSION_KEY)
  ) {
    window.localStorage.setItem(LOGIN_NOTIFICATION_PERMISSION_KEY, "true")

    try {
      await Notification.requestPermission()
    } catch {
      return
    }
  }

  if (Notification.permission === "granted") {
    new Notification(notificationTitle, {
      body: notificationBody,
      tag: `privileged-login:${role}:${username}`,
    })
  }
}
