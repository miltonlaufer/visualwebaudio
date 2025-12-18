/**
 * JSON Repair Utilities
 * Used for fallback mode when providers don't support tool calling
 */
import { z } from 'zod'
import { BatchActionSchema } from '~/services/AudioGraphToolService'

/******************* JSON EXTRACTION ***********************/

/**
 * Extract JSON from text that may contain markdown code blocks or prose
 */
export function extractJSON(text: string): string {
  let result = text.trim()

  // Remove markdown code blocks
  result = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '')

  // Try to find JSON object with "actions" key
  let jsonMatch = result.match(/\{[\s\S]*"actions"[\s\S]*\}/)
  if (jsonMatch) {
    return jsonMatch[0]
  }

  // Try to find a JSON array
  jsonMatch = result.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    return jsonMatch[0]
  }

  // Try to find any JSON object
  jsonMatch = result.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return jsonMatch[0]
  }

  return result
}

/******************* JSON REPAIR FUNCTIONS ***********************/

/**
 * Fix smart quotes (curly quotes from word processors)
 */
export function fixSmartQuotes(json: string): string {
  return json
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/[\u2013\u2014]/g, '-') // En/em dashes
}

/**
 * Fix unquoted property names
 */
export function fixUnquotedKeys(json: string): string {
  // Match unquoted keys followed by colon
  // Be careful not to match inside strings
  return json.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
}

/**
 * Remove trailing commas before closing brackets/braces
 */
export function fixTrailingCommas(json: string): string {
  return json.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']')
}

/**
 * Balance brackets and braces for truncated JSON
 */
export function balanceBrackets(json: string): string {
  let result = json

  // Count unbalanced brackets
  const openBraces = (result.match(/\{/g) || []).length
  const closeBraces = (result.match(/\}/g) || []).length
  const openBrackets = (result.match(/\[/g) || []).length
  const closeBrackets = (result.match(/\]/g) || []).length

  // Add missing closing brackets
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    result += ']'
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    result += '}'
  }

  return result
}

/**
 * Remove non-printable characters
 */
export function removeNonPrintable(json: string): string {
  return json.replace(/[^\x20-\x7E\n\r\t]/g, '')
}

/**
 * Fix common JSON syntax errors
 */
export function fixCommonErrors(json: string): string {
  let result = json

  // Fix single quotes used as string delimiters
  // This is tricky - only replace if it looks like a JSON string
  result = result.replace(/'([^']*)'(\s*[,:\]}])/g, '"$1"$2')

  // Fix missing commas between array elements or object properties
  // Look for } { or ] [ without comma
  result = result.replace(/\}\s*\{/g, '},{')
  result = result.replace(/\]\s*\[/g, '],[')

  // Fix double commas
  result = result.replace(/,,+/g, ',')

  return result
}

/******************* MAIN REPAIR PIPELINE ***********************/

/**
 * Attempt to repair malformed JSON
 */
export function repairJSON(rawText: string): string {
  let json = extractJSON(rawText)
  json = fixSmartQuotes(json)
  json = removeNonPrintable(json)
  json = fixUnquotedKeys(json)
  json = fixTrailingCommas(json)
  json = fixCommonErrors(json)
  json = balanceBrackets(json)
  return json
}

/******************* PARSING AND VALIDATION ***********************/

/**
 * Schema for the JSON response format used in fallback mode
 */
const FallbackResponseSchema = z.object({
  actions: z.array(BatchActionSchema),
})

/**
 * Alternative: direct array of actions
 */
const FallbackArraySchema = z.array(BatchActionSchema)

export interface ParseResult {
  success: boolean
  actions: z.infer<typeof BatchActionSchema>[]
  error?: string
  rawJSON?: string
}

/**
 * Parse and validate JSON response from AI
 */
