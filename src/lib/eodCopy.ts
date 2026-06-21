import { formatMoney, formatNumber, type PerformanceRow } from './performanceSheet'

function formatEodDate(date = new Date()) {
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.toLocaleDateString('en-US', { day: '2-digit' })
  const year = date.toLocaleDateString('en-US', { year: '2-digit' })
  return `${month} ${day} '${year}`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function eodCopyContent(row: PerformanceRow) {
  const dateLabel = formatEodDate()
  const metricLines = [
    `Voice Lines : ${formatNumber(row.vl)}`,
    `BTS: ${formatNumber(row.bts)}`,
    `HSI: ${formatNumber(row.hsi)}`,
    `Net Revenue: ${formatMoney(row.netRevenue)}`,
    `Accessories: ${formatMoney(row.accessoryRevenue)}`,
    ...(row.visa > 0 ? [`VISA: ${formatNumber(row.visa)}`] : []),
    `Store Traffic: ${formatNumber(row.traffic)}`,
  ]
  const plainText = [
    `**${row.storeCode} EOD**`,
    `*${dateLabel}*`,
    '',
    ...metricLines,
  ].join('\n')
  const html = [
    `<div><strong>${escapeHtml(row.storeCode)} EOD</strong></div>`,
    `<div><em>${escapeHtml(dateLabel)}</em></div>`,
    '<br>',
    ...metricLines.map((line) => `<div>${escapeHtml(line)}</div>`),
  ].join('')

  return { plainText, html }
}

export async function copyEodToClipboard(row: PerformanceRow) {
  const { plainText, html } = eodCopyContent(row)

  if (navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      }),
    ])
    return
  }

  await navigator.clipboard.writeText(plainText)
}
