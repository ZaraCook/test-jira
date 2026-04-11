export function buildApiErrorMessage(error?: string, details?: string, fallback = 'Request failed'): string {
  const detailText = details ? ` (${details})` : ''
  return (error || fallback) + detailText
}
