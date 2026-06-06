import type { AccessMode, AccessRole, Tab } from '../store/uiStore'

const ROLE_TABS: Record<AccessRole, Tab[]> = {
  admin: ['home', 'employees', 'schedule', 'goals', 'updates', 'settings', 'devices', 'display'],
  district_manager: ['home', 'employees', 'schedule', 'goals', 'updates', 'settings', 'display'],
  manager: ['home', 'employees', 'schedule', 'goals', 'updates', 'settings', 'display'],
  employee: ['home', 'schedule', 'goals', 'settings', 'display'],
  display: ['display'],
}

export function allowedTabsForRole(role: AccessRole | null): Tab[] {
  return role ? ROLE_TABS[role] : ['home']
}

export function canAccessTab(role: AccessRole | null, tab: Tab, mode?: AccessMode) {
  if (tab === 'display' && mode === 'display') return true
  return allowedTabsForRole(role).includes(tab)
}

export function defaultTabForRole(role: AccessRole | null, mode?: AccessMode): Tab {
  if (mode === 'display') return 'display'
  return allowedTabsForRole(role)[0] ?? 'home'
}
