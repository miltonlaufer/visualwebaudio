import React, { useState, useRef, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { getSnapshot, applySnapshot } from 'mobx-state-tree'
import { useOnClickOutside } from 'usehooks-ts'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import { projectOperations, type SavedProject } from '~/utils/database'

interface ProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

const ProjectModal: React.FC<ProjectModalProps> = observer(({ isOpen, onClose }) => {
  const store = useAudioGraphStore()
  const [activeTab, setActiveTab] = useState<'storage' | 'export' | 'import'>('storage')
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<boolean>(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [storageSuccess, setStorageSuccess] = useState<string | null>(null)
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null)
  const [currentProjectName, setCurrentProjectName] = useState<string>('')
  const [showSaveAsDialog, setShowSaveAsDialog] = useState<boolean>(false)
  const [newProjectName, setNewProjectName] = useState<string>('')
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close modal
  useOnClickOutside(modalRef as React.RefObject<HTMLElement>, () => {
    if (isOpen) {
      onClose()
    }
  })

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  // Load saved projects when modal opens
  useEffect(() => {
    if (isOpen && activeTab === 'storage') {
      loadSavedProjects()
    }
  }, [isOpen, activeTab])

  // Reset project state when all nodes are cleared (clear all, new example, etc)
  useEffect(() => {
    if (store.visualNodes.length === 0 && (currentProjectId || currentProjectName)) {
      setCurrentProjectId(null)
      setCurrentProjectName('')
      // Reset modification state when project is cleared
      store.setProjectModified(false)
    }
  }, [store.visualNodes.length, currentProjectId, currentProjectName])

  // Handle beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (store.visualNodes.length > 0 && store.isProjectModified) {
        const message = 'You will lose your changes. Are you sure you want to leave?'
        event.preventDefault()
        event.returnValue = message
        return message
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [store.visualNodes.length, store.isProjectModified])

  const loadSavedProjects = async () => {
    try {
      setLoadingProjects(true)
      const projects = await projectOperations.getAllProjects()
      setSavedProjects(projects)
    } catch (error) {
      setStorageError('Failed to load projects: ' + (error as Error).message)
    } finally {
      setLoadingProjects(false)
    }
  }

  const getCurrentProjectData = () => {
    const snapshot = getSnapshot(store)
    return JSON.stringify({
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      visualNodes: snapshot.visualNodes,
      visualEdges: snapshot.visualEdges,
      audioConnections: snapshot.audioConnections,
    })
  }

  const handleSave = async () => {
    try {
      setStorageError(null)
      const projectData = getCurrentProjectData()

      if (currentProjectId) {
        // Update existing project
        await projectOperations.updateProject(currentProjectId, currentProjectName, projectData)
        setStorageSuccess(`Project "${currentProjectName}" updated successfully!`)
      } else {
        // Save as new project with default name
        const defaultName = `Project ${new Date().toLocaleString()}`
        const id = await projectOperations.saveProject(defaultName, projectData)
        setCurrentProjectId(id)
        setCurrentProjectName(defaultName)
        setStorageSuccess(`Project "${defaultName}" saved successfully!`)
      }

      await loadSavedProjects()
      setTimeout(() => setStorageSuccess(null), 3000)

      // Mark project as unmodified after successful save
      store.setProjectModified(false)
    } catch (error) {
      setStorageError('Failed to save project: ' + (error as Error).message)
    }
  }

  const handleSaveAs = async () => {
    if (!newProjectName.trim()) {
      setStorageError('Please enter a project name')
      return
    }

    try {
      setStorageError(null)

      // Check if name already exists
      const nameExists = await projectOperations.projectNameExists(
        newProjectName.trim(),
        currentProjectId || undefined
      )
      if (nameExists) {
        setStorageError('A project with this name already exists')
        return
      }

      const projectData = getCurrentProjectData()
      const id = await projectOperations.saveProject(newProjectName.trim(), projectData)

      setCurrentProjectId(id)
      setCurrentProjectName(newProjectName.trim())
      setShowSaveAsDialog(false)
      setNewProjectName('')
      setStorageSuccess(`Project "${newProjectName.trim()}" saved successfully!`)

      await loadSavedProjects()
      setTimeout(() => setStorageSuccess(null), 3000)

      // Mark project as unmodified after successful save
      store.setProjectModified(false)
    } catch (error) {
      setStorageError('Failed to save project: ' + (error as Error).message)
    }
  }

  const handleLoad = async (project: SavedProject) => {
    // Check if there are unsaved changes
    if (store.visualNodes.length > 0 && store.isProjectModified) {
      if (!confirm('You will lose your changes. Are you sure you want to load this project?')) {
        return
      }
    }

    try {
      setStorageError(null)

      const importData = JSON.parse(project.data)

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

      setCurrentProjectId(project.id || null)
      setCurrentProjectName(project.name)
      setStorageSuccess(`Project "${project.name}" loaded successfully!`)

      // Mark project as unmodified after successful load
      store.setProjectModified(false)

      setTimeout(() => {
        setStorageSuccess(null)
        onClose()
      }, 2000)
    } catch (error) {
      setStorageError('Failed to load project: ' + (error as Error).message)
    }
  }

  const handleDelete = async (project: SavedProject) => {
    if (!project.id) return

    if (
      !confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)
    ) {
      return
    }

    try {
      setStorageError(null)
      await projectOperations.deleteProject(project.id)

      // If we deleted the current project, reset current project info
      if (currentProjectId === project.id) {
        setCurrentProjectId(null)
        setCurrentProjectName('')
      }

      setStorageSuccess(`Project "${project.name}" deleted successfully!`)
      await loadSavedProjects()
      setTimeout(() => setStorageSuccess(null), 3000)
    } catch (error) {
      setStorageError('Failed to delete project: ' + (error as Error).message)
    }
  }

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

      // Mark project as unmodified after successful export
      store.setProjectModified(false)
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

        // Mark project as unmodified after successful import
        store.setProjectModified(false)

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
    // Check if there are unsaved changes
    if (store.visualNodes.length > 0 && store.isProjectModified) {
      if (!confirm('You will lose your changes. Are you sure you want to import a project?')) {
        return
      }
    }

    setImportError(null)
    setImportSuccess(false)
    fileInputRef.current?.click()
  }

  // Conditional rendering without early return to avoid hooks rule violations
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
      >
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
            onClick={() => setActiveTab('storage')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'storage'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Storage
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Export
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'import'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Import
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {activeTab === 'storage' && (
            <div className="space-y-4">
              {/* Error/Success Messages */}
              {storageError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{storageError}</p>
                </div>
              )}

              {storageSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-600">{storageSuccess}</p>
                </div>
              )}

              {/* Current Project Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Current Project</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Name: {currentProjectName || 'Untitled'}</div>
                  <div>Nodes: {store.visualNodes.length}</div>
                  <div>Connections: {store.visualEdges.length}</div>
                </div>
              </div>

              {/* Save Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleSave}
                  disabled={store.visualNodes.length === 0 || !store.isProjectModified}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSaveAsDialog(true)}
                  disabled={store.visualNodes.length === 0 || !store.isProjectModified}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Save As...
                </button>
              </div>

              {/* Save As Dialog */}
              {showSaveAsDialog && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-blue-800 mb-2">Save Project As</h5>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    placeholder="Enter project name..."
                    className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm mb-3"
                    onKeyDown={e => e.key === 'Enter' && handleSaveAs()}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveAs}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setShowSaveAsDialog(false)
                        setNewProjectName('')
                        setStorageError(null)
                      }}
                      className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Saved Projects List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">Saved Projects</h4>
                  <button
                    onClick={loadSavedProjects}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Refresh
                  </button>
                </div>

                {loadingProjects ? (
                  <div className="text-sm text-gray-500 text-center py-4">Loading projects...</div>
                ) : savedProjects.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">No saved projects</div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {savedProjects.map(project => (
                      <div
                        key={project.id}
                        className={`border rounded-lg p-3 ${
                          currentProjectId === project.id
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h5 className="text-sm font-medium text-gray-800">{project.name}</h5>
                            <p className="text-xs text-gray-500">
                              {new Date(project.updatedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleLoad(project)}
                              className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                            >
                              Load
                            </button>
                            <button
                              onClick={() => handleDelete(project)}
                              className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

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
                disabled={store.visualNodes.length === 0}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
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
