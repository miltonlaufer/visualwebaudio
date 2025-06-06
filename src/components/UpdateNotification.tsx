import React, { useEffect, useState } from 'react'
import { XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface UpdateNotificationProps {
  onClose?: () => void
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateSW, setUpdateSW] = useState<(() => Promise<void>) | null>(null)

  useEffect(() => {
    // Check for service worker support
    if (!('serviceWorker' in navigator)) {
      return
    }

    let registration: ServiceWorkerRegistration | null = null

    // Function to show update notification
    const showUpdateNotification = (updateFunction?: () => Promise<void>) => {
      setIsVisible(true)
      if (updateFunction) {
        setUpdateSW(() => updateFunction)
      }
    }

    // Listen for the Vite PWA update event
    const handleVitePwaUpdate = (event: Event) => {
      const customEvent = event as CustomEvent
      if (customEvent.detail && customEvent.detail.type === 'UPDATE_AVAILABLE') {
        showUpdateNotification(customEvent.detail.updateSW)
      }
    }

    // Set up service worker registration listener
    const setupServiceWorkerListeners = async () => {
      try {
        registration = (await navigator.serviceWorker.getRegistration()) || null
        if (registration) {
          // Check if there's already a waiting service worker
          if (registration.waiting) {
            showUpdateNotification(async () => {
              if (registration?.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' })
                // Wait for controller change and reload
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                  window.location.reload()
                })
              }
            })
          }

          // Listen for new service worker installations
          registration.addEventListener('updatefound', () => {
            const newWorker = registration!.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showUpdateNotification(async () => {
                    if (registration?.waiting) {
                      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
                      navigator.serviceWorker.addEventListener('controllerchange', () => {
                        window.location.reload()
                      })
                    } else {
                      window.location.reload()
                    }
                  })
                }
              })
            }
          })
        }
      } catch (error) {
        console.error('Error setting up service worker update listener:', error)
      }
    }

    // Set up listeners
    window.addEventListener('vite:pwa-update', handleVitePwaUpdate)
    setupServiceWorkerListeners()

    // Periodic check for updates (every 5 minutes in development, 24 hours in production)
    const checkInterval = import.meta.env.DEV ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000
    const interval = setInterval(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) {
          await reg.update()
        }
      } catch (error) {
        console.error('Error checking for updates:', error)
      }
    }, checkInterval)

    return () => {
      window.removeEventListener('vite:pwa-update', handleVitePwaUpdate)
      clearInterval(interval)
    }
  }, [])

  const handleUpdate = async () => {
    setIsUpdating(true)

    try {
      if (updateSW) {
        await updateSW()
      } else {
        // Fallback: try to update manually
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload()
          })
        } else {
          window.location.reload()
        }
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
