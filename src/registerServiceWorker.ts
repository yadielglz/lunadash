export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) return

  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        void registration.update()

        const refreshOnReturn = () => {
          if (document.visibilityState === 'visible') void registration.update()
        }
        document.addEventListener('visibilitychange', refreshOnReturn)
      })
      .catch((error) => {
        console.warn('LunaDash service worker registration failed:', error)
      })
  })
}
