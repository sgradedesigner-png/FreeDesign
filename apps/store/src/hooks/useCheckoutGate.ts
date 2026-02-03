import { useState, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'

/**
 * Hook to protect checkout flow - requires authentication
 *
 * Usage:
 * const { checkAuthAndProceed, showAuthModal, setShowAuthModal, onAuthSuccess } = useCheckoutGate()
 *
 * <Button onClick={() => checkAuthAndProceed(() => navigate('/checkout'))}>
 *   Proceed to Checkout
 * </Button>
 *
 * <AuthModal
 *   isOpen={showAuthModal}
 *   onClose={() => setShowAuthModal(false)}
 *   onSuccess={onAuthSuccess}
 * />
 */
export function useCheckoutGate() {
  const { user, session } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const callbackRef = useRef<(() => void) | null>(null)

  /**
   * Check if user is authenticated and proceed with checkout
   * If not authenticated, show AuthModal and save callback
   *
   * @param callback - Function to execute after successful authentication
   */
  const checkAuthAndProceed = (callback: () => void) => {
    // Check if user is authenticated
    if (!user || !session) {
      // Not authenticated - save callback and show modal
      callbackRef.current = callback
      setShowAuthModal(true)
    } else {
      // Already authenticated - proceed immediately
      callback()
    }
  }

  /**
   * Called after successful authentication
   * Executes the saved callback and closes the modal
   */
  const onAuthSuccess = () => {
    setShowAuthModal(false)

    // Execute the saved callback
    if (callbackRef.current) {
      callbackRef.current()
      callbackRef.current = null // Clear callback
    }
  }

  return {
    checkAuthAndProceed,
    showAuthModal,
    setShowAuthModal,
    onAuthSuccess,
  }
}
