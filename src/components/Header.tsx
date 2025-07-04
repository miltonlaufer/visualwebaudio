import React, { useState, useRef, useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { useOnClickOutside } from 'usehooks-ts'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import { rootStore } from '~/stores/RootStore'
import ProjectModal from './ProjectModal'
import ExportJSButton from './ExportJSButton'
import ExamplesDropdown from './ExamplesDropdown'
import DarkModeToggle from './DarkModeToggle'
import { useExamples, type Example } from './Examples'
import { confirmUnsavedChanges } from '~/utils/confirmUnsavedChanges'
import { recordingOperations } from '~/utils/database'

interface HeaderProps {
  isNodePaletteOpen?: boolean
  isPropertyPanelOpen?: boolean
  onToggleNodePalette?: () => void
  onTogglePropertyPanel?: () => void
}

const Header: React.FC<HeaderProps> = observer(
  ({
    isNodePaletteOpen = false,
    isPropertyPanelOpen = false,
    onToggleNodePalette,
    onTogglePropertyPanel,
  }) => {
    const store = useAudioGraphStore()
    const { examples } = useExamples()
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isExamplesOpen, setIsExamplesOpen] = useState(false)
    const mobileMenuRef = useRef<HTMLDivElement>(null)

    const handleClickOutside = useCallback(() => {
      setIsMobileMenuOpen(false)
      setIsExamplesOpen(false)
    }, [])

    useOnClickOutside(mobileMenuRef as React.RefObject<HTMLElement>, handleClickOutside)

    const handleMenuAction = useCallback((action: () => void) => {
      action()
      setIsMobileMenuOpen(false)
    }, [])

    const handleCloseProjectModal = useCallback(() => {
      setIsProjectModalOpen(false)
    }, [])

    // Helper function to stop recording and save/download
    const stopRecordingAndSave = async () => {
      if (!store.isRecording) return

      try {
        // Stop recording
        const recordingResult = await store.stopRecording()

        if (recordingResult) {
          const { blob: recordingBlob, duration } = recordingResult

          // Generate recording name with project name and timestamp
          const now = new Date()
          const projectName = 'Untitled Project' // Default project name
          const recordingName = `${projectName} - ${now.toLocaleString()}`

          // Save to IndexedDB
          try {
            await recordingOperations.saveRecording(
              recordingName,
              projectName,
              recordingBlob,
              duration
            )
            // Recording saved to database successfully
          } catch (dbError) {
            console.error('Failed to save recording to database:', dbError)
          }

          // Prompt user to download
          const shouldDownload = confirm(
            `Recording saved! Duration: ${Math.round(duration)}s\n\nWould you like to download the audio file?`
          )

          if (shouldDownload) {
            // Create download
            const url = URL.createObjectURL(recordingBlob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${recordingName}.wav`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }
        }
      } catch (error) {
        console.error('Recording error:', error)
        alert('Recording failed: ' + (error as Error).message)
      }
    }

    const handleTogglePlayback = async () => {
      // If recording is active and we're about to stop/pause playback, stop recording first
      if (store.isRecording && rootStore.isPlaying) {
        await stopRecordingAndSave()
      }

      store.togglePlayback()
    }

    const handleToggleRecording = async () => {
      try {
        if (store.isRecording) {
          await stopRecordingAndSave()
        } else {
          // Start recording
          await store.startRecording()
        }
      } catch (error) {
        console.error('Recording error:', error)
        alert('Recording failed: ' + (error as Error).message)
      }
    }

    const handleOpenProjectModal = () => {
      setIsProjectModalOpen(true)
    }

    const handleClearAllNodes = () => {
      store.clearAllNodes()
    }

    const handleUndo = () => {
      store.undo()
    }

    const handleRedo = () => {
      store.redo()
    }

    const handleToggleMobileMenu = () => {
      setIsMobileMenuOpen(!isMobileMenuOpen)
    }

    const handleToggleExamples = () => {
      setIsExamplesOpen(!isExamplesOpen)
    }

    const handleCloseMobileMenu = () => {
      setIsMobileMenuOpen(false)
    }

    const handleMenuActionOpenProject = () => {
      handleMenuAction(() => setIsProjectModalOpen(true))
    }

    const handleMenuActionClearAll = () => {
      handleMenuAction(() => store.clearAllNodes())
    }

    const handleMenuActionUndo = () => {
      handleMenuAction(() => store.undo())
    }

    const handleMenuActionRedo = () => {
      handleMenuAction(() => store.redo())
    }

    const handleMenuActionHelp = () => {
      handleHelpClick()
      setIsMobileMenuOpen(false)
    }

    const handleGitHubClick = async () => {
      window.open('https://github.com/miltonlaufer/visualwebaudio', '_blank')
    }

    const handleHelpClick = async () => {
      window.open(
        'https://github.com/miltonlaufer/visualwebaudio/blob/main/USER_GUIDE.md',
        '_blank'
      )
    }

    const handleExampleSelect = useCallback(
      async (example: Example) => {
        // Check if there are unsaved changes
        if (
          !confirmUnsavedChanges(
            store,
            'You will lose your changes. Are you sure you want to load this example?'
          )
        ) {
          return
        }

        await example.create()
        // Mark project as unmodified after loading example (examples are a fresh starting point)
        rootStore.setProjectModified(false)
        setIsMobileMenuOpen(false)
        setIsExamplesOpen(false)
      },
      [store]
    )

    const handleMobileExampleSelect = (example: Example) => () => {
      handleExampleSelect(example)
    }

    return (
      <>
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 pr-20 flex items-center justify-between relative z-40">
          {/* GitHub Open Source Ribbon */}
          <div className="absolute top-0 right-0 overflow-hidden pointer-events-none z-50 w-32 h-32">
            <button
              onClick={handleGitHubClick}
              className="pointer-events-auto -mx-14 block bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-16 transform rotate-45 translate-x-12 translate-y-6 shadow-[0_0_10px_rgba(0,0,0)]  hover:shadow-[0_1px_15px_rgba(0,0,0)]   transition-all duration-300 hover:scale-105"
              title="View on GitHub - Open Source"
            >
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <span>GitHub</span>
              </div>
            </button>
          </div>
          {/* Left side - Mobile menu button (node palette), Logo and title */}
          <div className="flex items-center">
            {/* Mobile Menu Button - Controls Node Palette */}
            <button
              onClick={onToggleNodePalette}
              className={`md:hidden p-2 rounded-lg transition-colors mr-3 ${
                isNodePaletteOpen
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="Toggle Node Palette"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <div className="flex items-center space-x-2">
              <img src="./logo.png" alt="Visual Web Audio" className="w-8 h-8" />
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-gray-900 dark:text-white text-lg lg:text-2xl">
                  <span className="lg:hidden">VWA</span>
                  <span className="hidden lg:inline">Visual Web Audio</span>
                </h1>
                <span className="hidden lg:inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                  alpha
                </span>
              </div>
            </div>
          </div>

          {/* Center - Play and Record Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleTogglePlayback}
              className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                rootStore.isPlaying
                  ? 'bg-red-800 text-white hover:bg-red-700'
                  : 'bg-green-800 text-white hover:bg-green-700'
              }`}
            >
              {rootStore.isPlaying ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
              <span className="ml-2 hidden sm:inline">{rootStore.isPlaying ? 'Stop' : 'Play'}</span>
            </button>

            <button
              onClick={handleToggleRecording}
              disabled={!rootStore.isPlaying && !store.isRecording}
              className={`flex items-center px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                store.isRecording
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-gray-600 text-white hover:bg-gray-500'
              }`}
              title={store.isRecording ? 'Stop Recording' : 'Start Recording'}
            >
              {store.isRecording ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="8" />
                </svg>
              )}
              <span className="ml-2 hidden sm:inline">
                {store.isRecording ? 'Stop Rec' : 'Record'}
              </span>
            </button>
          </div>

          {/* Right side - Desktop controls and mobile menu */}
          <div className="flex items-center space-x-2">
            {/* Desktop Controls */}
            <div className="hidden md:flex items-center space-x-4">
              {/* Quick Examples */}
              <ExamplesDropdown variant="desktop" />

              {/* Project */}
              <button
                onClick={handleOpenProjectModal}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Project
              </button>

              {/* Export JS Button */}
              <ExportJSButton />

              {/* Clear All */}
              <button
                onClick={handleClearAllNodes}
                className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Clear All
              </button>

              {/* Undo/Redo */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={handleUndo}
                  disabled={!store.canUndo}
                  className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Undo (⌘Z)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!store.canRedo}
                  className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Redo (⌘Y)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
                    />
                  </svg>
                </button>
              </div>

              {/* Help Button */}
              <button
                onClick={handleHelpClick}
                className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="User Guide & Help"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>

              {/* Dark Mode Toggle */}
              <DarkModeToggle />
            </div>

            {/* Mobile Menu Button - Controls other features */}
            <div className="md:hidden relative" ref={mobileMenuRef}>
              <button
                onClick={handleToggleMobileMenu}
                className={`p-2 rounded-lg transition-colors ${
                  isMobileMenuOpen
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Toggle Menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </button>

              {/* Mobile Menu Dropdown */}
              {isMobileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                  <div className="p-2">
                    {/* Examples Section */}
                    <div className="mb-2">
                      <button
                        onClick={handleToggleExamples}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <span className="font-medium">Quick Examples</span>
                        <svg
                          className={`w-4 h-4 transition-transform ${
                            isExamplesOpen ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {isExamplesOpen && (
                        <div className="ml-4 mt-1 space-y-1 max-h-48 overflow-y-auto">
                          {examples.map(example => (
                            <button
                              key={example.id}
                              onClick={handleMobileExampleSelect(example)}
                              className="w-full text-left px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                            >
                              {example.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>

                    {/* Menu Actions */}
                    <div className="space-y-1">
                      {/* Project */}
                      <button
                        onClick={handleMenuActionOpenProject}
                        className="w-full flex items-center px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <svg
                          className="w-4 h-4 mr-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        Project
                      </button>

                      {/* Mobile Export JS Button */}
                      <div className="px-3 py-2">
                        <ExportJSButton />
                      </div>

                      {/* Clear All */}
                      <button
                        onClick={handleMenuActionClearAll}
                        className="w-full flex items-center px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <svg
                          className="w-4 h-4 mr-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Clear All
                      </button>

                      {/* Undo */}
                      <button
                        onClick={handleMenuActionUndo}
                        disabled={!store.canUndo}
                        className="w-full flex items-center px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg
                          className="w-4 h-4 mr-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                          />
                        </svg>
                        Undo
                      </button>

                      {/* Redo */}
                      <button
                        onClick={handleMenuActionRedo}
                        disabled={!store.canRedo}
                        className="w-full flex items-center px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg
                          className="w-4 h-4 mr-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
                          />
                        </svg>
                        Redo
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>

                    {/* Help Link */}
                    <button
                      onClick={handleMenuActionHelp}
                      className="w-full flex items-center px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <svg
                        className="w-4 h-4 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      User Guide & Help
                    </button>

                    {/* GitHub Link */}
                    <a
                      href="https://github.com/miltonlaufer/visualwebaudio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      onClick={handleCloseMobileMenu}
                    >
                      <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      View on GitHub
                    </a>

                    {/* Dark Mode Toggle */}
                    <div className="px-3 py-2">
                      <DarkModeToggle className="w-full" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Property Panel Toggle */}
            <button
              onClick={onTogglePropertyPanel}
              className={`md:hidden p-2 rounded-lg transition-colors ${
                isPropertyPanelOpen
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="Toggle Property Panel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                />
              </svg>
            </button>
          </div>
        </header>

        <ProjectModal isOpen={isProjectModalOpen} onClose={handleCloseProjectModal} />
      </>
    )
  }
)

export default Header
