import { describe, it, expect, beforeEach } from 'vitest'
import { type INodeAdapter } from './NodeAdapter'
import { createAudioGraphStore } from './AudioGraphStore'
import { waitFor } from '@testing-library/react'

describe('NodeAdapter', () => {
  let store: any

  beforeEach(() => {
    store = createAudioGraphStore()
    store.loadMetadata()
  })

  describe('Basic Creation and Properties', () => {
    it('should create a NodeAdapter instance', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      expect(store.adaptedNodes.length).toBe(1)

      const adaptedNode = store.adaptedNodes[0]
      expect(adaptedNode.id).toBe(nodeId)
      expect(adaptedNode.nodeType).toBe('OscillatorNode')
      expect(adaptedNode.position.x).toBe(100)
      expect(adaptedNode.position.y).toBe(100)
    })

    it('should identify WebAudio nodes correctly', () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      expect(adaptedNode.isWebAudioNode).toBe(true)
      expect(adaptedNode.isCustomNode).toBe(false)
    })

    it('should identify Custom nodes correctly', () => {
      // Use an existing custom node type instead of creating a fake one
      store.addAdaptedNode('SliderNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      expect(adaptedNode.isWebAudioNode).toBe(false)
      expect(adaptedNode.isCustomNode).toBe(true)
    })

    it('should have correct metadata structure', () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      expect(adaptedNode.metadata).toBeDefined()
      expect(adaptedNode.metadata.name).toBe('OscillatorNode')
      expect(adaptedNode.metadata.category).toBe('source')
      expect(adaptedNode.metadata.inputs).toBeDefined()
      expect(adaptedNode.metadata.outputs).toBeDefined()
      expect(adaptedNode.metadata.properties).toBeDefined()
    })
  })

  describe('Property Management', () => {
    it('should handle property updates', () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      // Update a property
      adaptedNode.updateProperty('frequency', 880)

      // Check that the property was updated
      expect(adaptedNode.properties.get('frequency')).toBe(880)
    })

    it('should initialize with default properties', () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      // Check that default properties are set
      expect(adaptedNode.properties.get('frequency')).toBeDefined()
      expect(adaptedNode.properties.get('type')).toBeDefined()
    })

    it('should handle multiple property updates', () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      adaptedNode.updateProperty('frequency', 440)
      adaptedNode.updateProperty('type', 'square')

      expect(adaptedNode.properties.get('frequency')).toBe(440)
      expect(adaptedNode.properties.get('type')).toBe('square')
    })

    it('should handle property updates for different node types', () => {
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const gainId = store.addAdaptedNode('GainNode', { x: 200, y: 200 })

      const oscNode = store.adaptedNodes.find((n: any) => n.id === oscId)
      const gainNode = store.adaptedNodes.find((n: any) => n.id === gainId)

      oscNode.updateProperty('frequency', 880)
      gainNode.updateProperty('gain', 0.5)

      expect(oscNode.properties.get('frequency')).toBe(880)
      expect(gainNode.properties.get('gain')).toBe(0.5)
    })
  })

  describe('Position Management', () => {
    it('should handle position updates', () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      adaptedNode.updatePosition(200, 300)

      expect(adaptedNode.position.x).toBe(200)
      expect(adaptedNode.position.y).toBe(300)
    })

    it('should maintain position consistency', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 150, y: 250 })
      const adaptedNode = store.adaptedNodes[0]

      expect(adaptedNode.position.x).toBe(150)
      expect(adaptedNode.position.y).toBe(250)

      // Update through store method
      store.updateNodePosition(nodeId, { x: 300, y: 400 })

      expect(adaptedNode.position.x).toBe(300)
      expect(adaptedNode.position.y).toBe(400)
    })
  })

  describe('Connection Management', () => {
    it('should handle input connections', () => {
      const sourceId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const targetId = store.addAdaptedNode('GainNode', { x: 200, y: 200 })

      const targetNode = store.adaptedNodes.find((n: INodeAdapter) => n.id === targetId)

      targetNode.addInputConnection(sourceId, 'output', 'input')

      expect(targetNode.inputConnections.length).toBe(1)
      expect(targetNode.inputConnections[0].sourceNodeId).toBe(sourceId)
      expect(targetNode.inputConnections[0].sourceOutput).toBe('output')
      expect(targetNode.inputConnections[0].targetInput).toBe('input')
    })

    it('should handle output connections', () => {
      const sourceId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const targetId = store.addAdaptedNode('GainNode', { x: 200, y: 200 })

      const sourceNode = store.adaptedNodes.find((n: INodeAdapter) => n.id === sourceId)

      sourceNode.addOutputConnection(targetId, 'output', 'input')

      expect(sourceNode.outputConnections.length).toBe(1)
      expect(sourceNode.outputConnections[0].targetNodeId).toBe(targetId)
      expect(sourceNode.outputConnections[0].sourceOutput).toBe('output')
      expect(sourceNode.outputConnections[0].targetInput).toBe('input')
    })

    it('should remove connections correctly', () => {
      const sourceId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const targetId = store.addAdaptedNode('GainNode', { x: 200, y: 200 })

      const sourceNode = store.adaptedNodes.find((n: INodeAdapter) => n.id === sourceId)
      const targetNode = store.adaptedNodes.find((n: INodeAdapter) => n.id === targetId)

      // Add connections
      sourceNode.addOutputConnection(targetId, 'output', 'input')
      targetNode.addInputConnection(sourceId, 'output', 'input')

      expect(sourceNode.outputConnections.length).toBe(1)
      expect(targetNode.inputConnections.length).toBe(1)

      // Remove connections
      sourceNode.removeOutputConnection(targetId, 'output', 'input')
      targetNode.removeInputConnection(sourceId, 'output', 'input')

      expect(sourceNode.outputConnections.length).toBe(0)
      expect(targetNode.inputConnections.length).toBe(0)
    })

    it('should prevent duplicate connections', () => {
      const sourceId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const targetId = store.addAdaptedNode('GainNode', { x: 200, y: 200 })

      const targetNode = store.adaptedNodes.find((n: INodeAdapter) => n.id === targetId)

      // Add the same connection twice
      targetNode.addInputConnection(sourceId, 'output', 'input')
      targetNode.addInputConnection(sourceId, 'output', 'input')

      // Should only have one connection
      expect(targetNode.inputConnections.length).toBe(1)
    })
  })

  describe('React Flow Integration', () => {
    it('should provide React Flow compatible data', () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      const reactFlowData = adaptedNode.reactFlowData

      expect(reactFlowData.nodeType).toBe('OscillatorNode')
      expect(reactFlowData.metadata.name).toBe('OscillatorNode')
      expect(reactFlowData.metadata.category).toBe('source')
      expect(reactFlowData.properties).toBeDefined()
    })

    it('should provide correct handle information', () => {
      store.addAdaptedNode('GainNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      const reactFlowData = adaptedNode.reactFlowData

      // GainNode should have both inputs and outputs
      expect(reactFlowData.metadata.inputs.length).toBeGreaterThan(0)
      expect(reactFlowData.metadata.outputs.length).toBeGreaterThan(0)
    })
  })

  describe('Lifecycle Management', () => {
    it('should initialize correctly', async () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      // Wait for initialization
      await waitFor(() => {
        expect(adaptedNode.isAttached).toBe(true)
      })
    })

    it('should handle cleanup on removal', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      expect(store.adaptedNodes.length).toBe(1)

      // Remove the node using the nodeId
      store.removeNode(nodeId)

      expect(store.adaptedNodes.length).toBe(0)
    })

    it('should handle multiple nodes lifecycle', async () => {
      const nodeIds = []

      // Create multiple nodes
      for (let i = 0; i < 5; i++) {
        nodeIds.push(store.addAdaptedNode('OscillatorNode', { x: i * 100, y: 100 }))
      }

      expect(store.adaptedNodes.length).toBe(5)

      // Wait for all to initialize
      await waitFor(() => {
        store.adaptedNodes.forEach((node: INodeAdapter) => {
          expect(node.isAttached).toBe(true)
        })
      })

      // Remove all
      nodeIds.forEach(id => store.removeNode(id))

      expect(store.adaptedNodes.length).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid property updates gracefully', () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      // Should not throw for invalid property
      expect(() => {
        adaptedNode.updateProperty('invalidProperty', 'value')
      }).not.toThrow()
    })

    it('should handle connection to non-existent node gracefully', () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      // Should not throw for connection to non-existent node
      expect(() => {
        adaptedNode.addOutputConnection('non-existent-id', 'output', 'input')
      }).not.toThrow()
    })

    it('should handle removal of non-existent connections gracefully', () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      // Should not throw for removing non-existent connection
      expect(() => {
        adaptedNode.removeOutputConnection('non-existent-id', 'output', 'input')
      }).not.toThrow()
    })
  })

  describe('Serialization and Deserialization', () => {
    it('should serialize correctly', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      adaptedNode.updateProperty('frequency', 880)

      const serialized = JSON.parse(JSON.stringify(adaptedNode))

      expect(serialized.id).toBe(nodeId)
      expect(serialized.nodeType).toBe('OscillatorNode')
      expect(serialized.position.x).toBe(100)
      expect(serialized.position.y).toBe(100)
    })

    it('should maintain state after serialization/deserialization', () => {
      // Create a node for testing serialization
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const adaptedNode = store.adaptedNodes[0]

      adaptedNode.updateProperty('frequency', 880)
      adaptedNode.updatePosition(200, 300)

      // Get snapshot and restore
      const snapshot = JSON.parse(JSON.stringify(store))

      expect(snapshot.adaptedNodes[0].nodeType).toBe('OscillatorNode')
      expect(snapshot.adaptedNodes[0].position.x).toBe(200)
      expect(snapshot.adaptedNodes[0].position.y).toBe(300)
    })
  })

  describe('Integration with AudioGraphStore', () => {
    it('should integrate with store node management', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      expect(store.adaptedNodes.length).toBe(1)
      expect(store.adaptedNodes[0].id).toBe(nodeId)

      store.removeNode(nodeId)

      expect(store.adaptedNodes.length).toBe(0)
    })

    it('should work with store property updates', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      store.updateNodeProperty(nodeId, 'frequency', 880)

      const adaptedNode = store.adaptedNodes[0]
      expect(adaptedNode.properties.get('frequency')).toBe(880)
    })

    it('should work with store position updates', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      store.updateNodePosition(nodeId, { x: 200, y: 300 })

      const adaptedNode = store.adaptedNodes[0]
      expect(adaptedNode.position.x).toBe(200)
      expect(adaptedNode.position.y).toBe(300)
    })
  })
})
