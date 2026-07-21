export const VOICE_PLAN_CATEGORIES = ['consumer', '55-plus', 'military-first-responder'] as const

export type VoicePlanCategory = typeof VOICE_PLAN_CATEGORIES[number]

export type VoicePlan = {
  id: string
  name: string
  category: VoicePlanCategory
  eligibility?: string
  supportedLineCounts: number[]
  pricingByLineCount: Record<number, number>
  taxesIncluded?: boolean | null
  active: boolean
  notes?: string[]
  addALineMrc?: number
}

export type VoicePlanPricingVersion = {
  id: string
  planId: string
  effectiveFrom: string
  effectiveTo?: string | null
  pricingByLineCount: Record<number, number>
}

export const VOICE_PLAN_CATEGORY_LABELS: Record<VoicePlanCategory, string> = {
  consumer: 'Consumer',
  '55-plus': '55+',
  'military-first-responder': 'Military & First Responders',
}

function plan(
  id: string,
  name: string,
  category: VoicePlanCategory,
  pricingByLineCount: Record<number, number>,
  eligibility?: string,
  notes?: string[],
  addALineMrc?: number,
): VoicePlan {
  return {
    id,
    name,
    category,
    eligibility,
    supportedLineCounts: Object.keys(pricingByLineCount).map(Number).sort((a, b) => a - b),
    pricingByLineCount,
    taxesIncluded: null,
    active: true,
    notes,
    addALineMrc,
  }
}

export const VOICE_PLANS: readonly VoicePlan[] = [
  plan('essentials-savers', 'Essentials Savers', 'consumer', { 1: 55, 2: 90 }, undefined, undefined, 35),
  plan('essentials', 'Essentials', 'consumer', { 3: 120 }, undefined, ['Currently available for the provided 3-line configuration.'], 25),
  plan('essentials-4x100-offer', 'Essentials 4x100 Offer', 'consumer', { 4: 120, 5: 150, 6: 180 }, undefined, undefined, 30),
  plan('experience-more', 'Experience More', 'consumer', { 1: 90, 2: 150, 3: 185, 4: 220, 5: 255, 6: 290, 7: 325, 8: 360 }, undefined, undefined, 35),
  plan('better-value', 'Better Value', 'consumer', { 3: 155, 4: 190, 5: 225, 6: 260, 7: 295, 8: 330 }, undefined, undefined, 35),
  plan('experience-beyond', 'Experience Beyond', 'consumer', { 1: 105, 2: 180, 3: 230, 4: 280, 5: 330, 6: 380, 7: 430, 8: 480 }, undefined, undefined, 50),
  plan('essentials-choice-55', 'Essentials Choice 55', '55-plus', { 1: 50, 2: 70 }, 'Qualified 55+ customer', undefined, 20),
  plan('experience-more-55-plus', 'Experience More 55+', '55-plus', { 1: 75, 2: 110 }, 'Qualified 55+ customer', undefined, 35),
  plan('experience-beyond-55-plus', 'Experience Beyond 55+', '55-plus', { 1: 90, 2: 140 }, 'Qualified 55+ customer', undefined, 50),
  plan('essentials-military', 'Essentials Military', 'military-first-responder', { 1: 50, 2: 90, 3: 105, 4: 120, 5: 135, 6: 150 }, 'Qualified military or first-responder customer', undefined, 15),
  plan('experience-more-military-savings', 'Experience More w/Military Savings', 'military-first-responder', { 1: 75, 2: 110, 3: 135, 4: 160, 5: 185, 6: 210, 7: 245, 8: 280 }, 'Qualified military or first-responder customer', undefined, 25),
  plan('experience-beyond-military-savings', 'Experience Beyond w/Military Savings', 'military-first-responder', { 1: 90, 2: 140, 3: 180, 4: 220, 5: 260, 6: 300, 7: 350, 8: 400 }, 'Qualified military or first-responder customer', undefined, 40),
]

export function getVoicePlanById(planId: string): VoicePlan {
  const found = VOICE_PLANS.find((item) => item.id === planId && item.active)
  if (!found) throw new Error(`Unknown or inactive voice plan: ${planId}`)
  return found
}

export function getAvailablePlans(category: VoicePlanCategory): VoicePlan[] {
  return VOICE_PLANS.filter((item) => item.active && item.category === category)
}

export function getSupportedLineCounts(planId: string): number[] {
  return [...getVoicePlanById(planId).supportedLineCounts]
}
