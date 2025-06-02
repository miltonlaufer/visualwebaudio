import React, { useEffect, useState } from 'react'
import { XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface UpdateNotificationProps {
  onClose?: () => void
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    // Check for service worker support
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker) {
      console.log('Service worker not supported')
      return
    }

    // Listen for update messages from service worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
        console.log('Update notification received:', event.data.message)
        setIsVisible(true)
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)

    // Check for updates on component mount
    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration && registration.active) {
          registration.active.postMessage({ type: 'CHECK_FOR_UPDATES' })
        }
      } catch (error) {
        console.error('Error checking for updates:', error)
      }
    }

    // Check immediately and then every 24 hours
    checkForUpdates()
    const interval = setInterval(checkForUpdates, 24 * 60 * 60 * 1000)

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
      clearInterval(interval)
    }
  }, [])

  const handleUpdate = async () => {
    setIsUpdating(true)

    try {
      const registration = await navigator.serviceWorker.getRegistration()

      if (registration && registration.waiting) {
        // There's a waiting service worker, activate it
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })

        // Listen for the controlling service worker to change
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // Reload the page to get the latest version
          window.location.reload()
        })
      } else {
        // No waiting service worker, just reload
        window.location.reload()
      }
    } catch (error) {
      console.error('Error updating app:', error)
      // Fallback: just reload the page
      window.location.reload()
    }
  }

  const handleClose = () => {
    setIsVisible(false)
    onClose?.()
  }

  if (!isVisible) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-blue-600 text-white rounded-lg shadow-lg p-4 border border-blue-700">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <ArrowPathIcon className="h-6 w-6 text-blue-200 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium">Update Available</h3>
              <p className="text-sm text-blue-100 mt-1">
                A new version of Visual Web Audio is available!
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="ml-2 text-blue-200 hover:text-white transition-colors"
            aria-label="Close notification"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex space-x-2">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="flex-1 bg-white text-blue-600 px-3 py-2 rounded text-sm font-medium hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? 'Updating...' : 'Update Now'}
          </button>
          <button
            onClick={handleClose}
            className="px-3 py-2 text-blue-200 hover:text-white text-sm transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}

export default UpdateNotification
