import {
  demoDeviceCheckedThisMonth,
  isDemoDeviceActivated,
  type DemoDevice,
} from '../../../lib/demoDevices'
import { deviceLabelTitle, imeiDigits, renderBarcodeSvg } from '../../../lib/demoBarcode'

function escapeHtml(value: string) {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type BuildParams = {
  devices: DemoDevice[]
  storeLabel: string
  storeId: string
}

function printWindow(html: string, name: string) {
  const win = window.open('about:blank', name, 'width=1200,height=800')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()

  const printAfterLayout = () => {
    win.focus()
    const fontsReady = win.document.fonts?.ready ?? Promise.resolve()
    fontsReady.finally(() => {
      win.requestAnimationFrame(() => {
        win.requestAnimationFrame(() => win.print())
      })
    })
  }

  if (win.document.readyState === 'complete') printAfterLayout()
  else win.addEventListener('load', printAfterLayout, { once: true })
  return true
}

function metaLine(params: BuildParams) {
  const generatedAt = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  return `<div class="meta subtle"><div>${escapeHtml(params.storeLabel)}</div><div>Store ID: ${escapeHtml(params.storeId || 'DEFAULT')}</div><div>Generated ${escapeHtml(generatedAt)}</div></div>`
}

/* ---------- Audit report ---------- */

const REPORT_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; color: #111827; font-family: "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background: #eef2f7; }
  main { width: 11in; min-height: 8.5in; margin: 0 auto; padding: 0.45in; background: #fff; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 16px; }
  h1 { margin: 0; font-size: 24px; }
  h2 { margin: 24px 0 8px; font-size: 14px; }
  .subtle { color: #64748b; font-size: 12px; }
  .meta { text-align: right; line-height: 1.5; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
  .tile { border: 1px solid #d8dee8; border-radius: 8px; padding: 12px; min-height: 78px; }
  .label { color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .value { margin-top: 8px; font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; color: #64748b; font-size: 9px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding: 8px 6px; }
  td { border-bottom: 1px solid #e5e7eb; padding: 8px 6px; font-size: 10.5px; vertical-align: top; }
  .mono { font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
  .name { font-weight: 700; color: #111827; }
  .pill { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
  .pill.ok { background: #dcfce7; color: #166534; }
  .pill.warn { background: #fef3c7; color: #92400e; }
  .pill.mute { background: #eef2f7; color: #475569; }
  footer { margin-top: 22px; color: #64748b; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  @media print {
    @page { size: landscape; margin: 0.35in; }
    body { background: #fff; }
    main { width: auto; min-height: auto; margin: 0; padding: 0; }
    tr { break-inside: avoid; }
  }
`

function statusPill(device: DemoDevice) {
  const raw = device.activationStatus || (isDemoDeviceActivated(device) ? 'Active' : 'Unverified')
  const tone = /active/i.test(raw) ? 'ok' : /attention|damage/i.test(raw) ? 'warn' : 'mute'
  return `<span class="pill ${tone}">${escapeHtml(raw)}</span>`
}

export function openDemoAuditReport(params: BuildParams) {
  const { devices } = params
  const activated = devices.filter(isDemoDeviceActivated).length
  const audited = devices.filter((device) => demoDeviceCheckedThisMonth(device.lastChecked)).length
  const pending = devices.filter((device) => !demoDeviceCheckedThisMonth(device.lastChecked))
  const matches = devices.filter((device) => device.informationMatches === 'Yes').length

  const sorted = [...devices].sort((a, b) => deviceLabelTitle(a).localeCompare(deviceLabelTitle(b)))

  const rows = sorted.map((device) => `<tr>
    <td class="name">${escapeHtml(deviceLabelTitle(device))}</td>
    <td class="mono">${escapeHtml(device.mdn || '—')}</td>
    <td class="mono">${escapeHtml(device.imei || '—')}</td>
    <td>${escapeHtml(device.account || 'Demo Line')}</td>
    <td>${statusPill(device)}</td>
    <td>${escapeHtml(device.informationMatches || 'Pending')}</td>
    <td class="mono">${escapeHtml(device.lastChecked || '—')}</td>
    <td>${escapeHtml(device.checkedBy || '—')}</td>
    <td>${escapeHtml(device.notes || '')}</td>
  </tr>`).join('')

  const pendingBlock = pending.length > 0
    ? `<h2>Needs Audit This Cycle (${pending.length})</h2>
       <table><thead><tr><th>Device</th><th>Phone (MDN)</th><th>IMEI</th><th>Last Checked</th><th>Notes</th></tr></thead>
       <tbody>${pending.map((device) => `<tr>
         <td class="name">${escapeHtml(deviceLabelTitle(device))}</td>
         <td class="mono">${escapeHtml(device.mdn || '—')}</td>
         <td class="mono">${escapeHtml(device.imei || '—')}</td>
         <td class="mono">${escapeHtml(device.lastChecked || 'Never')}</td>
         <td>${escapeHtml(device.notes || '')}</td>
       </tr>`).join('')}</tbody></table>`
    : ''

  const html = `<!doctype html><html><head><meta charset="utf-8" />
    <title>Demo Device Audit Report</title><style>${REPORT_CSS}</style></head>
    <body><main>
      <header>
        <div><h1>Demo Device Audit Report</h1><div class="subtle">Store fleet &amp; inventory</div></div>
        ${metaLine(params)}
      </header>
      <section class="summary">
        <div class="tile"><div class="label">Total Lines</div><div class="value">${devices.length}</div></div>
        <div class="tile"><div class="label">Activated</div><div class="value">${activated}</div></div>
        <div class="tile"><div class="label">Audited This Month</div><div class="value">${audited}/${devices.length}</div></div>
        <div class="tile"><div class="label">Info Matches Sheet</div><div class="value">${matches}/${devices.length}</div></div>
      </section>
      ${pendingBlock}
      <h2>All Demo Lines (${devices.length})</h2>
      <table>
        <thead><tr>
          <th>Device</th><th>Phone (MDN)</th><th>IMEI</th><th>Account</th>
          <th>Activation</th><th>Info Matches</th><th>Last Checked</th><th>Checked By</th><th>Notes</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <footer>Source: live demo-device Google Sheet. "Audited this month" compares the sheet's Last Checked month to the current month.</footer>
    </main></body></html>`

  return printWindow(html, 'lunadash-demo-report')
}

/* ---------- Barcode label sheet ---------- */

const LABEL_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; color: #111827; font-family: "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background: #eef2f7; }
  main { width: 8.5in; margin: 0 auto; padding: 0.4in; background: #fff; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 16px; }
  h1 { margin: 0; font-size: 20px; }
  .subtle { color: #64748b; font-size: 12px; }
  .meta { text-align: right; line-height: 1.5; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .label { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; break-inside: avoid; text-align: center; }
  .label .title { font-size: 12px; font-weight: 800; }
  .label .mdn { font-size: 11px; color: #475569; font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace; margin-top: 2px; }
  .label svg { display: block; margin: 6px auto 0; max-width: 100%; }
  @media print {
    @page { size: portrait; margin: 0.35in; }
    body { background: #fff; }
    main { width: auto; margin: 0; padding: 0; }
    .grid { gap: 10px; }
  }
`

export function openDemoBarcodeLabels(params: BuildParams) {
  const sorted = [...params.devices].sort((a, b) => deviceLabelTitle(a).localeCompare(deviceLabelTitle(b)))

  const cells = sorted.map((device) => {
    const svg = renderBarcodeSvg(device.imei, { height: 54, width: 2, fontSize: 13 })
    if (!svg) return ''
    return `<div class="label">
      <div class="title">${escapeHtml(deviceLabelTitle(device))}</div>
      <div class="mdn">${escapeHtml(device.mdn || 'No MDN')}</div>
      ${svg}
      <div class="mdn">IMEI ${escapeHtml(imeiDigits(device.imei))}</div>
    </div>`
  }).filter(Boolean).join('')

  const html = `<!doctype html><html><head><meta charset="utf-8" />
    <title>Demo IMEI Barcode Labels</title><style>${LABEL_CSS}</style></head>
    <body><main>
      <header>
        <div><h1>Demo IMEI Barcode Labels</h1><div class="subtle">${sorted.length} label${sorted.length === 1 ? '' : 's'} · CODE 128</div></div>
        ${metaLine(params)}
      </header>
      <div class="grid">${cells}</div>
    </main></body></html>`

  return printWindow(html, 'lunadash-demo-labels')
}
