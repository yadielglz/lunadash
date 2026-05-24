export function normalizeAccessCode(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20).toUpperCase()
}

export function normalizeStoreId(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)
  if (!cleaned) return ''
  return cleaned.toLowerCase() === 'main' ? 'main' : cleaned.toUpperCase()
}
