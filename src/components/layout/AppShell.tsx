import { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TitleBar } from './TitleBar'
import { Taskbar } from './Taskbar'
import { useUiStore } from '../../store/uiStore'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
}

interface AppShellProps {
  children: ReactNode
  activeKey: string
}

export function AppShell({ children, activeKey }: AppShellProps) {
  const { activeTab } = useUiStore()

  // Hide shell when in display mode
  if (activeTab === 'display') {
    return <>{children}</>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TitleBar />
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeKey}
            className="absolute inset-0 overflow-y-auto overflow-x-hidden"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <Taskbar />
    </div>
  )
}
