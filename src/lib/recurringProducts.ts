import { calculateEffectiveMrcPerLine, calculateNetRevenue, type VoicePlanCalculation } from './voicePlanCalculations'

export const PRODUCT_CATEGORIES = ['voice', 'home-internet', 'tablet', 'watch', 'hotspot'] as const
export type ProductCategory = typeof PRODUCT_CATEGORIES[number]

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  voice: 'Voice',
  'home-internet': 'Home Internet',
  tablet: 'Tablet',
  watch: 'Watch',
  hotspot: 'Hotspot',
}

export type RecurringProductPlan = {
  id: string
  name: string
  category: Exclude<ProductCategory, 'voice'>
  mrc: number
  active: boolean
  notes?: string[]
}

export const RECURRING_PRODUCT_PLANS: readonly RecurringProductPlan[] = [
  { id: 'rely-home-internet', name: 'Rely Home Internet', category: 'home-internet', mrc: 60, active: true },
  { id: 'amplified-home-internet', name: 'Amplified Home Internet', category: 'home-internet', mrc: 70, active: true },
  { id: 'all-in-home-internet', name: 'All-In Home Internet', category: 'home-internet', mrc: 80, active: true },
  { id: 'away-unlimited-plan', name: 'AWAY Unlimited Plan', category: 'home-internet', mrc: 165, active: true, notes: ['Additional Home Internet plan'] },
  { id: 'home-internet-backup', name: 'Home Internet Backup', category: 'home-internet', mrc: 25, active: true, notes: ['Additional Home Internet plan'] },
  { id: 'tablet-essentials', name: 'Essentials', category: 'tablet', mrc: 20, active: true },
  { id: 'tablet-unlimited', name: 'Unlimited', category: 'tablet', mrc: 25, active: true },
  { id: 'tablet-unlimited-plus', name: 'Unlimited Plus', category: 'tablet', mrc: 30, active: true },
  { id: 'watch-plan', name: 'Watch Plan', category: 'watch', mrc: 15, active: true },
  { id: 'watch-plan-plus', name: 'Plan Plus', category: 'watch', mrc: 20, active: true },
  { id: 'watch-plan-with-beyond', name: 'Plan w/Beyond', category: 'watch', mrc: 10, active: true },
  { id: 'hotspot-5gb', name: '5GB Data Plan', category: 'hotspot', mrc: 10, active: true },
  { id: 'hotspot-25gb', name: '25GB Data Plan', category: 'hotspot', mrc: 30, active: true },
  { id: 'hotspot-100gb', name: '100GB Data Plan', category: 'hotspot', mrc: 55, active: true },
]

export function getRecurringProductPlans(category: Exclude<ProductCategory, 'voice'>) {
  return RECURRING_PRODUCT_PLANS.filter((plan) => plan.active && plan.category === category)
}

export function getRecurringProductPlan(planId: string) {
  const plan = RECURRING_PRODUCT_PLANS.find((item) => item.id === planId && item.active)
  if (!plan) throw new Error(`Unknown or inactive recurring product: ${planId}`)
  return plan
}

export function calculateRecurringProductResult(planId: string, quantity: number): VoicePlanCalculation {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Product quantity must be a positive whole number.')
  const plan = getRecurringProductPlan(planId)
  const mrc = plan.mrc * quantity
  return {
    planId: plan.id,
    planName: plan.name,
    category: 'consumer',
    productCategory: plan.category,
    lineCount: quantity,
    mrc,
    nr: calculateNetRevenue(mrc),
    effectiveMrcPerLine: calculateEffectiveMrcPerLine(mrc, quantity),
    saleType: 'product',
    accountLineCountBefore: 0,
    accountLineCountAfter: quantity,
    accountMrcBefore: 0,
    accountMrcAfter: mrc,
  }
}

