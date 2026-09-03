import { useEffect, useRef, useState } from 'react'
import { drawBarcodeInto } from '../../../lib/demoBarcode'

type Props = {
  imei: string
  height?: number
}

/** Renders a live CODE128 barcode for an IMEI into an inline SVG element. */
export function DeviceImeiBarcode({ imei, height = 56 }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const ok = drawBarcodeInto(ref.current, imei, { height })
    setFailed(!ok)
  }, [imei, height])

  if (failed) {
    return <span className="py-4 text-xs text-[#64748b]">Could not encode this IMEI.</span>
  }

  return <svg ref={ref} role="img" aria-label={`IMEI barcode ${imei}`} className="max-w-full" />
}
