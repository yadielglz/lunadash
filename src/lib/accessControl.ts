import type { AccessMode, AccessRole, Tab } from '../store/uiStore'

const ROLE_TABS: Record<AccessRole, Tab[]> = {
  admin: ['home', 'district', 'employees', 'schedule', 'appointments', 'tasks', 'goals', 'commission', 'reports', 'updates', 'settings', 'devices', 'display'],
  district_manager: ['home', 'district', 'employees', 'schedule', 'appointments', 'tasks', 'devices', 'goals', 'commission', 'reports', 'updates', 'settings', 'display'],
  manager: ['home', 'district', 'employees', 'schedule', 'appointments', 'tasks', 'devices', 'goals', 'commission', 'reports', 'updates', 'settings', 'display'],
  employee: ['home', 'district', 'schedule', 'appointments', 'tasks', 'goals', 'commission', 'reports', 'settings', 'display'],
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
