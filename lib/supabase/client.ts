import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = "https://mvbluppriemvbmauevxl.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12Ymx1cHByaWVtdmJtYXVldnhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NTY4OTMsImV4cCI6MjA5MTUzMjg5M30.WgVnWylmYCzJ4JGM-pFGaeOQCcRayp_s-z9wDeLUNvc"

export function createClient() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  )
}
