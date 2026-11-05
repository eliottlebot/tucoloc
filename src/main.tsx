import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { SupabaseBackend } from './backend/SupabaseBackend'
import { systemClock } from './clock'

const backend = new SupabaseBackend(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App backend={backend} clock={systemClock} />
  </StrictMode>,
)

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')
