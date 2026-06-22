import { useRef, useState } from 'react'
import { addDays, format } from 'date-fns'
import { Camera, Printer } from 'lucide-react'
import { toPng } from 'html-to-image'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { useDisplayStore } from '../../../store/displayStore'
import { useScheduleStore, Shift } from '../../../store/scheduleStore'
import { useScheduleBlocksStore } from '../../../store/scheduleBlocksStore'
import { useSchedulePreferencesStore } from '../../../store/schedulePreferencesStore'
import { formatShiftTime, hexToRgba, timeToMinutes } from '../../../lib/utils'

interface PrintableScheduleModalProps {
  open: boolean
  onClose: () => void
  weekStart: Date
}

const DESKTOP_SCHEDULE_CAPTURE_WIDTH = 980

function shiftHours(shift: Shift) {
  const start = timeToMinutes(shift.startTime)
  const end = timeToMinutes(shift.endTime)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  const minutes = end >= start ? end - start : (24 * 60 - start) + end
  if (minutes <= 0 || minutes > 14 * 60) return null
  return minutes / 60
}

function formatHours(hours: number) {
  return hours.toFixed(hours % 1 === 0 ? 0 : 1)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function isMobilePrintSurface() {
  return window.matchMedia('(max-width: 767px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function PrintableScheduleModal({ open, onClose, weekStart }: PrintableScheduleModalProps) {
  const captureRef = useRef<HTMLDivElement>(null)
  const [capturing, setCapturing] = useState(false)
  const [captureMessage, setCaptureMessage] = useState('')
  const { companyName, storeNumber } = useDisplayStore()
  const { employees, shifts } = useScheduleStore()
  const blocks = useScheduleBlocksStore((s) => s.blocks)
  const showShiftNames = useSchedulePreferencesStore((s) => s.showShiftNames)
  const showShiftNotes = useSchedulePreferencesStore((s) => s.showShiftNotes)
  const showEmployeeRoles = useSchedulePreferencesStore((s) => s.showEmployeeRoles)
  const compactSchedule = useSchedulePreferencesStore((s) => s.compactSchedule)

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const dates = days.map((day) => format(day, 'yyyy-MM-dd'))
  const blockColors = new Map(blocks.map((block) => [block.name, block.color]))
  const weekShifts = shifts.filter((shift) => dates.includes(shift.date))
  const scheduledEmployees = employees.filter((employee) =>
    weekShifts.some((shift) => shift.employeeId === employee.id)
  )
  const displayedEmployees = scheduledEmployees.length > 0 ? scheduledEmployees : employees
  const shiftHourValues = weekShifts.map(shiftHours)
  const canShowHours = shiftHourValues.every((hours) => hours !== null)
  const totalHours = canShowHours ? shiftHourValues.reduce((sum, hours) => sum + (hours ?? 0), 0) : null
  const scheduleTitle = `${companyName || 'Luna Store'} Schedule ${format(weekStart, 'MMM d')}-${format(addDays(weekStart, 6), 'MMM d, yyyy')}`
  const fileName = `${scheduleTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`

  const print = () => {
    if (isMobilePrintSurface()) {
      window.print()
      return
    }

    const header = `
      <div class="schedule-header">
        <div>
          <div class="eyebrow">Weekly Schedule</div>
          <h1>${escapeHtml(companyName || 'Luna Store')}</h1>
          <p>${storeNumber ? `Store ${escapeHtml(storeNumber)} · ` : ''}${format(weekStart, 'MMMM d')} - ${format(addDays(weekStart, 6), 'MMMM d, yyyy')}</p>
        </div>
        <div class="summary">
          <strong>${weekShifts.length} shifts</strong>
          ${canShowHours && totalHours !== null ? `<span>${formatHours(totalHours)} scheduled hours</span>` : ''}
          <small>Printed ${format(new Date(), 'MMM d, yyyy h:mm a')}</small>
        </div>
      </div>
    `

    const dayHeaders = days.map((day) => `
      <th>
        <span>${format(day, 'EEE')}</span>
        <strong>${format(day, 'd')}</strong>
      </th>
    `).join('')

    const rows = displayedEmployees.map((employee) => {
      const employeeShifts = weekShifts.filter((shift) => shift.employeeId === employee.id)
      const employeeHours = canShowHours ? employeeShifts.reduce((sum, shift) => sum + (shiftHours(shift) ?? 0), 0) : null
      const cells = days.map((day) => {
        const date = format(day, 'yyyy-MM-dd')
        const dayShifts = employeeShifts.filter((shift) => shift.date === date)
        if (dayShifts.length === 0) return '<td><div class="off">Off</div></td>'

        const shiftCards = dayShifts.map((shift) => {
          const color = blockColors.get(shift.type) ?? employee.color
          return `
            <div class="shift" style="background:${hexToRgba(color, 0.1)};border-color:${hexToRgba(color, 0.28)};">
              ${showShiftNames ? `<div class="shift-name" style="color:${color};">${escapeHtml(shift.type)}</div>` : ''}
              <div class="shift-time">${formatShiftTime(shift.startTime, shift.endTime)}</div>
              ${showShiftNotes && shift.note ? `<div class="shift-note">${escapeHtml(shift.note)}</div>` : ''}
            </div>
          `
        }).join('')

        return `<td>${shiftCards}</td>`
      }).join('')

      return `
        <tr>
          <td class="employee">
            <div class="employee-name"><span style="background:${employee.color};"></span>${escapeHtml(employee.name)}</div>
            ${showEmployeeRoles ? `<div class="employee-role">${escapeHtml(employee.role)}</div>` : ''}
            ${employeeHours !== null ? `<div class="employee-hours">${formatHours(employeeHours)} hrs</div>` : ''}
          </td>
          ${cells}
        </tr>
      `
    }).join('')

    const emptyState = displayedEmployees.length === 0
      ? '<div class="empty">No employees or shifts are scheduled for this week.</div>'
      : ''

    const html = `
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(scheduleTitle)}</title>
          <style>
            @page { size: landscape; margin: 0.35in; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #0f172a;
              background: #fff;
              font-family: "SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page { padding: 0; }
            .schedule-header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              align-items: flex-start;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 14px;
              margin-bottom: 14px;
            }
            .eyebrow {
              color: #64748b;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.18em;
              text-transform: uppercase;
            }
            h1 { margin: 4px 0 0; font-size: 25px; line-height: 1.15; }
            p { margin: 6px 0 0; color: #64748b; font-size: 13px; }
            .summary { text-align: right; display: grid; gap: 3px; color: #64748b; font-size: 13px; }
            .summary strong { color: #0f172a; font-size: 14px; }
            .summary small { color: #94a3b8; margin-top: 4px; }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              border: 1px solid #e2e8f0;
            }
            th {
              background: #f1f5f9;
              border-left: 1px solid #e2e8f0;
              padding: 8px 6px;
              text-align: center;
            }
            th:first-child { border-left: 0; width: 190px; text-align: left; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
            th span { display: block; color: #475569; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
            th strong { display: block; color: #0f172a; font-size: 18px; line-height: 1.1; }
            td {
              min-height: ${compactSchedule ? '58px' : '78px'};
              vertical-align: top;
              border-top: 1px solid #e2e8f0;
              border-left: 1px solid #e2e8f0;
              padding: ${compactSchedule ? '5px' : '7px'};
            }
            td:first-child { border-left: 0; }
            .employee { width: 190px; }
            .employee-name {
              display: flex;
              gap: 7px;
              align-items: flex-start;
              color: #0f172a;
              font-size: 12px;
              line-height: 1.2;
              font-weight: 800;
              overflow-wrap: anywhere;
            }
            .employee-name span { width: 9px; height: 9px; margin-top: 2px; border-radius: 999px; flex: 0 0 auto; }
            .employee-role { margin-top: 3px; color: #64748b; font-size: 10px; line-height: 1.2; overflow-wrap: anywhere; }
            .employee-hours { margin-top: 8px; color: #475569; font-size: 10px; font-weight: 800; }
            .shift {
              border: 1px solid;
              border-radius: 6px;
              padding: ${compactSchedule ? '4px 6px' : '6px 7px'};
              margin-bottom: 5px;
              break-inside: avoid;
            }
            .shift-name { font-size: 11px; font-weight: 900; line-height: 1.15; }
            .shift-time { margin-top: 2px; color: #334155; font-size: 10px; font-weight: 800; }
            .shift-note { margin-top: 2px; color: #64748b; font-size: 9px; line-height: 1.25; }
            .off {
              display: flex;
              min-height: 58px;
              align-items: center;
              justify-content: center;
              color: #cbd5e1;
              font-size: 11px;
              font-weight: 700;
            }
            .empty {
              margin-top: 32px;
              border: 1px dashed #cbd5e1;
              border-radius: 8px;
              padding: 32px;
              text-align: center;
              color: #64748b;
              font-size: 13px;
            }
          </style>
        </head>
        <body>
          <main class="page">
            ${header}
            ${displayedEmployees.length > 0 ? `<table><thead><tr><th>Team</th>${dayHeaders}</tr></thead><tbody>${rows}</tbody></table>` : emptyState}
          </main>
        </body>
      </html>
    `

    const printWindow = window.open('about:blank', 'lunadash-schedule-print', 'width=1200,height=800')
    if (!printWindow) return
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()

    const printAfterLayout = () => {
      printWindow.focus()
      const fontsReady = printWindow.document.fonts?.ready ?? Promise.resolve()
      fontsReady.finally(() => {
        printWindow.requestAnimationFrame(() => {
          printWindow.requestAnimationFrame(() => {
            printWindow.print()
          })
        })
      })
    }

    if (printWindow.document.readyState === 'complete') {
      printAfterLayout()
    } else {
      printWindow.addEventListener('load', printAfterLayout, { once: true })
    }
  }

  const capture = async () => {
    const captureNode = captureRef.current
    if (!captureNode || capturing) return

    setCapturing(true)
    setCaptureMessage('')
    const captureWidth = Math.max(captureNode.scrollWidth, DESKTOP_SCHEDULE_CAPTURE_WIDTH)
    const stagedNode = captureNode.cloneNode(true) as HTMLDivElement
    const stagingFrame = document.createElement('div')
    try {
      Object.assign(stagedNode.style, {
        backgroundColor: '#ffffff',
        boxSizing: 'border-box',
        maxWidth: 'none',
        minWidth: `${DESKTOP_SCHEDULE_CAPTURE_WIDTH}px`,
        width: `${captureWidth}px`,
      })
      Object.assign(stagingFrame.style, {
        backgroundColor: '#ffffff',
        left: '0',
        pointerEvents: 'none',
        position: 'fixed',
        top: '0',
        width: `${captureWidth}px`,
        zIndex: '-1',
      })
      stagingFrame.appendChild(stagedNode)
      document.body.appendChild(stagingFrame)

      await document.fonts?.ready
      await new Promise((resolve) => window.requestAnimationFrame(resolve))
      await new Promise((resolve) => window.requestAnimationFrame(resolve))

      const dataUrl = await toPng(stagedNode, {
        cacheBust: true,
        width: captureWidth,
        height: stagedNode.scrollHeight,
        pixelRatio: Math.min(window.devicePixelRatio || 2, 3),
        backgroundColor: '#ffffff',
      })
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const file = new File([blob], fileName, { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: scheduleTitle,
          text: `${scheduleTitle} captured from LunaDash.`,
        })
        setCaptureMessage('Schedule image shared.')
        return
      }

      const link = document.createElement('a')
      link.href = dataUrl
      link.download = fileName
      link.click()
      setCaptureMessage('Schedule image saved.')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setCaptureMessage('Schedule image could not be captured.')
    } finally {
      stagingFrame.remove()
      setCapturing(false)
      window.setTimeout(() => setCaptureMessage(''), 2400)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Print Schedule" size="full">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--text-secondary)]">
            Preview for {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {captureMessage && (
              <span className={`text-xs ${captureMessage.includes('could not') ? 'text-red-400' : 'text-[var(--accent)]'}`}>
                {captureMessage}
              </span>
            )}
            <Button variant="secondary" icon={<Camera size={14} />} loading={capturing} onClick={capture}>
              Full Week Capture
            </Button>
            <Button variant="primary" icon={<Printer size={14} />} onClick={print}>
              Print / Save PDF
            </Button>
          </div>
        </div>

        <div className="print-schedule-area overflow-auto rounded-xl border border-[var(--border)] bg-white text-slate-950">
          <div ref={captureRef} className="print-schedule-page min-w-[980px] bg-white p-6">
            <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Weekly Schedule</div>
                <h1 className="mt-1 text-2xl font-bold text-slate-950">{companyName || 'Luna Store'}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  {storeNumber ? `Store ${storeNumber} · ` : ''}
                  {format(weekStart, 'MMMM d')} - {format(addDays(weekStart, 6), 'MMMM d, yyyy')}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-950">{weekShifts.length} shifts</div>
                {canShowHours && totalHours !== null && <div className="text-sm text-slate-500">{formatHours(totalHours)} scheduled hours</div>}
                <div className="mt-2 text-[11px] text-slate-400">Printed {format(new Date(), 'MMM d, yyyy h:mm a')}</div>
              </div>
            </div>

            <div className="mt-4 grid border border-slate-200" style={{ gridTemplateColumns: '210px repeat(7, minmax(110px, 1fr))' }}>
              <div className="bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">Team</div>
              {days.map((day) => (
                <div key={day.toISOString()} className="border-l border-slate-200 bg-slate-100 px-3 py-2 text-center">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-600">{format(day, 'EEE')}</div>
                  <div className="text-lg font-bold leading-tight text-slate-950">{format(day, 'd')}</div>
                </div>
              ))}

              {displayedEmployees.map((employee) => {
                const employeeShifts = weekShifts.filter((shift) => shift.employeeId === employee.id)
                const employeeHours = canShowHours ? employeeShifts.reduce((sum, shift) => sum + (shiftHours(shift) ?? 0), 0) : null

                return (
                  <div key={employee.id} className="contents">
                    <div className="border-t border-slate-200 px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: employee.color }} />
                      <div className="min-w-0">
                          <div className="text-sm font-bold leading-snug text-slate-950 break-words">{employee.name}</div>
                          {showEmployeeRoles && <div className="text-[11px] leading-snug text-slate-500 break-words">{employee.role}</div>}
                        </div>
                      </div>
                      {employeeHours !== null && (
                        <div className="mt-2 text-[11px] font-semibold text-slate-500">
                          {formatHours(employeeHours)} hrs
                        </div>
                      )}
                    </div>

                    {days.map((day) => {
                      const date = format(day, 'yyyy-MM-dd')
                      const dayShifts = employeeShifts.filter((shift) => shift.date === date)

                      return (
                        <div key={`${employee.id}-${date}`} className={`${compactSchedule ? 'min-h-[64px] p-1.5' : 'min-h-[86px] p-2'} border-l border-t border-slate-200`}>
                          {dayShifts.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-xs font-medium text-slate-300">Off</div>
                          ) : (
                            <div className="space-y-1.5">
                              {dayShifts.map((shift) => {
                                const color = blockColors.get(shift.type) ?? employee.color
                                return (
                                  <div
                                    key={shift.id}
                                    className="rounded-md border px-2 py-1.5"
                                    style={{ background: hexToRgba(color, 0.1), borderColor: hexToRgba(color, 0.28) }}
                                  >
                                    {showShiftNames && <div className="text-xs font-bold" style={{ color }}>{shift.type}</div>}
                                    <div className="text-[11px] font-semibold text-slate-700">{formatShiftTime(shift.startTime, shift.endTime)}</div>
                                    {showShiftNotes && shift.note && <div className="mt-0.5 text-[10px] text-slate-500">{shift.note}</div>}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {displayedEmployees.length === 0 && (
              <div className="mt-10 rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                No employees or shifts are scheduled for this week.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
