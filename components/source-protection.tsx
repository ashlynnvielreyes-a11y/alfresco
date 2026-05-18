"use client"

import { useEffect } from "react"

export function SourceProtection() {
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const isViewSourceShortcut =
        (event.ctrlKey && key === "u") ||
        (event.metaKey && event.altKey && key === "u")

      if (isViewSourceShortcut) {
        event.preventDefault()
      }
    }

    window.addEventListener("contextmenu", handleContextMenu)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  return null
}
