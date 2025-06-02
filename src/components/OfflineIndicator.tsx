import React, { useEffect, useState } from 'react'
import { SignalSlashIcon } from '@heroicons/react/24/outline'

const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) {
    return null // Don't show anything when online
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="bg-orange-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2 text-sm">
        <SignalSlashIcon className="h-4 w-4" />
        <span>Offline Mode</span>
      </div>
    </div>
  )
}

export default OfflineIndicator
