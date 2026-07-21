import { describe, expect, it } from 'vitest'
import { calculateAddALineResult, calculateAddALinesByQuantity, calculateNetRevenue, calculateVoicePlanResult, getVoicePlanMrc } from './voicePlanCalculations'
import { VOICE_PLANS } from './voicePlans'
import { calculateNRSummary, hasDuplicateSubmission, normalizeNRTrackingEntry, type NRTrackingEntry } from './nrTracking'
import { calculateRecurringProductResult, RECURRING_PRODUCT_PLANS } from './recurringProducts'

const expected: Record<string, Record<number, [number, number]>> = {
  'essentials-savers': { 1: [55, 209], 2: [90, 342] },
  essentials: { 3: [120, 456] },
  'essentials-4x100-offer': { 4: [120, 456], 5: [150, 570], 6: [180, 684] },
  'experience-more': { 1: [90, 342], 2: [150, 570], 3: [185, 703], 4: [220, 836], 5: [255, 969], 6: [290, 1102], 7: [325, 1235], 8: [360, 1368] },
  'better-value': { 3: [155, 589], 4: [190, 722], 5: [225, 855], 6: [260, 988], 7: [295, 1121], 8: [330, 1254] },
  'experience-beyond': { 1: [105, 399], 2: [180, 684], 3: [230, 874], 4: [280, 1064], 5: [330, 1254], 6: [380, 1444], 7: [430, 1634], 8: [480, 1824] },
  'essentials-choice-55': { 1: [50, 190], 2: [70, 266] },
  'experience-more-55-plus': { 1: [75, 285], 2: [110, 418] },
  'experience-beyond-55-plus': { 1: [90, 342], 2: [140, 532] },
  'essentials-military': { 1: [50, 190], 2: [90, 342], 3: [105, 399], 4: [120, 456], 5: [135, 513], 6: [150, 570] },
  'experience-more-military-savings': { 1: [75, 285], 2: [110, 418], 3: [135, 513], 4: [160, 608], 5: [185, 703], 6: [210, 798], 7: [245, 931], 8: [280, 1064] },
  'experience-beyond-military-savings': { 1: [90, 342], 2: [140, 532], 3: [180, 684], 4: [220, 836], 5: [260, 988], 6: [300, 1140], 7: [350, 1330], 8: [400, 1520] },
}

describe('voice plan pricing', () => {
  it('covers every catalog plan and supported line count', () => {
    for (const plan of VOICE_PLANS) {
      expect(expected[plan.id]).toBeDefined()
      expect(Object.keys(expected[plan.id]).map(Number)).toEqual(plan.supportedLineCounts)
      for (const lineCount of plan.supportedLineCounts) {
        const result = calculateVoicePlanResult(plan.id, lineCount)
        expect([result.mrc, result.nr]).toEqual(expected[plan.id][lineCount])
      }
    }
  })

  it.each([
    ['essentials-savers', 3],
    ['better-value', 2],
    ['essentials-4x100-offer', 7],
    ['essentials-military', 8],
  ])('rejects unsupported %s / %i combinations', (planId, lines) => {
    expect(() => getVoicePlanMrc(planId, lines)).toThrow(/does not support/)
  })

  it.each([[50, 190], [90, 342], [185, 703], [230, 874], [10.01, 38.04]])('calculates decimal-safe NR for %s', (mrc, nr) => {
    expect(calculateNetRevenue(mrc)).toBe(nr)
  })

  it('calculates an individual add-a-line contribution from account tiers', () => {
    expect(calculateAddALineResult('experience-more', 2, 3)).toMatchObject({
      saleType: 'add-a-line', lineCount: 1, accountLineCountBefore: 2, accountLineCountAfter: 3,
      accountMrcBefore: 150, accountMrcAfter: 185, mrc: 35, nr: 133,
    })
  })

  it('calculates multiple lines sold as one entry', () => {
    expect(calculateAddALineResult('experience-beyond', 2, 4)).toMatchObject({ lineCount: 2, mrc: 100, nr: 380, effectiveMrcPerLine: 50 })
  })

  it('calculates add-a-lines from the plan rate and requested quantity', () => {
    expect(calculateAddALinesByQuantity('experience-more', 2)).toMatchObject({ lineCount: 2, mrc: 70, nr: 266, effectiveMrcPerLine: 35 })
  })

  it('uses the official Essentials AAL rate', () => {
    expect(calculateAddALinesByQuantity('essentials', 2)).toMatchObject({ lineCount: 2, mrc: 50, nr: 190, effectiveMrcPerLine: 25 })
  })
})

describe('NR tracking integrity', () => {
  const base: NRTrackingEntry = {
    id: 'sale-1', saleId: 'sale-1', createdAt: '2026-07-20T12:00:00.000Z', saleDate: '2026-07-20', source: 'manual',
    category: 'consumer', planId: 'experience-more', planName: 'Experience More', lineCount: 3, mrc: 185, nr: 0,
    saleType: 'new-account', productCategory: 'voice', accountLineCountBefore: 0, accountLineCountAfter: 3, accountMrcBefore: 0, accountMrcAfter: 185, accessoryRevenue: 0,
  }

  it('recalculates NR instead of trusting submitted NR', () => {
    expect(normalizeNRTrackingEntry(base).nr).toBe(703)
    expect(normalizeNRTrackingEntry({ ...base, mrc: 90, nr: 999 }).nr).toBe(342)
  })

  it('calculates totals and averages', () => {
    const summary = calculateNRSummary([normalizeNRTrackingEntry(base), normalizeNRTrackingEntry({ ...base, id: 'sale-2', saleId: 'sale-2', mrc: 50, lineCount: 1 })])
    expect(summary).toEqual({ totalNR: 893, totalMRC: 235, totalSales: 2, totalVoiceLines: 4, averageNRPerSale: 446.5, averageNRPerVoiceLine: 223.25, totalAccessoryRevenue: 0, totalBts: 0, totalHsi: 0 })
  })

  it('handles an empty reporting period', () => {
    expect(calculateNRSummary([])).toEqual({ totalNR: 0, totalMRC: 0, totalSales: 0, totalVoiceLines: 0, averageNRPerSale: 0, averageNRPerVoiceLine: 0, totalAccessoryRevenue: 0, totalBts: 0, totalHsi: 0 })
  })

  it('identifies repeated submission IDs', () => {
    expect(hasDuplicateSubmission([base], 'sale-1')).toBe(true)
    expect(hasDuplicateSubmission([base], 'sale-2')).toBe(false)
  })
})

describe('non-voice recurring products', () => {
  it('calculates every supplied product using MRC x 3.8', () => {
    for (const plan of RECURRING_PRODUCT_PLANS) {
      const result = calculateRecurringProductResult(plan.id, 1)
      expect(result.mrc).toBe(plan.mrc)
      expect(result.nr).toBe(calculateNetRevenue(plan.mrc))
      expect(result.productCategory).toBe(plan.category)
    }
  })

  it('multiplies product MRC and quantity before deriving NR', () => {
    expect(calculateRecurringProductResult('tablet-unlimited-plus', 2)).toMatchObject({ lineCount: 2, mrc: 60, nr: 228, productCategory: 'tablet' })
  })
})
