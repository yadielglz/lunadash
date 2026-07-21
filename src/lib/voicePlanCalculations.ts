import { getVoicePlanById, type VoicePlanCategory } from './voicePlans'
import type { ProductCategory } from './recurringProducts'

export type VoicePlanCalculation = {
  planId: string
  planName: string
  category: VoicePlanCategory
  lineCount: number
  mrc: number
  nr: number
  effectiveMrcPerLine: number
  saleType: 'new-account' | 'add-a-line' | 'product'
  productCategory: ProductCategory
  accountLineCountBefore: number
  accountLineCountAfter: number
  accountMrcBefore: number
  accountMrcAfter: number
}

function toCents(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('MRC must be a non-negative number.')
  return Math.round(value * 100)
}

function fromCents(value: number): number {
  return value / 100
}

export function getVoicePlanMrc(planId: string, lineCount: number): number {
  const selectedPlan = getVoicePlanById(planId)
  const mrc = selectedPlan.pricingByLineCount[lineCount]
  if (mrc === undefined) {
    throw new Error(`${selectedPlan.name} does not support ${lineCount} voice ${lineCount === 1 ? 'line' : 'lines'}.`)
  }
  return mrc
}

export function calculateNetRevenue(mrc: number): number {
  const mrcCents = toCents(mrc)
  return fromCents(Math.round((mrcCents * 38) / 10))
}

export function calculateEffectiveMrcPerLine(mrc: number, lineCount: number): number {
  if (!Number.isInteger(lineCount) || lineCount <= 0) throw new Error('Voice line count must be a positive whole number.')
  return fromCents(Math.round(toCents(mrc) / lineCount))
}

export function calculateVoicePlanResult(planId: string, lineCount: number): VoicePlanCalculation {
  const selectedPlan = getVoicePlanById(planId)
  const mrc = getVoicePlanMrc(planId, lineCount)
  return {
    planId: selectedPlan.id,
    planName: selectedPlan.name,
    category: selectedPlan.category,
    lineCount,
    mrc,
    nr: calculateNetRevenue(mrc),
    effectiveMrcPerLine: calculateEffectiveMrcPerLine(mrc, lineCount),
    saleType: 'new-account',
    productCategory: 'voice',
    accountLineCountBefore: 0,
    accountLineCountAfter: lineCount,
    accountMrcBefore: 0,
    accountMrcAfter: mrc,
  }
}

export function calculateAddALineResult(planId: string, previousLineCount: number, newLineCount: number): VoicePlanCalculation {
  if (newLineCount <= previousLineCount) throw new Error('The new account line count must be greater than the previous line count.')
  const selectedPlan = getVoicePlanById(planId)
  const accountMrcBefore = getVoicePlanMrc(planId, previousLineCount)
  const accountMrcAfter = getVoicePlanMrc(planId, newLineCount)
  const lineCount = newLineCount - previousLineCount
  const mrc = fromCents(toCents(accountMrcAfter) - toCents(accountMrcBefore))
  if (mrc < 0) throw new Error('The selected tier change does not produce positive incremental MRC.')
  return {
    planId: selectedPlan.id,
    planName: selectedPlan.name,
    category: selectedPlan.category,
    lineCount,
    mrc,
    nr: calculateNetRevenue(mrc),
    effectiveMrcPerLine: calculateEffectiveMrcPerLine(mrc, lineCount),
    saleType: 'add-a-line',
    productCategory: 'voice',
    accountLineCountBefore: previousLineCount,
    accountLineCountAfter: newLineCount,
    accountMrcBefore,
    accountMrcAfter,
  }
}

export function calculateAddALinesByQuantity(planId: string, quantity: number): VoicePlanCalculation {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Add-a-line quantity must be a positive whole number.')
  const selectedPlan = getVoicePlanById(planId)
  if (selectedPlan.addALineMrc === undefined) throw new Error(`${selectedPlan.name} does not have a defined add-a-line rate.`)
  const mrc = fromCents(toCents(selectedPlan.addALineMrc) * quantity)
  return {
    planId: selectedPlan.id,
    planName: selectedPlan.name,
    category: selectedPlan.category,
    lineCount: quantity,
    mrc,
    nr: calculateNetRevenue(mrc),
    effectiveMrcPerLine: selectedPlan.addALineMrc,
    saleType: 'add-a-line',
    productCategory: 'voice',
    accountLineCountBefore: 0,
    accountLineCountAfter: quantity,
    accountMrcBefore: 0,
    accountMrcAfter: mrc,
  }
}
