import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css' // ✅ ЭНЭ МӨР ХАМГИЙН ЧУХАЛ (CSS холбож байна)

// Environment validation and Sentry initialization
import { validateEnv } from './lib/env'
import { initSentry } from './lib/sentry'

// Validate environment variables before app starts
// This prevents silent failures due to missing configuration
validateEnv()

// Initialize Sentry error tracking
// Only enabled in production or when VITE_SENTRY_ENABLED=true
initSentry()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
    },
  },
})

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
