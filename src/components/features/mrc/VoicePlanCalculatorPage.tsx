import { useState } from 'react'
import { ArrowRight, Calculator, CircleDollarSign, RotateCcw, ShieldCheck, Users } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Select } from '../../ui/Input'
import { InlineNotice, ModuleHeader, PageFrame } from '../../ui/ModulePrimitives'
import { formatMoney } from '../../../lib/performanceSheet'
import { calculateAddALinesByQuantity, calculateVoicePlanResult, getVoicePlanMrc } from '../../../lib/voicePlanCalculations'
import {
  getAvailablePlans,
  getSupportedLineCounts,
  getVoicePlanById,
  VOICE_PLAN_CATEGORIES,
  VOICE_PLAN_CATEGORY_LABELS,
} from '../../../lib/voicePlans'
import { useNRTrackingDraftStore } from '../../../store/nrTrackingDraftStore'
import { useUiStore } from '../../../store/uiStore'
import { calculateRecurringProductResult, getRecurringProductPlans, PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS, type ProductCategory } from '../../../lib/recurringProducts'

export function VoicePlanCalculatorPage() {
  const setTab = useUiStore((state) => state.setTab)
  const setPending = useNRTrackingDraftStore((state) => state.setPending)
  const [productCategory, setProductCategory] = useState<ProductCategory>('voice')
  const [saleType, setSaleType] = useState<'new-account' | 'add-a-line'>('new-account')
  const [planId, setPlanId] = useState('')
  const [lineCount, setLineCount] = useState('')
  const [error, setError] = useState('')

  const supportedLines = productCategory === 'voice' && planId ? getSupportedLineCounts(planId) : []
  const selectedPlan = productCategory === 'voice' && planId ? getVoicePlanById(planId) : null
  const result = planId && lineCount
    ? productCategory !== 'voice'
      ? calculateRecurringProductResult(planId, Number(lineCount))
      : saleType === 'add-a-line'
      ? calculateAddALinesByQuantity(planId, Number(lineCount))
      : calculateVoicePlanResult(planId, Number(lineCount))
    : null

  const reset = () => {
    setSaleType('new-account')
    setProductCategory('voice')
    setPlanId('')
    setLineCount('')
    setError('')
  }

  const changeSaleType = (next: 'new-account' | 'add-a-line') => {
    setSaleType(next)
    setLineCount('')
    setError('')
  }

  const changeProductCategory = (next: ProductCategory) => {
    setProductCategory(next)
    setPlanId('')
    setLineCount('')
    setError('')
  }

  const changePlan = (nextPlanId: string) => {
    setPlanId(nextPlanId)
    setLineCount('')
    setError('')
  }

  const addToTracking = () => {
    if (!result) {
      setError('Choose a voice plan and total voice-line count before adding this sale.')
      return
    }
    setPending(result)
    setTab('nr-tracking')
  }

  return (
    <PageFrame width="wide">
      <ModuleHeader
        icon={<Calculator size={20} />}
        eyebrow="Voice plans"
        title="MRC & NR Calculator"
        description="Calculate voice, Home Internet, tablet, watch, and hotspot sales. NR is derived automatically from MRC × 3.8."
        actions={<Button variant="ghost" icon={<RotateCcw size={14} />} onClick={reset}>Clear</Button>}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]"><Users size={18} /></span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">Plan configuration</h2>
              <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Only supported plan and line-count combinations are available.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <Select label="Product family" value={productCategory} onChange={(event) => changeProductCategory(event.target.value as ProductCategory)}>
              {PRODUCT_CATEGORIES.map((category) => <option key={category} value={category}>{PRODUCT_CATEGORY_LABELS[category]}</option>)}
            </Select>
            {productCategory === 'voice' && <>
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Sale circumstance</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['new-account', 'add-a-line'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`min-h-12 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${saleType === item ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'}`}
                    aria-pressed={saleType === item}
                    onClick={() => changeSaleType(item)}
                  >
                    {item === 'new-account' ? 'New plan sale' : 'Add a line'}
                  </button>
                ))}
              </div>
            </fieldset>

            <Select label="Voice plan" value={planId} onChange={(event) => changePlan(event.target.value)}>
              <option value="">Select a plan</option>
              {VOICE_PLAN_CATEGORIES.map((category) => (
                <optgroup key={category} label={VOICE_PLAN_CATEGORY_LABELS[category]}>
                  {getAvailablePlans(category).map((item) => <option key={item.id} value={item.id} disabled={saleType === 'add-a-line' && item.addALineMrc === undefined}>{item.name}{saleType === 'add-a-line' && item.addALineMrc === undefined ? ' · AAL rate unavailable' : ''}</option>)}
                </optgroup>
              ))}
            </Select>

            {saleType === 'add-a-line' ? (
              <Select label="Number of add-a-lines" value={lineCount} disabled={!selectedPlan?.addALineMrc} onChange={(event) => { setLineCount(event.target.value); setError('') }}>
                <option value="">Select quantity</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count} × {formatMoney(selectedPlan?.addALineMrc ?? 0)}</option>)}
              </Select>
            ) : (
              <Select label="Total voice lines sold" value={lineCount} disabled={!planId} onChange={(event) => { setLineCount(event.target.value); setError('') }}>
                <option value="">{planId ? 'Select total lines' : 'Select a plan first'}</option>
                {supportedLines.map((count) => <option key={count} value={count}>{count} {count === 1 ? 'line' : 'lines'} · {formatMoney(getVoicePlanMrc(planId, count))}</option>)}
              </Select>
            )}
            </>}

            {productCategory !== 'voice' && <>
              <Select label={`${PRODUCT_CATEGORY_LABELS[productCategory]} plan`} value={planId} onChange={(event) => changePlan(event.target.value)}>
                <option value="">Select a plan</option>
                {getRecurringProductPlans(productCategory).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {formatMoney(plan.mrc)}</option>)}
              </Select>
              <Select label="Quantity sold" value={lineCount} disabled={!planId} onChange={(event) => { setLineCount(event.target.value); setError('') }}>
                <option value="">Select quantity</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count}</option>)}
              </Select>
            </>}

            {productCategory === 'voice' && selectedPlan?.eligibility && (
              <InlineNotice tone="info" title="Eligibility required">
                {selectedPlan.eligibility}
              </InlineNotice>
            )}
            {selectedPlan?.notes?.map((note) => <p key={note} className="text-xs text-[var(--text-tertiary)]">{note}</p>)}
            {error && <InlineNotice tone="danger">{error}</InlineNotice>}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><CircleDollarSign size={18} /></span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">Calculation result</h2>
              <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">MRC is the pricing source of truth. NR is never entered independently.</p>
            </div>
          </div>

          {result ? (
            <div className="mt-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <ResultMetric label={result.saleType === 'add-a-line' ? 'Incremental MRC' : 'Monthly Recurring Charge'} value={formatMoney(result.mrc)} tone="accent" />
                <ResultMetric label="Calculated Net Revenue" value={formatMoney(result.nr)} tone="success" />
              </div>
              <dl className="mt-4 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4">
                <ResultRow label="Selected plan" value={result.planName} />
                <ResultRow label="Product family" value={PRODUCT_CATEGORY_LABELS[result.productCategory]} />
                {result.productCategory === 'voice' && <ResultRow label="Customer segment" value={VOICE_PLAN_CATEGORY_LABELS[result.category]} />}
                <ResultRow label="Sale type" value={result.saleType === 'add-a-line' ? 'Add a line' : result.saleType === 'product' ? 'Product activation' : 'New plan sale'} />
                <ResultRow label={result.productCategory === 'voice' ? 'Voice lines sold' : 'Quantity sold'} value={String(result.lineCount)} />
                {result.saleType === 'add-a-line' && <ResultRow label="Plan AAL rate" value={`${formatMoney(result.effectiveMrcPerLine)} per line`} />}
                <ResultRow label="Effective MRC per line" value={formatMoney(result.effectiveMrcPerLine)} />
              </dl>
              <div className="mt-4 flex justify-end">
                <Button variant="primary" icon={<ArrowRight size={15} />} onClick={addToTracking}>Add to NR Tracking</Button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-6 text-center">
              <ShieldCheck size={30} className="text-[var(--text-tertiary)]" />
              <h3 className="mt-3 text-sm font-semibold text-[var(--text)]">Ready to calculate</h3>
              <p className="mt-1 max-w-sm text-xs text-[var(--text-tertiary)]">Choose a product family, plan, and quantity to calculate the sale.</p>
            </div>
          )}
        </Card>
      </div>
    </PageFrame>
  )
}

function ResultMetric({ label, value, tone }: { label: string; value: string; tone: 'accent' | 'success' }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === 'success' ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-[var(--accent)]/25 bg-[var(--accent)]/10'}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
      <div className={`mt-2 text-3xl font-bold tabular-nums ${tone === 'success' ? 'text-emerald-500' : 'text-[var(--accent)]'}`}>{value}</div>
    </div>
  )
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 py-3"><dt className="text-xs text-[var(--text-tertiary)]">{label}</dt><dd className="text-right text-sm font-medium text-[var(--text)]">{value}</dd></div>
}
