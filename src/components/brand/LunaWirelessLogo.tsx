import { useUiStore } from '../../store/uiStore'

const LIGHT_LOGO_URL = 'https://i.ibb.co/0VV31yHP/lunawirelesslight.png'
const DARK_LOGO_URL = 'https://i.ibb.co/3yM10KZS/lwirelessdark.png'

export function LunaWirelessLogo({ className = '' }: { className?: string }) {
  const theme = useUiStore((s) => s.theme)
  const logoUrl = theme === 'dark' ? DARK_LOGO_URL : LIGHT_LOGO_URL

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
