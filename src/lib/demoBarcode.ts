import JsBarcode from 'jsbarcode'
import type { DemoDevice } from './demoDevices'

/** Digits-only view of an IMEI string (strips spaces, dashes, stray characters). */
export function imeiDigits(value: string) {
  return (value ?? '').replace(/\D/g, '')
}

/** IMEIs are 14-16 digit numeric strings; anything shorter will not scan reliably. */
export function isScannableImei(value: string) {
  return imeiDigits(value).length >= 8
}

type BarcodeOptions = {
  height?: number
  width?: number
  fontSize?: number
  displayValue?: boolean
  margin?: number
}

/**
 * Render a CODE128 barcode for the given value as a standalone SVG markup string.
 * Used to embed scannable IMEI barcodes inside printable report / label HTML.
 */
export function renderBarcodeSvg(value: string, options: BarcodeOptions = {}) {
  const digits = imeiDigits(value)
  if (!digits) return ''
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  try {
    JsBarcode(svg, digits, {
      format: 'CODE128',
      width: options.width ?? 2,
      height: options.height ?? 60,
      displayValue: options.displayValue ?? true,
      fontSize: options.fontSize ?? 14,
      fontOptions: 'bold',
      textMargin: 2,
      margin: options.margin ?? 8,
      background: '#ffffff',
      lineColor: '#111827',
    })
  } catch {
    return ''
  }
  return new XMLSerializer().serializeToString(svg)
}

/** Draw a CODE128 barcode for a live DOM <svg> element (detail-pane preview). */
export function drawBarcodeInto(target: SVGSVGElement, value: string, options: BarcodeOptions = {}) {
  const digits = imeiDigits(value)
  if (!digits) {
    target.replaceChildren()
    return false
  }
  try {
    JsBarcode(target, digits, {
      format: 'CODE128',
      width: options.width ?? 2,
      height: options.height ?? 56,
      displayValue: options.displayValue ?? true,
      fontSize: options.fontSize ?? 13,
      fontOptions: 'bold',
      textMargin: 2,
      margin: options.margin ?? 6,
      background: 'transparent',
      lineColor: 'currentColor',
    })
    return true
  } catch {
    target.replaceChildren()
    return false
  }
}

export function deviceLabelTitle(device: DemoDevice) {
  const name = [device.make, device.model].filter((part) => part && part !== '-').join(' ').trim()
  return name || 'Unassigned Demo'
}
