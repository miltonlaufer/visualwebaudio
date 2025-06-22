import React, { useState, useRef, useEffect, useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { getSnapshot, applySnapshot } from 'mobx-state-tree'
import { useOnClickOutside } from 'usehooks-ts'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import { customNodeStore } from '~/stores/CustomNodeStore'
import {
  projectOperations,
  recordingOperations,
  type SavedProject,
  type AudioRecording,
} from '~/utils/database'
import { confirmUnsavedChanges } from '~/utils/confirmUnsavedChanges'

// Deduplication functions for cleaning up corrupted project files
const deduplicateConnections = (connections: any[]) => {
  if (!connections || !Array.isArray(connections)) return []

  const seen = new Set<string>()
  return connections.filter(conn => {
    const key = `${conn.sourceNodeId}-${conn.targetNodeId}-${conn.sourceOutput}-${conn.targetInput}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const deduplicateCustomNodeConnections = (customNodes: any) => {
  if (!customNodes || typeof customNodes !== 'object') return customNodes

  const deduplicatedNodes = { ...customNodes }

  Object.keys(deduplicatedNodes).forEach(nodeId => {
    const node = deduplicatedNodes[nodeId]
    if (node.inputConnections && Array.isArray(node.inputConnections)) {
      const seen = new Set<string>()
      node.inputConnections = node.inputConnections.filter((conn: any) => {
        const key = `${conn.sourceNodeId}-${conn.sourceOutput}-${conn.targetInput}`
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })
    }
  })

  return deduplicatedNodes
}

interface ProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

const ProjectModal: React.FC<ProjectModalProps> = observer(({ isOpen, onClose }) => {
  // Now we can safely call all hooks knowing the component will render normally
  const store = useAudioGraphStore()
  const [activeTab, setActiveTab] = useState<'storage' | 'export' | 'import' | 'recordings'>(
    'storage'
  )
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
  const [recordings, setRecordings] = useState<AudioRecording[]>([])
  const [loadingRecordings, setLoadingRecordings] = useState<boolean>(false)
  const [recordingsError, setRecordingsError] = useState<string | null>(null)
  const [recordingsSuccess, setRecordingsSuccess] = useState<string | null>(null)
  const [editingRecordingId, setEditingRecordingId] = useState<number | null>(null)
  const [editingRecordingName, setEditingRecordingName] = useState<string>('')
  const [playingRecordingId, setPlayingRecordingId] = useState<number | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close modal
  const handleClickOutside = useCallback(() => {
    if (isOpen) {
      onClose()
    }
  }, [isOpen, onClose])

  useOnClickOutside(modalRef as React.RefObject<HTMLElement>, handleClickOutside)

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

  // Load recordings when recordings tab opens
  useEffect(() => {
    if (isOpen && activeTab === 'recordings') {
      loadRecordings()
    }
  }, [isOpen, activeTab])

  // Reset project state when all nodes are cleared (clear all, new example, etc)
  useEffect(() => {
    if (store.adaptedNodes.length === 0 && (currentProjectId || currentProjectName)) {
      setCurrentProjectId(null)
      setCurrentProjectName('')
      // Reset modification state when project is cleared
      store.setProjectModified(false)
    }
  }, [store.adaptedNodes.length, currentProjectId, currentProjectName, store])

  // Handle beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (store.adaptedNodes.length > 0 && store.isProjectModified) {
        const message = 'You will lose your changes. Are you sure you want to leave?'
        event.preventDefault()
        event.returnValue = message
        return message
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [store.adaptedNodes.length, store.isProjectModified, store])

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

  const loadRecordings = async () => {
    try {
      setLoadingRecordings(true)
      setRecordingsError(null)
      const allRecordings = await recordingOperations.getAllRecordings()
      setRecordings(allRecordings)
    } catch (error) {
      setRecordingsError('Failed to load recordings: ' + (error as Error).message)
    } finally {
      setLoadingRecordings(false)
    }
  }

  const getCurrentProjectData = () => {
    const snapshot = getSnapshot(store)
    const customNodeSnapshot = getSnapshot(customNodeStore) as any
    return JSON.stringify({
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      adaptedNodes: snapshot.adaptedNodes,
      visualEdges: snapshot.visualEdges,
      audioConnections: snapshot.audioConnections,
      customNodes: customNodeSnapshot.nodes,
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

  const handleLoad = useCallback(
    async (project: SavedProject) => {
      // Check if there are unsaved changes
      if (
        !confirmUnsavedChanges(
          store,
          'You will lose your changes. Are you sure you want to load this project?'
        )
      ) {
        return
      }

      try {
        setStorageError(null)

        const importData = JSON.parse(project.data)

        // Validate the import data structure
        if (!importData.adaptedNodes || !importData.visualEdges || !importData.audioConnections) {
          throw new Error('Invalid project file format. Missing required fields.')
        }

        // Clear existing project
        store.clearAllNodes()

        // Set flag to prevent marking as modified during loading
        store.setLoadingProject(true)

        try {
          // Deduplicate connections before applying to prevent audio corruption
          const deduplicatedAudioConnections = deduplicateConnections(importData.audioConnections)
          const deduplicatedCustomNodes = deduplicateCustomNodeConnections(importData.customNodes)

          // Apply the imported data to AudioGraphStore
          const newSnapshot = {
            ...getSnapshot(store),
            adaptedNodes: importData.adaptedNodes,
            visualEdges: importData.visualEdges,
            audioConnections: deduplicatedAudioConnections,
          }

          applySnapshot(store, newSnapshot)

          // Apply CustomNodeStore snapshot if available
          if (deduplicatedCustomNodes) {
            const customNodeSnapshot = {
              nodes: deduplicatedCustomNodes,
            }
            applySnapshot(customNodeStore, customNodeSnapshot)
          }

          // Initialize reactions after applying snapshot
          store.init()

          // Force React re-render by incrementing graph change counter
          store.forceRerender()

          // Set current project info
          setCurrentProjectId(project.id || null)
          setCurrentProjectName(project.name)

          setStorageSuccess(`Project "${project.name}" loaded successfully!`)
          setTimeout(() => setStorageSuccess(null), 3000)

          // Mark project as unmodified after successful load
          store.setProjectModified(false)

          // Close the modal after a successful load
          onClose()
        } finally {
          // Always clear the loading flag
          store.setLoadingProject(false)
        }
      } catch (error) {
        setStorageError('Failed to load project: ' + (error as Error).message)
        // Clear the loading flag on error too
        store.setLoadingProject(false)
      }
    },
    [store, onClose]
  )

  const handleDelete = async (project: SavedProject) => {
    if (!project.id) {
      setStorageError('Cannot delete project: Invalid project ID')
      return
    }

    if (
      !confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)
    ) {
      return
    }

    try {
      setStorageError(null)
      await projectOperations.deleteProject(project.id)

      // If we deleted the currently loaded project, clear the current project info
      if (currentProjectId === project.id) {
        setCurrentProjectId(null)
        setCurrentProjectName('')
      }

      await loadSavedProjects()
      setStorageSuccess(`Project "${project.name}" deleted successfully!`)
      setTimeout(() => setStorageSuccess(null), 3000)
    } catch (error) {
      setStorageError('Failed to delete project: ' + (error as Error).message)
    }
  }

  // Remove useCallback from simple HTML element handlers
  const handleSetActiveTabStorage = () => {
    setActiveTab('storage')
  }

  const handleSetActiveTabExport = () => {
    setActiveTab('export')
  }

  const handleSetActiveTabImport = () => {
    setActiveTab('import')
  }

  const handleShowSaveAsDialog = () => {
    setShowSaveAsDialog(true)
  }

  const handleNewProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewProjectName(e.target.value)
  }

  const handleNewProjectNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveAs()
    }
  }

  const handleSaveAsDialogClose = () => {
    setShowSaveAsDialog(false)
    setNewProjectName('')
  }

  const handleExport = () => {
    const projectData = getCurrentProjectData()
    const blob = new Blob([projectData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentProjectName || 'project'}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check if there are unsaved changes
    if (
      !confirmUnsavedChanges(
        store,
        'You will lose your changes. Are you sure you want to import this project?'
      )
    ) {
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
        setImportError(null)
        setImportSuccess(false)
      }
      return
    }

    const reader = new FileReader()
    reader.onload = async e => {
      try {
        const content = e.target?.result as string
        const importData = JSON.parse(content)

        // Validate the import data structure
        if (!importData.adaptedNodes || !importData.visualEdges || !importData.audioConnections) {
          throw new Error('Invalid project file format. Missing required fields.')
        }

        // Clear existing project
        store.clearAllNodes()

        // Set flag to prevent marking as modified during loading
        store.setLoadingProject(true)

        try {
          // Deduplicate connections before applying to prevent audio corruption
          const deduplicatedAudioConnections = deduplicateConnections(importData.audioConnections)
          const deduplicatedCustomNodes = deduplicateCustomNodeConnections(importData.customNodes)

          // Apply the imported data to AudioGraphStore
          const newSnapshot = {
            ...getSnapshot(store),
            adaptedNodes: importData.adaptedNodes,
            visualEdges: importData.visualEdges,
            audioConnections: deduplicatedAudioConnections,
          }

          applySnapshot(store, newSnapshot)

          // Apply CustomNodeStore snapshot if available
          if (deduplicatedCustomNodes) {
            const customNodeSnapshot = {
              nodes: deduplicatedCustomNodes,
            }
            applySnapshot(customNodeStore, customNodeSnapshot)
          }

          // Initialize reactions after applying snapshot
          store.init()

          // Force React re-render by incrementing graph change counter
          store.forceRerender()

          // Clear current project info since this is an import
          setCurrentProjectId(null)
          setCurrentProjectName('')

          setImportSuccess(true)
          setTimeout(() => setImportSuccess(false), 3000)

          // Mark project as unmodified after successful import
          store.setProjectModified(false)

          // Close the modal after successful import
          onClose()
        } finally {
          // Always clear the loading flag
          store.setLoadingProject(false)
        }
      } catch (error) {
        setImportError('Failed to import project: ' + (error as Error).message)
        // Clear the loading flag on error too
        store.setLoadingProject(false)
      }

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }

    reader.readAsText(file)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleRefreshProjects = () => {
    loadSavedProjects()
  }

  // Recording handlers
  const handleDownloadRecording = (recording: AudioRecording) => {
    try {
      const url = URL.createObjectURL(recording.audioData)
      const a = document.createElement('a')
      a.href = url
      a.download = `${recording.name}.wav`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      setRecordingsError('Failed to download recording: ' + (error as Error).message)
    }
  }

  const handleDeleteRecording = async (recording: AudioRecording) => {
    if (!recording.id) {
      setRecordingsError('Cannot delete recording: Invalid recording ID')
      return
    }

    if (
      !confirm(`Are you sure you want to delete "${recording.name}"? This action cannot be undone.`)
    ) {
      return
    }

    try {
      setRecordingsError(null)
      await recordingOperations.deleteRecording(recording.id)
      await loadRecordings()
      setRecordingsSuccess(`Recording "${recording.name}" deleted successfully!`)
      setTimeout(() => setRecordingsSuccess(null), 3000)
    } catch (error) {
      setRecordingsError('Failed to delete recording: ' + (error as Error).message)
    }
  }

  const handleStartEditRecording = (recording: AudioRecording) => {
    setEditingRecordingId(recording.id || null)
    setEditingRecordingName(recording.name)
  }

  const handleSaveRecordingName = async () => {
    if (!editingRecordingId || !editingRecordingName.trim()) {
      setRecordingsError('Please enter a valid recording name')
      return
    }

    try {
      setRecordingsError(null)
      await recordingOperations.updateRecordingName(editingRecordingId, editingRecordingName.trim())
      setEditingRecordingId(null)
      setEditingRecordingName('')
      await loadRecordings()
      setRecordingsSuccess('Recording renamed successfully!')
      setTimeout(() => setRecordingsSuccess(null), 3000)
    } catch (error) {
      setRecordingsError('Failed to rename recording: ' + (error as Error).message)
    }
  }

  const handleCancelEditRecording = () => {
    setEditingRecordingId(null)
    setEditingRecordingName('')
  }

  const handleRefreshRecordings = () => {
    loadRecordings()
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleSetActiveTabRecordings = () => {
    setActiveTab('recordings')
  }

  const handlePlayRecording = async (recording: AudioRecording) => {
    try {
      // If this recording is already playing, pause it
      if (playingRecordingId === recording.id && audioElement && !audioElement.paused) {
        audioElement.pause()
        setPlayingRecordingId(null)
        return
      }

      // Stop any currently playing audio
      if (audioElement) {
        audioElement.pause()
        audioElement.src = ''
      }

      // Create new audio element
      const audio = new Audio()
      const audioUrl = URL.createObjectURL(recording.audioData)

      audio.src = audioUrl
      audio.onended = () => {
        setPlayingRecordingId(null)
        URL.revokeObjectURL(audioUrl)
      }
      audio.onerror = event => {
        console.error('Audio playback error:', event)
        setPlayingRecordingId(null)
        setRecordingsError('Audio playback failed - file may be corrupted')
        URL.revokeObjectURL(audioUrl)
      }

      // Set state optimistically - if play() fails, we'll handle it in catch
      setAudioElement(audio)
      setPlayingRecordingId(recording.id!)

      // Try to play - if it fails, we'll catch it but not necessarily show an error
      // since the audio might still work despite the promise rejection
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // Only show error if audio is actually not playing
          if (audio.paused) {
            console.error('Play promise rejected:', error)
            setRecordingsError('Failed to start audio playback')
            setPlayingRecordingId(null)
          }
          // If audio is playing despite the promise rejection, ignore the error
        })
      }
    } catch (error) {
      console.error('Audio setup error:', error)
      setRecordingsError('Failed to set up audio playback: ' + (error as Error).message)
      setPlayingRecordingId(null)
    }
  }

  const handleStopRecording = useCallback(() => {
    if (audioElement) {
      audioElement.pause()
      audioElement.src = ''
    }
    setPlayingRecordingId(null)
    setAudioElement(null)
  }, [audioElement])

  // Cleanup audio when modal closes
  useEffect(() => {
    if (!isOpen) {
      handleStopRecording()
    }
  }, [isOpen, handleStopRecording])

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
            onClick={handleSetActiveTabStorage}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'storage'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Projects
          </button>
          <button
            onClick={handleSetActiveTabRecordings}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'recordings'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Recordings
          </button>
          <button
            onClick={handleSetActiveTabExport}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Export
          </button>
          <button
            onClick={handleSetActiveTabImport}
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
                  <div>Nodes: {store.adaptedNodes.length}</div>
                  <div>Connections: {store.visualEdges.length}</div>
                </div>
              </div>

              {/* Save Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleSave}
                  disabled={store.adaptedNodes.length === 0 || !store.isProjectModified}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Save
                </button>
                <button
                  onClick={handleShowSaveAsDialog}
                  disabled={store.adaptedNodes.length === 0 || !store.isProjectModified}
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
                    onChange={handleNewProjectNameChange}
                    placeholder="Enter project name..."
                    className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm mb-3"
                    onKeyDown={handleNewProjectNameKeyDown}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveAs}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleSaveAsDialogClose}
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
                    onClick={handleRefreshProjects}
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

                {savedProjects.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs text-blue-700">
                      💡 Tip: Projects are stored locally in your browser. Export important projects
                      to keep them safe.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'recordings' && (
            <div className="space-y-4">
              {/* Error/Success Messages */}
              {recordingsError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{recordingsError}</p>
                </div>
              )}

              {recordingsSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-600">{recordingsSuccess}</p>
                </div>
              )}

              {/* Recordings List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">Audio Recordings</h4>
                  <button
                    onClick={handleRefreshRecordings}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Refresh
                  </button>
                </div>

                {loadingRecordings ? (
                  <div className="text-sm text-gray-500 text-center py-4">
                    Loading recordings...
                  </div>
                ) : recordings.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">
                    No recordings found. Use the record button in the header to create audio
                    recordings.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {recordings.map(recording => (
                      <div
                        key={recording.id}
                        className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            {editingRecordingId === recording.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editingRecordingName}
                                  onChange={e => setEditingRecordingName(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      handleSaveRecordingName()
                                    } else if (e.key === 'Escape') {
                                      handleCancelEditRecording()
                                    }
                                  }}
                                  autoFocus
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={handleSaveRecordingName}
                                    className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEditRecording}
                                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <h5 className="text-sm font-medium text-gray-800 truncate">
                                  {recording.name}
                                </h5>
                                <div className="text-xs text-gray-500 space-y-1 mt-1">
                                  <div>Project: {recording.projectName}</div>
                                  <div>Duration: {formatDuration(recording.duration)}</div>
                                  <div>Size: {formatFileSize(recording.size)}</div>
                                  <div>
                                    Created: {new Date(recording.createdAt).toLocaleString()}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {editingRecordingId !== recording.id && (
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => handlePlayRecording(recording)}
                                className={`px-2 py-1 rounded text-xs transition-colors ${
                                  playingRecordingId === recording.id
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                }`}
                                title={
                                  playingRecordingId === recording.id
                                    ? 'Stop playing'
                                    : 'Play recording'
                                }
                              >
                                {playingRecordingId === recording.id ? (
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                )}
                              </button>
                              <button
                                onClick={() => handleDownloadRecording(recording)}
                                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                                title="Download recording"
                              >
                                Download
                              </button>
                              <button
                                onClick={() => handleStartEditRecording(recording)}
                                className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs hover:bg-yellow-200"
                                title="Rename recording"
                              >
                                Rename
                              </button>
                              <button
                                onClick={() => handleDeleteRecording(recording)}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                                title="Delete recording"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {recordings.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs text-blue-700">
                      💡 Tip: Recordings are stored locally in your browser. Export important
                      recordings to keep them safe.
                    </p>
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
                  <div>Nodes: {store.adaptedNodes.length}</div>
                  <div>Connections: {store.visualEdges.length}</div>
                </div>
              </div>

              <button
                onClick={handleExport}
                disabled={store.adaptedNodes.length === 0}
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
