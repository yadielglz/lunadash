import type { AccessMode, AccessRole, Tab } from '../store/uiStore'

const ROLE_TABS: Record<AccessRole, Tab[]> = {
  admin: ['home', 'schedule', 'goals', 'settings', 'devices', 'display'],
  manager: ['home', 'schedule', 'goals', 'settings', 'display'],
  employee: ['home', 'schedule'],
  display: ['display'],
}

export function allowedTabsForRole(role: AccessRole | null): Tab[] {
  return role ? ROLE_TABS[role] : ['home']
}

export function canAccessTab(role: AccessRole | null, tab: Tab, mode?: AccessMode) {
  if (tab === 'display' && mode === 'display' && role !== 'employee') return true
  return allowedTabsForRole(role).includes(tab)
}

export function defaultTabForRole(role: AccessRole | null, mode?: AccessMode): Tab {
  if (mode === 'display' && role !== 'employee') return 'display'
  return allowedTabsForRole(role)[0] ?? 'home'
}
