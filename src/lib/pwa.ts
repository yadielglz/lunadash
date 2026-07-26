export function isInstalledPwa() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false

  const iosNavigator = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || iosNavigator.standalone === true
    || document.referrer.startsWith('android-app://')
}
