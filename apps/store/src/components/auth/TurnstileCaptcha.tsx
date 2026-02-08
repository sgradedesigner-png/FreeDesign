import { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'

type TurnstileInstance = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId?: string) => void
  remove?: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileInstance
  }
}

interface TurnstileCaptchaProps {
  token: string | null
  onTokenChange: (token: string | null) => void
  refreshKey?: number
}

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script'

export default function TurnstileCaptcha({
  token,
  onTokenChange,
  refreshKey = 0,
}: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [scriptError, setScriptError] = useState(false)

  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

  useEffect(() => {
    if (!siteKey) return

    if (window.turnstile) {
      setIsLoaded(true)
      return
    }

    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript) {
      const handleLoad = () => setIsLoaded(true)
      const handleError = () => setScriptError(true)
      existingScript.addEventListener('load', handleLoad)
      existingScript.addEventListener('error', handleError)

      return () => {
        existingScript.removeEventListener('load', handleLoad)
        existingScript.removeEventListener('error', handleError)
      }
    }

    const script = document.createElement('script')
    script.id = TURNSTILE_SCRIPT_ID
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => setIsLoaded(true)
    script.onerror = () => setScriptError(true)
    document.head.appendChild(script)
  }, [siteKey])

  useEffect(() => {
    if (!siteKey || !isLoaded || !window.turnstile || !containerRef.current || widgetIdRef.current) {
      return
    }

    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: 'auto',
      callback: (newToken: string) => onTokenChange(newToken),
      'expired-callback': () => onTokenChange(null),
      'error-callback': () => onTokenChange(null),
    })

    widgetIdRef.current = widgetId

    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current)
      }
      widgetIdRef.current = null
    }
  }, [isLoaded, onTokenChange, siteKey])

  useEffect(() => {
    if (!widgetIdRef.current || !window.turnstile) return
    window.turnstile.reset(widgetIdRef.current)
    onTokenChange(null)
  }, [refreshKey, onTokenChange])

  if (!siteKey) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          CAPTCHA is enabled in Supabase. Set `VITE_TURNSTILE_SITE_KEY` in store `.env`.
        </AlertDescription>
      </Alert>
    )
  }

  if (scriptError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Unable to load CAPTCHA. Please disable ad blocker and retry.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} />
      {!token && (
        <p className="text-xs text-muted-foreground">Complete CAPTCHA before continuing.</p>
      )}
    </div>
  )
}

