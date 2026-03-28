import { useState, useRef, useEffect } from 'react'
import { ResponsiveGridLayout } from 'react-grid-layout'
import type { Layout, LayoutItem, ResponsiveLayouts } from 'react-grid-layout'
import { motion } from 'framer-motion'
import { Settings2, Check } from 'lucide-react'
import { ClockWidget } from './ClockWidget'
import { WeatherWidget } from './WeatherWidget'
import { ScheduleWidget } from './ScheduleWidget'
import { GoalsWidget } from './GoalsWidget'
import { DeviceSearchWidget } from './DeviceSearchWidget'
import { AnnouncementWidget } from './AnnouncementWidget'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const mkLayout = (items: LayoutItem[]): Layout => items as unknown as Layout

const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: mkLayout([
    { i: 'clock',    x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'weather',  x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'schedule', x: 6, y: 0, w: 4, h: 7, minW: 3, minH: 4 },
    { i: 'goals',    x: 0, y: 4, w: 6, h: 6, minW: 3, minH: 4 },
    { i: 'devices',  x: 6, y: 7, w: 4, h: 5, minW: 3, minH: 4 },
    { i: 'announce', x: 10, y: 0, w: 2, h: 12, minW: 2, minH: 4 },
  ]),
  md: mkLayout([
    { i: 'clock',    x: 0, y: 0, w: 3, h: 4 },
    { i: 'weather',  x: 3, y: 0, w: 3, h: 4 },
    { i: 'schedule', x: 6, y: 0, w: 6, h: 7 },
    { i: 'goals',    x: 0, y: 4, w: 6, h: 6 },
    { i: 'devices',  x: 6, y: 7, w: 6, h: 5 },
    { i: 'announce', x: 0, y: 10, w: 12, h: 5 },
  ]),
  sm: mkLayout([
    { i: 'clock',    x: 0, y: 0, w: 3, h: 4 },
    { i: 'weather',  x: 3, y: 0, w: 3, h: 4 },
    { i: 'schedule', x: 0, y: 4, w: 6, h: 6 },
    { i: 'goals',    x: 0, y: 10, w: 6, h: 5 },
    { i: 'devices',  x: 0, y: 15, w: 6, h: 5 },
    { i: 'announce', x: 0, y: 20, w: 6, h: 5 },
  ]),
  xs: mkLayout([
    { i: 'clock',    x: 0, y: 0, w: 2, h: 4 },
    { i: 'weather',  x: 2, y: 0, w: 2, h: 4 },
    { i: 'schedule', x: 0, y: 4, w: 4, h: 6 },
    { i: 'goals',    x: 0, y: 10, w: 4, h: 5 },
    { i: 'devices',  x: 0, y: 15, w: 4, h: 5 },
    { i: 'announce', x: 0, y: 20, w: 4, h: 5 },
  ]),
}

const STORAGE_KEY = 'luna-widget-layouts'
const ROW_HEIGHT = 42

function loadLayouts(): ResponsiveLayouts | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveLayouts(layouts: ResponsiveLayouts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts))
}

const WIDGETS: Record<string, React.ReactNode> = {
  clock:    <ClockWidget />,
  weather:  <WeatherWidget />,
  schedule: <ScheduleWidget />,
  goals:    <GoalsWidget />,
  devices:  <DeviceSearchWidget />,
  announce: <AnnouncementWidget />,
}

function GridContainer({ isEditing, layouts, onLayoutChange }: {
  isEditing: boolean
  layouts: ResponsiveLayouts
  onLayoutChange: (layout: Layout, layouts: ResponsiveLayouts) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1200)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    obs.observe(containerRef.current)
    setWidth(containerRef.current.offsetWidth)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full">
      <ResponsiveGridLayout
        width={width}
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 900, sm: 600, xs: 0 }}
        cols={{ lg: 12, md: 12, sm: 6, xs: 4 }}
        rowHeight={ROW_HEIGHT}
        margin={[10, 10]}
        containerPadding={[4, 4]}
        onLayoutChange={onLayoutChange}
        dragConfig={{ enabled: isEditing, handle: '.widget-drag-handle' }}
        resizeConfig={{ enabled: isEditing, handles: ['se'] }}
      >
        {Object.entries(WIDGETS).map(([key, widget]) => (
          <div
            key={key}
            className={`relative overflow-hidden rounded-xl ${isEditing ? 'ring-2 ring-[var(--accent)]/40' : ''}`}
          >
            {isEditing && (
              <div className="widget-drag-handle absolute inset-0 z-10 cursor-grab active:cursor-grabbing rounded-xl" />
            )}
            {widget}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  )
}

export function WidgetGrid() {
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(loadLayouts() ?? DEFAULT_LAYOUTS)
  const [isEditing, setIsEditing] = useState(false)

  const handleLayoutChange = (_layout: Layout, all: ResponsiveLayouts) => {
    if (isEditing) {
      setLayouts(all)
      saveLayouts(all)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text)]">Good day! 👋</h1>
          <p className="text-xs text-[var(--text-secondary)]">Here's your workspace overview</p>
        </div>
        <motion.button
          onClick={() => setIsEditing((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isEditing
              ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
              : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)]'
          }`}
          whileTap={{ scale: 0.95 }}
        >
          {isEditing ? <Check size={12} /> : <Settings2 size={12} />}
          {isEditing ? 'Done' : 'Edit layout'}
        </motion.button>
      </div>

      {isEditing && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-2 px-3 py-2 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-xs text-[var(--accent)]"
        >
          Drag widgets to rearrange • Drag corner handle to resize
        </motion.div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <GridContainer
          isEditing={isEditing}
          layouts={layouts}
          onLayoutChange={handleLayoutChange}
        />
      </div>
    </div>
  )
}
