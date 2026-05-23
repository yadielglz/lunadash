import { ClockWidget } from '../../widgets/ClockWidget'
import { WeatherWidget } from '../../widgets/WeatherWidget'
import { PerformancePage } from './PerformancePage'

export function SalesHomeDashboard() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="grid flex-shrink-0 grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(360px,1fr)_minmax(360px,1fr)]">
        <div className="h-[190px] min-w-0">
          <ClockWidget />
        </div>
        <div className="h-[190px] min-w-0">
          <WeatherWidget />
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <PerformancePage />
      </div>
    </div>
  )
}
