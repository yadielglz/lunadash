import { useUiStore } from '../store/uiStore'

/** Convert Celsius to Fahrenheit */
export function cToF(c: number): number {
  return Math.round(c * 9 / 5 + 32)
}

/** Format a temperature (from API, which always returns °C) to the user's preferred unit */
export function useTempDisplay() {
  const { tempUnit, toggleTempUnit } = useUiStore()

  const fmt = (celsius: number) =>
    tempUnit === 'F' ? cToF(celsius) : Math.round(celsius)

  const unit = tempUnit === 'F' ? '°F' : '°C'

  return { fmt, unit, tempUnit, toggleTempUnit }
}
