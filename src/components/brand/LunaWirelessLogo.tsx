import { useUiStore } from '../../store/uiStore'

const COLORED_LOGO_URL = '/brand/lunawireless-logo-color.png'
const WHITE_LOGO_URL = '/brand/lunawireless-logo-white.png'
const DARK_LOGO_THEMES = ['dark', 'carbon', 'graphite', 'aurora', 'rosewood']

type LogoTone = 'auto' | 'light-surface' | 'dark-surface'

export function LunaWirelessLogo({ className = '', tone = 'auto' }: { className?: string; tone?: LogoTone }) {
  const theme = useUiStore((s) => s.theme)
  const logoUrl = tone === 'light-surface'
      ? COLORED_LOGO_URL
    : tone === 'dark-surface'
      ? WHITE_LOGO_URL
      : DARK_LOGO_THEMES.includes(theme)
        ? WHITE_LOGO_URL
        : COLORED_LOGO_URL

  return (
    <img
      src={logoUrl}
      aria-label="Luna Wireless"
      className={`object-contain ${className}`}
      alt="Luna Wireless"
      loading="eager"
      decoding="async"
    />
  )
}
