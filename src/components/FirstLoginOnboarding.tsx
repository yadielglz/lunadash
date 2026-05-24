import { useState } from 'react'
import { CalendarDays, CheckCircle2, LayoutDashboard, Settings2, Sparkles, UsersRound } from 'lucide-react'
import { dbMarkAccessOnboarded } from '../lib/supabase'
import { accessRoleLabel, useUiStore, type AccessRole } from '../store/uiStore'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { LunaWirelessLogo } from './brand/LunaWirelessLogo'

type Step = {
  kicker: string
  title: string
  body: string
  bullets: string[]
  icon: React.ReactNode
}

const ROLE_COPY: Record<AccessRole, Step[]> = {
  admin: [
    {
      kicker: 'Welcome to LunaDash',
      title: 'Your command center is ready.',
      body: 'This admin session can view the full business, manage stores, and keep access organized from Settings.',
      bullets: ['Use Main to review all active stores.', 'Create managers and store access sessions from Access.'],
      icon: <Sparkles size={22} />,
    },
    {
      kicker: 'Start Here',
      title: 'Dashboard first, settings when needed.',
      body: 'Daily work lives on Dashboard, Schedule, and Performance. System setup lives quietly in Settings.',
      bullets: ['Use the dashboard for current store health.', 'Use Settings to manage users, weather, stores, schedule blocks, and sync.'],
      icon: <LayoutDashboard size={22} />,
    },
    {
      kicker: 'Access',
      title: 'Keep access personal.',
      body: 'Every user should have their own dealer code and PIN so the app can show the correct store and role.',
      bullets: ['Disable old codes instead of sharing them.', 'Use display role for passive TV or monitor screens.'],
      icon: <UsersRound size={22} />,
    },
  ],
  manager: [
    {
      kicker: 'Welcome to LunaDash',
      title: 'Your store workspace is ready.',
      body: 'This manager session is built for the daily rhythm of the store: dashboard, schedule, and performance.',
      bullets: ['Open Dashboard for the day’s pulse.', 'Use Schedule to keep the team aligned.'],
      icon: <Sparkles size={22} />,
    },
    {
      kicker: 'Store Setup',
      title: 'Tune the store from Settings.',
      body: 'Managers can maintain local store details, employees, schedule blocks, and store-level access.',
      bullets: ['Review Source-backed performance during the day.', 'Create store access for your team or display screens.'],
      icon: <Settings2 size={22} />,
    },
    {
      kicker: 'Schedule',
      title: 'Reusable shift blocks save time.',
      body: 'Build named shifts in Settings, then use them while creating the weekly schedule.',
      bullets: ['Weeks can follow the company Thursday to Wednesday flow.', 'Print preview creates a cleaner schedule for posting.'],
      icon: <CalendarDays size={22} />,
    },
  ],
  district_manager: [
    {
      kicker: 'Welcome to LunaDash',
      title: 'Your district workspace is ready.',
      body: 'This district manager session can move between assigned district stores without opening admin-only tools.',
      bullets: ['Use the store selector to focus one location at a time.', 'Review dashboard, schedule, performance, and store setup for the selected store.'],
      icon: <Sparkles size={22} />,
    },
    {
      kicker: 'Store Operations',
      title: 'Work each store in context.',
      body: 'Store data loads after you choose a location, so schedule edits and settings apply to the active store.',
      bullets: ['Switch stores from the title bar when needed.', 'Use Settings for weather, scheduling, store details, and configured stores.'],
      icon: <Settings2 size={22} />,
    },
    {
      kicker: 'Schedule',
      title: 'Keep district coverage aligned.',
      body: 'Reusable shift blocks and weekly tools are available for each selected store.',
      bullets: ['Confirm the selected store before editing.', 'Print preview creates a cleaner schedule for posting.'],
      icon: <CalendarDays size={22} />,
    },
  ],
  employee: [
    {
      kicker: 'Welcome to LunaDash',
      title: 'Your store view is ready.',
      body: 'This store access session keeps the important work visible without extra admin tools in the way.',
      bullets: ['Dashboard shows store status at a glance.', 'Schedule keeps upcoming shifts easy to check.'],
      icon: <Sparkles size={22} />,
    },
    {
      kicker: 'Daily Flow',
      title: 'Use it like a quick station.',
      body: 'Check the dashboard, review the schedule, and stay aware of store performance for the day.',
      bullets: ['Performance is the first thing to watch.', 'Weather lives in Settings when store planning needs it.'],
      icon: <LayoutDashboard size={22} />,
    },
    {
      kicker: 'Security',
      title: 'Your PIN is your lane.',
      body: 'Access is tied to the assigned role and store, so each person should use their own code.',
      bullets: ['Do not share PINs between users.', 'Ask a manager if store access needs to change.'],
      icon: <CheckCircle2 size={22} />,
    },
  ],
  display: [],
}

export function FirstLoginOnboarding() {
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { accessId, accessLabel, accessRole, needsOnboarding, setAccessOnboarded } = useUiStore()

  if (!needsOnboarding || !accessRole || accessRole === 'display') return null

  const steps = ROLE_COPY[accessRole]
  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1

  const finish = async () => {
    if (!accessId) {
      setAccessOnboarded()
      return
    }
    setSaving(true)
    setError('')
    try {
      await dbMarkAccessOnboarded(accessId)
      setAccessOnboarded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish setup.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={() => undefined} size="lg" className="border-[var(--accent)]/25">
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-6 py-4 shadow-sm">
            <LunaWirelessLogo className="h-20 w-56" />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{step.kicker}</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">{step.title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">{step.body}</p>
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">
            {accessLabel || 'New user'} · {accessRoleLabel(accessRole)}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 p-3 text-[var(--accent)]">
              {step.icon}
            </div>
            <div className="grid gap-2">
              {step.bullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-[var(--accent)]" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          {steps.map((item, index) => (
            <button
              key={item.title}
              type="button"
              aria-label={`Go to onboarding step ${index + 1}`}
              onClick={() => setStepIndex(index)}
              className={`h-2.5 rounded-full transition-all ${index === stepIndex ? 'w-8 bg-[var(--accent)]' : 'w-2.5 bg-[var(--border-strong)]'}`}
            />
          ))}
        </div>

        {error && <p className="text-center text-xs text-red-400">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            disabled={stepIndex === 0 || saving}
            onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
          >
            Back
          </Button>
          {isLast ? (
            <Button variant="primary" loading={saving} icon={<CheckCircle2 size={16} />} onClick={finish}>
              Start Using LunaDash
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setStepIndex((index) => Math.min(steps.length - 1, index + 1))}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
