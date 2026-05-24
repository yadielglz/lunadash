import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/google-sans/latin-400.css'
import '@fontsource/google-sans/latin-500.css'
import '@fontsource/google-sans/latin-600.css'
import '@fontsource/google-sans/latin-700.css'
import './styles/global.css'
import App from './App.tsx'

const CHUNK_RELOAD_KEY = 'luna-chunk-reload-at'

function isChunkLoadError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value ?? '')
  return /error loading dynamically imported module|failed to fetch dynamically imported module|importing a module script failed/i.test(message)
}

function reloadForFreshAssets() {
  const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0)
  if (Date.now() - lastReload < 30_000) return
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
  window.location.reload()
}

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) reloadForFreshAssets()
})

window.addEventListener('error', (event) => {
  if (isChunkLoadError(event.error ?? event.message)) reloadForFreshAssets()
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
