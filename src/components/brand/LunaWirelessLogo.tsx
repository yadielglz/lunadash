import { useUiStore } from '../../store/uiStore'

const COLORED_LOGO_URL = 'https://i.ibb.co/0VV31yHP/lunawirelesslight.png'
const WHITE_LOGO_URL = 'https://i.ibb.co/3yM10KZS/lwirelessdark.png'

type LogoTone = 'auto' | 'light-surface' | 'dark-surface'

export function LunaWirelessLogo({ className = '', tone = 'auto' }: { className?: string; tone?: LogoTone }) {
  const theme = useUiStore((s) => s.theme)
  const logoUrl = tone === 'light-surface'
    ? COLORED_LOGO_URL
    : tone === 'dark-surface'
      ? WHITE_LOGO_URL
      : theme === 'dark' || theme === 'vista'
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
