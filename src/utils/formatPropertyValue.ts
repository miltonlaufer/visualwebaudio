/**
 * Format Property Value Utility
 *
 * Formats property values for display in the UI, handling numeric precision
 * appropriately based on the property type.
 */

/**
 * Properties that should show decimal precision (2 decimal places)
 */
const DECIMAL_PROPERTIES = ['frequency', 'gain', 'detune', 'Q', 'playbackRate']

/**
 * Formats a property value for display in the UI.
 *
 * @param value - The value to format
 * @param propertyName - The name of the property (used to determine formatting)
 * @returns Formatted string representation of the value
 *
 * @example
 * formatPropertyValue(440.123456, 'frequency') // "440.12"
 * formatPropertyValue(0.5, 'gain') // "0.50"
 * formatPropertyValue(100, 'value') // "100"
 * formatPropertyValue('sine', 'type') // "sine"
 */
export function formatPropertyValue(value: unknown, propertyName: string): string {
  if (value === undefined || value === null) return ''

  // Format numeric values appropriately
  if (typeof value === 'number') {
    // Properties that should show decimal precision
    if (
      DECIMAL_PROPERTIES.includes(propertyName) ||
      propertyName.toLowerCase().includes('frequency')
    ) {
      return value.toFixed(2)
    }
    // For integer-like values, show without decimals if whole number
    if (Number.isInteger(value)) {
      return value.toString()
    }
    return value.toFixed(2)
  }

  return String(value)
}

/**
 * Checks if a property should be displayed with decimal precision
 */
export function shouldShowDecimals(propertyName: string): boolean {
  return (
    DECIMAL_PROPERTIES.includes(propertyName) || propertyName.toLowerCase().includes('frequency')
  )
}
