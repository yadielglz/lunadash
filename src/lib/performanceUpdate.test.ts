import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    functions: { invoke },
  },
}))

import { updatePerformanceSheet } from './performanceUpdate'

describe('updatePerformanceSheet', () => {
  beforeEach(() => {
    invoke.mockReset()
    invoke.mockResolvedValue({
      data: { message: 'Updated', storeCode: '1234' },
      error: null,
    })
  })

  it('sends grouped tracker updates as top-level function fields', async () => {
    await updatePerformanceSheet({
      accessId: 'access-id',
      accessRole: 'manager',
      storeCode: '1234',
      updates: { traffic: 16 },
    })

    expect(invoke).toHaveBeenCalledWith('update-performance-sheet', {
      body: {
        accessId: 'access-id',
        accessRole: 'manager',
        storeCode: '1234',
        traffic: 16,
      },
    })
  })

  it('keeps explicit top-level values when both payload styles are supplied', async () => {
    await updatePerformanceSheet({
      accessId: 'access-id',
      accessRole: 'manager',
      storeCode: '1234',
      traffic: 17,
      updates: { traffic: 16, vl: 2 },
    })

    expect(invoke).toHaveBeenCalledWith('update-performance-sheet', {
      body: {
        accessId: 'access-id',
        accessRole: 'manager',
        storeCode: '1234',
        traffic: 17,
        vl: 2,
      },
    })
  })
})