export function parseAndValidateJSON(rawText: string): ParseResult {
  // Try to repair the JSON first
  const repairedJSON = repairJSON(rawText)

  try {
    const parsed = JSON.parse(repairedJSON)

    // Try object with actions array
    if (parsed.actions && Array.isArray(parsed.actions)) {
      const validated = FallbackResponseSchema.safeParse(parsed)
      if (validated.success) {
        return {
          success: true,
          actions: validated.data.actions,
          rawJSON: repairedJSON,
        }
      }
      // Partial success - some actions may be valid
      const validActions = parsed.actions.filter((action: unknown) => {
        const result = BatchActionSchema.safeParse(action)
        return result.success
      })
      if (validActions.length > 0) {
        return {
          success: true,
          actions: validActions,
          rawJSON: repairedJSON,
          error: `Parsed ${validActions.length}/${parsed.actions.length} actions (some were invalid)`,
        }
      }
    }

    // Try direct array format
    if (Array.isArray(parsed)) {
      const validated = FallbackArraySchema.safeParse(parsed)
      if (validated.success) {
        return {
          success: true,
          actions: validated.data,
          rawJSON: repairedJSON,
        }
      }
      // Partial success
      const validActions = parsed.filter((action: unknown) => {
        const result = BatchActionSchema.safeParse(action)
        return result.success
      })
      if (validActions.length > 0) {
        return {
          success: true,
          actions: validActions,
          rawJSON: repairedJSON,
          error: `Parsed ${validActions.length}/${parsed.length} actions (some were invalid)`,
        }
      }
    }

    return {
      success: false,
      actions: [],
      error: 'JSON does not contain valid actions array',
      rawJSON: repairedJSON,
    }
  } catch (parseError) {
    // Try more aggressive repair
    try {
      const aggressiveRepair = aggressiveJSONRepair(repairedJSON)
      const parsed = JSON.parse(aggressiveRepair)

      if (parsed.actions && Array.isArray(parsed.actions)) {
        const validActions = parsed.actions.filter((action: unknown) => {
          const result = BatchActionSchema.safeParse(action)
          return result.success
        })
        if (validActions.length > 0) {
          return {
            success: true,
            actions: validActions,
            rawJSON: aggressiveRepair,
            error: 'Used aggressive repair',
          }
        }
      }

      if (Array.isArray(parsed)) {
        const validActions = parsed.filter((action: unknown) => {
          const result = BatchActionSchema.safeParse(action)
          return result.success
        })
        if (validActions.length > 0) {
          return {
            success: true,
            actions: validActions,
            rawJSON: aggressiveRepair,
            error: 'Used aggressive repair',
          }
        }
      }
    } catch {
      // Aggressive repair also failed
    }

    return {
      success: false,
      actions: [],
      error: `JSON parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      rawJSON: repairedJSON,
    }
  }
}

/**
 * More aggressive JSON repair for severely malformed JSON
 */
function aggressiveJSONRepair(json: string): string {
  const result = json

  // Try to extract individual action objects and rebuild
  const actionPattern = /\{\s*"type"\s*:\s*"[^"]+"\s*[^}]*\}/g
  const matches = result.match(actionPattern)

  if (matches && matches.length > 0) {
    // Try to parse each match individually and collect valid ones
    const validActions: string[] = []
    for (const match of matches) {
      try {
        // Try to fix this individual action
        let fixed = match
        fixed = fixSmartQuotes(fixed)
        fixed = fixUnquotedKeys(fixed)
        fixed = fixTrailingCommas(fixed)

        // Validate it parses
        JSON.parse(fixed)
        validActions.push(fixed)
      } catch {
        // Skip invalid action
      }
    }

    if (validActions.length > 0) {
      return `{"actions":[${validActions.join(',')}]}`
    }
  }

  return result
}

/**
 * Extract text content from AI response (for display to user)
 * Strips out JSON blocks but keeps explanatory text
 */
export function extractTextContent(rawResponse: string): string {
  let text = rawResponse

  // Remove JSON code blocks
  text = text.replace(/```json[\s\S]*?```/gi, '')
  text = text.replace(/```[\s\S]*?```/g, '')

  // Remove standalone JSON objects/arrays
  text = text.replace(/\{[\s\S]*"actions"[\s\S]*\}/g, '')
  text = text.replace(/\[[\s\S]*"type"[\s\S]*\]/g, '')

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim()

  return text
}
