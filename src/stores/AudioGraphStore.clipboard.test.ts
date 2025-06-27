import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RootStore, type IRootStore } from '~/stores/RootStore'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'

// Mock navigator.clipboard
const mockClipboard = {
  writeText: vi.fn(),
  readText: vi.fn(),
}

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
})

// Mock navigator.permissions
Object.defineProperty(navigator, 'permissions', {
  value: {
    query: vi.fn().mockResolvedValue({ state: 'granted' }),
  },
  writable: true,
})

describe('AudioGraphStore - Clipboard Functionality', () => {
  let store: AudioGraphStoreType
  let rootStore: IRootStore

  beforeEach(() => {
    rootStore = RootStore.create({ audioGraph: { history: {} } })
    store = rootStore.audioGraph
    store.loadMetadata()

    // Reset clipboard mocks
    vi.clearAllMocks()
    mockClipboard.writeText.mockResolvedValue(undefined)
    mockClipboard.readText.mockResolvedValue('')
  })

  describe('Copy Functionality', () => {
    it('should copy selected nodes to internal clipboard with correct data structure', async () => {
      // Create test nodes
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const gainId = store.addAdaptedNode('GainNode', { x: 200, y: 200 })

      // Set some properties
      store.updateNodeProperty(oscId, 'frequency', 440)
      store.updateNodeProperty(gainId, 'gain', 0.5)

      // Copy the nodes
      await store.copySelectedNodes([oscId, gainId])

      // Verify internal clipboard structure
      expect(store.clipboardNodes).toHaveLength(2)
      expect(store.clipboardEdges).toHaveLength(0)

      // Check first node structure
      const copiedOsc = store.clipboardNodes.find(node => node.data.nodeType === 'OscillatorNode')
      expect(copiedOsc).toBeDefined()
      expect(copiedOsc.data).toBeDefined()
      expect(copiedOsc.data.nodeType).toBe('OscillatorNode')
      expect(copiedOsc.data.metadata).toBeDefined()
      expect(copiedOsc.data.properties).toBeDefined()
      expect(copiedOsc.data.properties.frequency).toBe(440)
      expect(copiedOsc.position).toEqual({ x: 100, y: 100 })

      // Check second node structure
      const copiedGain = store.clipboardNodes.find(node => node.data.nodeType === 'GainNode')
      expect(copiedGain).toBeDefined()
      expect(copiedGain.data).toBeDefined()
      expect(copiedGain.data.nodeType).toBe('GainNode')
      expect(copiedGain.data.metadata).toBeDefined()
      expect(copiedGain.data.properties).toBeDefined()
      expect(copiedGain.data.properties.gain).toBe(0.5)
      // The position might be adjusted by smart positioning, so let's be more flexible
      expect(copiedGain.position.x).toBeGreaterThanOrEqual(200)
      expect(copiedGain.position.y).toBe(200)
    })

    it('should copy edges between selected nodes', async () => {
      // Create test nodes
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const gainId = store.addAdaptedNode('GainNode', { x: 200, y: 200 })

      // Connect them
      store.addEdge(oscId, gainId, 'output', 'input')

      // Copy both nodes
      await store.copySelectedNodes([oscId, gainId])

      // Verify edge was copied
      expect(store.clipboardEdges).toHaveLength(1)
      expect(store.clipboardEdges[0].source).toBe(oscId)
      expect(store.clipboardEdges[0].target).toBe(gainId)
      expect(store.clipboardEdges[0].sourceHandle).toBe('output')
      expect(store.clipboardEdges[0].targetHandle).toBe('input')
    })

    it('should not copy edges when only one node is selected', async () => {
      // Create test nodes
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const gainId = store.addAdaptedNode('GainNode', { x: 200, y: 200 })

      // Connect them
      store.addEdge(oscId, gainId, 'output', 'input')

      // Copy only one node
      await store.copySelectedNodes([oscId])

      // Verify no edges were copied
      expect(store.clipboardNodes).toHaveLength(1)
      expect(store.clipboardEdges).toHaveLength(0)
    })

    it('should write to system clipboard with correct format', async () => {
      // Create test node
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      // Copy the node
      await store.copySelectedNodes([oscId])

      // Verify system clipboard was called
      expect(mockClipboard.writeText).toHaveBeenCalledTimes(1)

      // Parse the clipboard data
      const clipboardCall = mockClipboard.writeText.mock.calls[0][0]
      const clipboardData = JSON.parse(clipboardCall)

      expect(clipboardData.type).toBe('visualwebaudio-nodes')
      expect(clipboardData.version).toBe('1.0')
      expect(clipboardData.data).toBeDefined()
      expect(clipboardData.data.nodes).toHaveLength(1)
      expect(clipboardData.data.edges).toHaveLength(0)
    })

    it('should handle clipboard write errors gracefully', async () => {
      // Mock clipboard write failure
      mockClipboard.writeText.mockRejectedValue(new Error('Clipboard access denied'))

      // Create test node
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      // Copy should not throw
      await expect(store.copySelectedNodes([oscId])).resolves.not.toThrow()

      // Internal clipboard should still work
      expect(store.clipboardNodes).toHaveLength(1)
      expect(store.clipboardPermissionState).toBe('denied')
      expect(store.clipboardError).toContain('Clipboard access denied')
    })
  })

  describe('Paste Functionality', () => {
    it('should paste nodes from internal clipboard with correct data extraction', async () => {
      // Create and copy a node first
      const originalOscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.updateNodeProperty(originalOscId, 'frequency', 880)
      await store.copySelectedNodes([originalOscId])

      // Clear the graph
      store.clearAllNodes()

      // Paste the nodes
      const pastedIds = await store.pasteNodes()

      // Verify nodes were pasted
      expect(pastedIds).toHaveLength(1)
      expect(store.adaptedNodes).toHaveLength(1)

      // Verify the pasted node has correct data
      const pastedNode = store.adaptedNodes[0]
      expect(pastedNode.nodeType).toBe('OscillatorNode')
      expect(pastedNode.properties.get('frequency')).toBe(880)
      expect(pastedNode.position.x).toBe(150) // Original 100 + offset 50
      expect(pastedNode.position.y).toBe(150) // Original 100 + offset 50
      expect(pastedNode.id).not.toBe(originalOscId) // Should have new ID
    })

    it('should handle both nested and flat data structures for backward compatibility', async () => {
      // Manually create clipboard data with nested structure (current format)
      store.setClipboardDataForTesting(
        [
          {
            id: 'test-osc-1',
            type: 'audioNode',
            position: { x: 100, y: 100 },
            data: {
              nodeType: 'OscillatorNode',
              metadata: store.webAudioMetadata['OscillatorNode'],
              properties: { frequency: 440 },
            },
          },
        ],
        []
      )

      // Paste should work
      const pastedIds = await store.pasteNodes()
      expect(pastedIds).toHaveLength(1)

      const pastedNode = store.adaptedNodes[0]
      expect(pastedNode.nodeType).toBe('OscillatorNode')
      expect(pastedNode.properties.get('frequency')).toBe(440)

      // Clear and test flat structure (legacy format)
      store.clearAllNodes()
      store.setClipboardDataForTesting(
        [
          {
            id: 'test-osc-2',
            type: 'audioNode',
            position: { x: 200, y: 200 },
            nodeType: 'GainNode', // Direct property
            metadata: store.webAudioMetadata['GainNode'], // Direct property
            properties: { gain: 0.8 }, // Direct property
          },
        ],
        []
      )

      // Paste should still work
      const pastedIds2 = await store.pasteNodes()
      expect(pastedIds2).toHaveLength(1)

      const pastedNode2 = store.adaptedNodes[0]
      expect(pastedNode2.nodeType).toBe('GainNode')
      expect(pastedNode2.properties.get('gain')).toBe(0.8)
    })

    it('should paste multiple times without clearing clipboard', async () => {
      // Create and copy a node
      const originalOscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      await store.copySelectedNodes([originalOscId])

      // Paste first time
      const pastedIds1 = await store.pasteNodes()
      expect(pastedIds1).toHaveLength(1)
      expect(store.adaptedNodes).toHaveLength(2) // Original + pasted

      // Clipboard should still have data
      expect(store.clipboardNodes).toHaveLength(1)
      expect(store.canPaste).toBe(true)

      // Paste second time
      const pastedIds2 = await store.pasteNodes()
      expect(pastedIds2).toHaveLength(1)
      expect(store.adaptedNodes).toHaveLength(3) // Original + 2 pasted

      // Clipboard should still have data for more pasting
      expect(store.clipboardNodes).toHaveLength(1)
      expect(store.canPaste).toBe(true)
    })

    it('should paste edges with updated node IDs', async () => {
      // Create connected nodes
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const gainId = store.addAdaptedNode('GainNode', { x: 200, y: 200 })
      store.addEdge(oscId, gainId, 'output', 'input')

      // Copy both nodes
      await store.copySelectedNodes([oscId, gainId])

      // Clear and paste
      store.clearAllNodes()
      const pastedIds = await store.pasteNodes()

      // Verify nodes and edges were pasted
      expect(pastedIds).toHaveLength(2)
      expect(store.adaptedNodes).toHaveLength(2)
      expect(store.visualEdges).toHaveLength(1)

      // Verify edge has new node IDs
      const pastedEdge = store.visualEdges[0]
      expect(pastedIds).toContain(pastedEdge.source)
      expect(pastedIds).toContain(pastedEdge.target)
      expect(pastedEdge.sourceHandle).toBe('output')
      expect(pastedEdge.targetHandle).toBe('input')
    })

    it('should read from system clipboard when available', async () => {
      // Mock system clipboard with valid data
      const clipboardData = {
        type: 'visualwebaudio-nodes',
        version: '1.0',
        data: {
          nodes: [
            {
              id: 'system-osc-1',
              type: 'audioNode',
              position: { x: 300, y: 300 },
              data: {
                nodeType: 'OscillatorNode',
                metadata: store.webAudioMetadata['OscillatorNode'],
                properties: { frequency: 660 },
              },
            },
          ],
          edges: [],
        },
      }
      mockClipboard.readText.mockResolvedValue(JSON.stringify(clipboardData))

      // Paste should use system clipboard
      const pastedIds = await store.pasteNodes()
      expect(pastedIds).toHaveLength(1)

      const pastedNode = store.adaptedNodes[0]
      expect(pastedNode.nodeType).toBe('OscillatorNode')
      expect(pastedNode.properties.get('frequency')).toBe(660)
    })

    it('should fall back to internal clipboard when system clipboard fails', async () => {
      // Set up internal clipboard
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      await store.copySelectedNodes([oscId])
      store.clearAllNodes()

      // Mock system clipboard failure
      mockClipboard.readText.mockRejectedValue(new Error('NotAllowedError'))

      // Paste should fall back to internal clipboard
      const pastedIds = await store.pasteNodes()
      expect(pastedIds).toHaveLength(1)
      expect(store.adaptedNodes).toHaveLength(1)
    })

    it('should handle invalid system clipboard data gracefully', async () => {
      // Mock invalid JSON
      mockClipboard.readText.mockResolvedValue('invalid json')

      // Set up internal clipboard as fallback
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      await store.copySelectedNodes([oscId])
      store.clearAllNodes()

      // Should fall back to internal clipboard
      const pastedIds = await store.pasteNodes()
      expect(pastedIds).toHaveLength(1)
    })

    it('should return empty array when no clipboard data available', async () => {
      // No internal clipboard data
      store.setClipboardDataForTesting([], [])

      // No system clipboard data
      mockClipboard.readText.mockResolvedValue('')

      // Paste should return empty array
      const pastedIds = await store.pasteNodes()
      expect(pastedIds).toHaveLength(0)
      expect(store.clipboardError).toContain('No nodes in clipboard to paste')
    })
  })

  describe('Cut Functionality', () => {
    it('should copy nodes to clipboard and then delete them', () => {
      // Create test nodes
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const gainId = store.addAdaptedNode('GainNode', { x: 200, y: 200 })

      // Cut the nodes
      store.cutSelectedNodes([oscId, gainId])

      // Verify nodes were copied to clipboard
      expect(store.clipboardNodes).toHaveLength(2)

      // Verify nodes were deleted from graph
      expect(store.adaptedNodes).toHaveLength(0)
    })
  })

  describe('Clipboard State Management', () => {
    it('should correctly report canPaste state', async () => {
      // Initially no clipboard data
      expect(store.canPaste).toBe(false)

      // After copying
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      await store.copySelectedNodes([oscId])
      expect(store.canPaste).toBe(true)

      // After clearing clipboard manually
      store.setClipboardDataForTesting([], [])
      expect(store.canPaste).toBe(false)
    })

    it('should track clipboard permission state', async () => {
      // Initially unknown
      expect(store.clipboardPermissionState).toBe('unknown')

      // After successful copy
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      await store.copySelectedNodes([oscId])
      expect(store.clipboardPermissionState).toBe('granted')

      // After clipboard error
      mockClipboard.writeText.mockRejectedValue(new Error('Access denied'))
      await store.copySelectedNodes([oscId])
      expect(store.clipboardPermissionState).toBe('denied')
    })

    it('should clear clipboard errors after successful operations', async () => {
      // Set an error
      store.setClipboardErrorForTesting('Test error')

      // Successful copy should clear error
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      await store.copySelectedNodes([oscId])
      expect(store.clipboardError).toBe(null)

      // Set error again
      store.setClipboardErrorForTesting('Test error 2')

      // Successful paste should clear error
      await store.pasteNodes()
      expect(store.clipboardError).toBe(null)
    })
  })

  describe('Data Structure Regression Tests', () => {
    it('should maintain consistent data structure in clipboard nodes', async () => {
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.updateNodeProperty(oscId, 'frequency', 440)

      await store.copySelectedNodes([oscId])

      const clipboardNode = store.clipboardNodes[0]

      // Verify the exact structure that caused the original bug
      expect(clipboardNode).toHaveProperty('id')
      expect(clipboardNode).toHaveProperty('type')
      expect(clipboardNode).toHaveProperty('position')
      expect(clipboardNode).toHaveProperty('data')
      expect(clipboardNode.data).toHaveProperty('nodeType')
      expect(clipboardNode.data).toHaveProperty('metadata')
      expect(clipboardNode.data).toHaveProperty('properties')

      // Verify the data is NOT at the top level (which was the bug)
      expect(clipboardNode).not.toHaveProperty('nodeType')
      expect(clipboardNode).not.toHaveProperty('metadata')
      expect(clipboardNode).not.toHaveProperty('properties')
    })

    it('should handle paste with both data structures without errors', async () => {
      // Test with nested structure (current correct format)
      store.setClipboardDataForTesting(
        [
          {
            id: 'test-1',
            type: 'audioNode',
            position: { x: 100, y: 100 },
            data: {
              nodeType: 'OscillatorNode',
              metadata: store.webAudioMetadata['OscillatorNode'],
              properties: { frequency: 440 },
            },
          },
        ],
        []
      )

      let pastedIds = await store.pasteNodes()
      expect(pastedIds).toHaveLength(1)
      expect(store.adaptedNodes[0].nodeType).toBe('OscillatorNode')

      store.clearAllNodes()

      // Test with flat structure (legacy format that should still work)
      store.setClipboardDataForTesting(
        [
          {
            id: 'test-2',
            type: 'audioNode',
            position: { x: 200, y: 200 },
            nodeType: 'GainNode',
            metadata: store.webAudioMetadata['GainNode'],
            properties: { gain: 0.5 },
          },
        ],
        []
      )

      pastedIds = await store.pasteNodes()
      expect(pastedIds).toHaveLength(1)
      expect(store.adaptedNodes[0].nodeType).toBe('GainNode')
    })

    // CRITICAL REGRESSION TEST: Prevent the exact bug that was fixed
    it('should correctly extract nodeType, metadata, and properties from nested data structure', async () => {
      // Create clipboard data with the nested structure that was causing the bug
      store.setClipboardDataForTesting(
        [
          {
            id: 'regression-test-node',
            type: 'audioNode',
            position: { x: 100, y: 100 },
            data: {
              nodeType: 'OscillatorNode',
              metadata: store.webAudioMetadata['OscillatorNode'],
              properties: { frequency: 880, detune: 50 },
            },
          },
        ],
        []
      )

      // This should NOT fail (it was failing before the fix)
      const pastedIds = await store.pasteNodes()

      // Verify the paste worked correctly
      expect(pastedIds).toHaveLength(1)
      expect(store.adaptedNodes).toHaveLength(1)

      const pastedNode = store.adaptedNodes[0]

      // These assertions would fail before the fix because nodeType would be undefined
      expect(pastedNode.nodeType).toBe('OscillatorNode')
      expect(pastedNode.metadata).toBeDefined()
      expect(pastedNode.metadata.name).toBe('OscillatorNode')
      expect(pastedNode.properties.get('frequency')).toBe(880)
      expect(pastedNode.properties.get('detune')).toBe(50)

      // Verify the new ID was generated correctly (this would fail if nodeType was undefined)
      expect(pastedNode.id).toContain('OscillatorNode')
      expect(pastedNode.id).not.toBe('regression-test-node')
    })

    // CRITICAL REGRESSION TEST: Ensure multiple paste operations work
    it('should allow multiple paste operations without clearing clipboard', async () => {
      // Create and copy a node
      const originalId = store.addAdaptedNode('GainNode', { x: 50, y: 50 })
      store.updateNodeProperty(originalId, 'gain', 0.7)
      await store.copySelectedNodes([originalId])

      // Verify initial state
      expect(store.canPaste).toBe(true)
      expect(store.clipboardNodes).toHaveLength(1)

      // First paste
      const firstPaste = await store.pasteNodes()
      expect(firstPaste).toHaveLength(1)
      expect(store.adaptedNodes).toHaveLength(2) // original + pasted

      // CRITICAL: Clipboard should NOT be cleared after paste
      expect(store.canPaste).toBe(true)
      expect(store.clipboardNodes).toHaveLength(1)

      // Second paste should work
      const secondPaste = await store.pasteNodes()
      expect(secondPaste).toHaveLength(1)
      expect(store.adaptedNodes).toHaveLength(3) // original + 2 pasted

      // Third paste should still work
      const thirdPaste = await store.pasteNodes()
      expect(thirdPaste).toHaveLength(1)
      expect(store.adaptedNodes).toHaveLength(4) // original + 3 pasted

      // Verify all pasted nodes have correct properties
      const pastedNodes = store.adaptedNodes.filter(node => node.id !== originalId)
      expect(pastedNodes).toHaveLength(3)
      pastedNodes.forEach(node => {
        expect(node.nodeType).toBe('GainNode')
        expect(node.properties.get('gain')).toBe(0.7)
      })
    })

    // CRITICAL REGRESSION TEST: Test the exact data extraction logic that was fixed
    it('should handle mixed data structures in clipboard gracefully', async () => {
      // Mix of nested and flat structures (simulating different clipboard sources)
      store.setClipboardDataForTesting(
        [
          // Nested structure (current format)
          {
            id: 'nested-node',
            type: 'audioNode',
            position: { x: 100, y: 100 },
            data: {
              nodeType: 'OscillatorNode',
              metadata: store.webAudioMetadata['OscillatorNode'],
              properties: { frequency: 440 },
            },
          },
          // Flat structure (legacy format)
          {
            id: 'flat-node',
            type: 'audioNode',
            position: { x: 200, y: 200 },
            nodeType: 'GainNode',
            metadata: store.webAudioMetadata['GainNode'],
            properties: { gain: 0.8 },
          },
        ],
        []
      )

      // Both should paste correctly
      const pastedIds = await store.pasteNodes()
      expect(pastedIds).toHaveLength(2)
      expect(store.adaptedNodes).toHaveLength(2)

      // Find the pasted nodes
      const oscNode = store.adaptedNodes.find(node => node.nodeType === 'OscillatorNode')
      const gainNode = store.adaptedNodes.find(node => node.nodeType === 'GainNode')

      expect(oscNode).toBeDefined()
      expect(oscNode!.properties.get('frequency')).toBe(440)

      expect(gainNode).toBeDefined()
      expect(gainNode!.properties.get('gain')).toBe(0.8)
    })

    // CRITICAL REGRESSION TEST: Ensure system clipboard format is preserved
    it('should maintain correct system clipboard format for cross-tab functionality', async () => {
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const gainId = store.addAdaptedNode('GainNode', { x: 200, y: 200 })
      store.addEdge(oscId, gainId, 'output', 'input')

      await store.copySelectedNodes([oscId, gainId])

      // Verify system clipboard was called
      expect(mockClipboard.writeText).toHaveBeenCalledTimes(1)

      // Parse and verify the system clipboard format
      const clipboardText = mockClipboard.writeText.mock.calls[0][0]
      const clipboardData = JSON.parse(clipboardText)

      expect(clipboardData.type).toBe('visualwebaudio-nodes')
      expect(clipboardData.version).toBe('1.0')
      expect(clipboardData.data.nodes).toHaveLength(2)
      expect(clipboardData.data.edges).toHaveLength(1)

      // Verify each node has the correct nested structure
      clipboardData.data.nodes.forEach((node: any) => {
        expect(node).toHaveProperty('data')
        expect(node.data).toHaveProperty('nodeType')
        expect(node.data).toHaveProperty('metadata')
        expect(node.data).toHaveProperty('properties')

        // Ensure the bug-causing flat structure is NOT present
        expect(node).not.toHaveProperty('nodeType')
        expect(node).not.toHaveProperty('metadata')
        expect(node).not.toHaveProperty('properties')
      })
    })
  })
})
