import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { customNodeStore } from '~/stores/CustomNodeStore'

interface MidiInputNodeComponentProps {
  nodeId: string
}

const MidiInputNodeComponent: React.FC<MidiInputNodeComponentProps> = observer(({ nodeId }) => {
  const node = customNodeStore.getNode(nodeId)
  const [permissionStatus, setPermissionStatus] = useState<
    'unknown' | 'granted' | 'denied' | 'requesting'
  >('unknown')
  const [availableDevices, setAvailableDevices] = useState<MIDIInput[]>([])
  const [isConnected, setIsConnected] = useState(false)

  if (!node) {
    return <div className="text-red-500 text-xs p-2">Node not found</div>
  }

  // Check initial MIDI permission status
  useEffect(() => {
    checkMidiPermissionStatus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Monitor MIDI outputs to detect connection
  useEffect(() => {
    const noteValue = node.outputs.get('note')
    const velocityValue = node.outputs.get('velocity')
    const ccValue = node.outputs.get('cc')
    const pitchValue = node.outputs.get('pitch')

    const hasRecentActivity =
      noteValue !== undefined ||
      velocityValue !== undefined ||
      ccValue !== undefined ||
      pitchValue !== undefined

    setIsConnected(hasRecentActivity)
  }, [node.outputs])

  const checkMidiPermissionStatus = async () => {
    if (!navigator.requestMIDIAccess) {
      setPermissionStatus('denied')
      return
    }

    try {
      // Try to get MIDI access without sysex first
      const access = await navigator.requestMIDIAccess({ sysex: false })
      setPermissionStatus('granted')
      updateAvailableDevices(access)
      node.setMidiAccess(access)
    } catch (error) {
      console.warn('MIDI access denied:', error)
      setPermissionStatus('denied')
    }
  }

  const requestMidiPermissions = async () => {
    if (!navigator.requestMIDIAccess) {
      setPermissionStatus('denied')
      return
    }

    setPermissionStatus('requesting')

    try {
      const access = await navigator.requestMIDIAccess({ sysex: false })
      setPermissionStatus('granted')
      updateAvailableDevices(access)
      node.setMidiAccess(access)
    } catch (error) {
      console.error('Failed to get MIDI access:', error)
      setPermissionStatus('denied')
    }
  }

  const updateAvailableDevices = (access: MIDIAccess) => {
    const devices: MIDIInput[] = []
    access.inputs.forEach(input => {
      devices.push(input)
    })
    setAvailableDevices(devices)

    // Auto-select first device if none selected
    if (devices.length > 0 && !node.properties.get('selectedDeviceId')) {
      node.setSelectedMidiDevice(devices[0].id)
      node.setProperty('deviceName', devices[0].name || 'Unknown Device')
    }
  }

  const handleDeviceChange = (deviceId: string) => {
    const device = availableDevices.find(d => d.id === deviceId)
    if (device) {
      node.setSelectedMidiDevice(deviceId)
      node.setProperty('deviceName', device.name || 'Unknown Device')
    }
  }

  const handleChannelChange = (channel: number) => {
    node.setProperty('channel', channel)
  }

  const getStatusColor = () => {
    switch (permissionStatus) {
      case 'granted':
        return isConnected ? 'text-green-600' : 'text-yellow-600'
      case 'denied':
        return 'text-red-600'
      case 'requesting':
        return 'text-blue-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusText = () => {
    switch (permissionStatus) {
      case 'granted':
        return isConnected ? 'Connected' : 'Ready'
      case 'denied':
        return 'Access Denied'
      case 'requesting':
        return 'Requesting...'
      default:
        return 'Unknown'
    }
  }

  const selectedDeviceId = node.properties.get('selectedDeviceId') ?? ''
  const currentChannel = node.properties.get('channel') ?? 1

  return (
    <div className="p-3 min-w-[200px]">
      <div className="text-xs font-bold text-gray-700 mb-2">MIDI Input</div>

      {/* Permission Status */}
      <div className="mb-3">
        <div className={`text-xs font-medium ${getStatusColor()}`}>Status: {getStatusText()}</div>
        {(permissionStatus === 'denied' || permissionStatus === 'unknown') && (
          <button
            onClick={requestMidiPermissions}
            className="mt-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            disabled={false}
          >
            Request MIDI Access
          </button>
        )}
      </div>

      {/* Device Selection */}
      {permissionStatus === 'granted' && (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Device:</label>
            <select
              value={selectedDeviceId}
              onChange={e => handleDeviceChange(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1"
            >
              <option value="">Select Device</option>
              {availableDevices.map(device => (
                <option key={device.id} value={device.id}>
                  {device.name || 'Unknown Device'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600 block mb-1">Channel:</label>
            <select
              value={currentChannel}
              onChange={e => handleChannelChange(parseInt(e.target.value))}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1"
            >
              {Array.from({ length: 16 }, (_, i) => i + 1).map(channel => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </div>

          {/* Connection indicator */}
          <div className="flex items-center gap-2 mt-2">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}
            ></div>
            <span className="text-xs text-gray-600">
              {isConnected ? 'Receiving MIDI' : 'No MIDI data'}
            </span>
          </div>

          {/* Current values display */}
          <div className="mt-2 text-xs text-gray-600 space-y-1">
            <div>Note: {node.outputs.get('note') || '-'}</div>
            <div>Velocity: {node.outputs.get('velocity') || '-'}</div>
            <div>CC: {node.outputs.get('cc') || '-'}</div>
            <div>Pitch: {node.outputs.get('pitch') || '-'}</div>
          </div>
        </div>
      )}

      {/* Help text */}
      {permissionStatus === 'denied' && (
        <div className="mt-2 text-xs text-gray-500">
          MIDI access is required to receive MIDI messages. Please allow access when prompted.
        </div>
      )}
    </div>
  )
})

export default MidiInputNodeComponent
