import type { ScheduleBlock } from '../store/scheduleBlocksStore'

const NON_COVERAGE_BLOCK_PATTERN = /\b(vacation|pto|sick)\b/i

export function scheduleBlockCountsTowardCoverage(block: ScheduleBlock | undefined, shiftType: string) {
  if (block?.countsTowardCoverage === false) return false
  return !NON_COVERAGE_BLOCK_PATTERN.test(block?.name ?? shiftType)
}
