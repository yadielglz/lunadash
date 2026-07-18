import { LunaWirelessLogo } from '../brand/LunaWirelessLogo'

type DashboardLoaderProps = {
  label?: string
}

export function DashboardLoader({ label = 'Preparing dashboard' }: DashboardLoaderProps) {
  return (
    <div className="dashboard-loader h-full w-full" role="status" aria-live="polite">
      <div className="dashboard-loader-orb">
        <div className="dashboard-loader-ring dashboard-loader-ring-one" />
        <div className="dashboard-loader-ring dashboard-loader-ring-two" />
        <div className="dashboard-loader-logo">
          <LunaWirelessLogo className="h-14 w-28" />
        </div>
      </div>
      <div className="mt-6 text-center">
        <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">Syncing the latest store view</p>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <span className="dashboard-loader-dot" />
          <span className="dashboard-loader-dot dashboard-loader-dot-delay-1" />
          <span className="dashboard-loader-dot dashboard-loader-dot-delay-2" />
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  )
}
