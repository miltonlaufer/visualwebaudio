/**
 * Composite Editor Alerts
 *
 * Displays error and success messages in the editor.
 */

import React from 'react'

/******************* TYPES ***********************/

export interface CompositeEditorAlertsProps {
  /** Error message to display */
  error: string | null
  /** Success message to display */
  success: string | null
}

/******************* COMPONENT ***********************/

const CompositeEditorAlerts: React.FC<CompositeEditorAlertsProps> = ({ error, success }) => {
  if (!error && !success) return null

  return (
    <>
      {error && (
        <div className="px-4 py-2 bg-red-100 dark:bg-red-900/50 border-b border-red-200 dark:border-red-800 shrink-0">
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        </div>
      )}
      {success && (
        <div className="px-4 py-2 bg-green-100 dark:bg-green-900/50 border-b border-green-200 dark:border-green-800 shrink-0">
          <p className="text-sm text-green-600 dark:text-green-300">{success}</p>
        </div>
      )}
    </>
  )
}

export default CompositeEditorAlerts
