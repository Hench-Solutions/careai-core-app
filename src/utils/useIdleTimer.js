import { useEffect, useRef } from 'react'
import { authUtils } from './auth'

const IDLE_MS = 20 * 60 * 1000   // 20 minutes

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart']

export function useIdleTimer() {
  const timerRef = useRef(null)

  useEffect(() => {
    function resetTimer() {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        authUtils.clearSession()
        localStorage.removeItem('careai_menu')
        window.dispatchEvent(new CustomEvent('careai:logout'))
      }, IDLE_MS)
    }

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()  // start timer on mount

    return () => {
      clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [])
}
