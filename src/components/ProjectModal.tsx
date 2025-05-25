import React, { useState, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { getSnapshot, applySnapshot } from 'mobx-state-tree'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'

interface ProjectModalProps {
  store: AudioGraphStoreType
  isOpen: boolean
  onClose: () => void
}

const ProjectModal: React.FC<ProjectModalProps> = observer(({ store, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export')
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleExport = () => {
    try {
      // Get snapshot of the store
      const snapshot = getSnapshot(store)

      // Create a clean export object with only the necessary data
      const exportData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        visualNodes: snapshot.visualNodes,
        visualEdges: snapshot.visualEdges,
        audioConnections: snapshot.audioConnections,
      }

      // Create and download the file
      const dataStr = JSON.stringify(exportData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)

      const link = document.createElement('a')
      link.href = url
      link.download = `visual-web-audio-project-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(url)

      console.log('Project exported successfully')
    } catch (error) {
      console.error('Export failed:', error)
      setImportError('Export failed: ' + (error as Error).message)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = e => {
      try {
        const content = e.target?.result as string
        const importData = JSON.parse(content)

        // Validate the import data structure
        if (!importData.visualNodes || !importData.visualEdges || !importData.audioConnections) {
          throw new Error('Invalid project file format. Missing required fields.')
        }

        // Clear existing project
        store.clearAllNodes()

        // Apply the imported data
        const newSnapshot = {
          ...getSnapshot(store),
          visualNodes: importData.visualNodes,
          visualEdges: importData.visualEdges,
          audioConnections: importData.audioConnections,
        }

        applySnapshot(store, newSnapshot)

        // Recreate the audio graph
        store.recreateAudioGraph()

        setImportSuccess(true)
        setImportError(null)

        console.log('Project imported successfully')

        // Auto-close after success
        setTimeout(() => {
          setImportSuccess(false)
          onClose()
        }, 2000)
      } catch (error) {
        console.error('Import failed:', error)
        setImportError('Import failed: ' + (error as Error).message)
        setImportSuccess(false)
      }
    }

    reader.readAsText(file)
  }

  const handleImportClick = () => {
    setImportError(null)
    setImportSuccess(false)
    fileInputRef.current?.click()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Project Manager</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Export Project
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'import'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Import Project
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'export' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Export your current project as a JSON file that can be imported later.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Current Project</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Nodes: {store.visualNodes.length}</div>
                  <div>Connections: {store.visualEdges.length}</div>
                </div>
              </div>

              <button
                onClick={handleExport}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Download Project File
              </button>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Import a previously exported project file. This will replace your current project.
              </p>

              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{importError}</p>
                </div>
              )}

              {importSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-600">Project imported successfully!</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                onClick={handleImportClick}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Select Project File
              </button>

              <div className="text-xs text-gray-500">
                <p>⚠️ Warning: Importing will replace your current project.</p>
                <p>Make sure to export your current work first if you want to keep it.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default ProjectModal
