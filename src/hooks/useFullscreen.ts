import { useState, useEffect, useCallback } from 'react'

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const enter = useCallback(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])

  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }, [])

  const toggle = useCallback(() => {
    if (document.fullscreenElement) exit()
    else enter()
  }, [enter, exit])

  return { isFullscreen, enter, exit, toggle }
}
