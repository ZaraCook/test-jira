import type { JiraIssueDetails } from '../types'

export type FormattedFieldEntry = {
  key: string
  label: string
  valueText: string
  preview: string
  fieldType: string
}

function stringifyFieldValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  if (typeof value === 'string') {
    return value.trim() ? value : '(empty string)'
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function friendlyFieldLabel(key: string): string {
  if (/^customfield_\d+$/i.test(key)) {
    return `Custom Field (${key.replace(/customfield_/i, '')})`
  }

  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function summarizeFieldValue(value: unknown): string {
  if (value === null || value === undefined) return 'Not set'

  if (typeof value === 'string') {
    return value.trim() || 'Not set'
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return 'None'

    const compact = value
      .slice(0, 4)
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'name' in item && typeof item.name === 'string') {
          return item.name
        }
        return JSON.stringify(item)
      })
      .join(', ')

    return value.length > 4 ? `${compact} +${value.length - 4} more` : compact
  }

  if (typeof value === 'object') {
    const namedValue = value as { name?: string; value?: string; displayName?: string }
    if (namedValue.displayName) return namedValue.displayName
    if (namedValue.name) return namedValue.name
    if (namedValue.value) return namedValue.value
    return 'Structured value'
  }

  return 'Value available'
}

function detectFieldType(value: unknown): string {
  if (value === null || value === undefined) return 'empty'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  return typeof value
}

export function getFormattedFieldEntries(
  selectedIssueDetails: JiraIssueDetails | null,
  fieldSearch: string,
): FormattedFieldEntry[] {
  if (!selectedIssueDetails) {
    return []
  }

  const search = fieldSearch.trim().toLowerCase()

  return Object.entries(selectedIssueDetails.rawFields)
    .map(([key, value]) => {
      const valueText = stringifyFieldValue(value)
      const compactPreview = valueText.replace(/\s+/g, ' ').trim()
      const preview = compactPreview.length > 140 ? `${compactPreview.slice(0, 140)}...` : compactPreview

      return {
        key,
        label: friendlyFieldLabel(key),
        valueText,
        preview: preview || summarizeFieldValue(value),
        fieldType: detectFieldType(value),
      }
    })
    .filter((entry) => {
      if (!search) return true
      return (
        entry.key.toLowerCase().includes(search) ||
        entry.label.toLowerCase().includes(search) ||
        entry.preview.toLowerCase().includes(search)
      )
    })
    .sort((a, b) => a.key.localeCompare(b.key))
}
