/// <reference types="vite/client" />

interface Window {
  lunadashDesktop?: {
    platform: NodeJS.Platform
    forceUpdateRestart?: () => Promise<{ ok: boolean }>
  }
}
