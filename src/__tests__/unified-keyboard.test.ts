/**
 * Tests for Unified Keyboard Handler System
 *
 * These tests verify that the unified keyboard handler correctly routes
 * operations to the active context (main graph or composite editor).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { graphFocusStore, type IGraphOperations } from '~/stores/GraphFocusStore'
import type { Node } from '@xyflow/react'

/******************* MOCK HANDLER ***********************/

function createMockHandler(overrides: Partial<IGraphOperations> = {}): IGraphOperations {
  return {
    getSelectedNodeIds: () => [],
    getSelectedEdgeIds: () => [],
    selectNodes: () => {},
    deselectAll: () => {},
    copyNodes: () => [],
    cutNodes: () => {},
    pasteNodes: () => {},
    deleteNodes: () => {},
    deleteEdges: () => {},
    canUndo: () => false,
    canRedo: () => false,
    undo: () => {},
    redo: () => {},
    isReadOnly: () => false,
    ...overrides,
  }
}

/******************* TESTS ***********************/

describe('GraphFocusStore', () => {
  beforeEach(() => {
    // Reset store state
    graphFocusStore.setActiveContext('main')
    graphFocusStore.registerMainGraphHandler(null)
    graphFocusStore.registerCompositeEditorHandler(null)
    graphFocusStore.clearClipboard()
  })

  describe('Context Management', () => {
    it('should default to main context', () => {
      expect(graphFocusStore.activeContext).toBe('main')
    })

    it('should switch to composite context', () => {
      graphFocusStore.activateCompositeEditor()
      expect(graphFocusStore.activeContext).toBe('composite')
    })

    it('should switch back to main context', () => {
      graphFocusStore.activateCompositeEditor()
      graphFocusStore.activateMainGraph()
      expect(graphFocusStore.activeContext).toBe('main')
    })
  })

  describe('Handler Registration', () => {
    it('should register main graph handler', () => {
      const handler = createMockHandler()
      graphFocusStore.registerMainGraphHandler(handler)
      expect(graphFocusStore.mainGraphHandler).toBe(handler)
    })

    it('should register composite editor handler', () => {
      const handler = createMockHandler()
      graphFocusStore.registerCompositeEditorHandler(handler)
      expect(graphFocusStore.compositeEditorHandler).toBe(handler)
    })

    it('should return active handler based on context', () => {
      const mainHandler = createMockHandler()
      const compositeHandler = createMockHandler()

      graphFocusStore.registerMainGraphHandler(mainHandler)
      graphFocusStore.registerCompositeEditorHandler(compositeHandler)

      // When main is active
      graphFocusStore.activateMainGraph()
      expect(graphFocusStore.activeHandler).toBe(mainHandler)

      // When composite is active
      graphFocusStore.activateCompositeEditor()
      expect(graphFocusStore.activeHandler).toBe(compositeHandler)
    })

    it('should fall back to main handler when composite handler is null', () => {
      const mainHandler = createMockHandler()
      graphFocusStore.registerMainGraphHandler(mainHandler)
      graphFocusStore.activateCompositeEditor()

      // Should fall back to main handler since composite is null
      expect(graphFocusStore.activeHandler).toBe(mainHandler)
    })
  })

  describe('Clipboard Operations', () => {
    it('should copy nodes to clipboard', () => {
      const nodes: Node[] = [
        { id: 'node1', position: { x: 0, y: 0 }, data: { nodeType: 'Gain' } },
        { id: 'node2', position: { x: 100, y: 0 }, data: { nodeType: 'Filter' } },
      ]

      const handler = createMockHandler({
        getSelectedNodeIds: () => ['node1', 'node2'],
        copyNodes: (nodeIds: string[]) => nodes.filter(n => nodeIds.includes(n.id)),
      })

      graphFocusStore.registerMainGraphHandler(handler)
      graphFocusStore.activateMainGraph()

      const success = graphFocusStore.copy()

      expect(success).toBe(true)
      expect(graphFocusStore.canPaste).toBe(true)
      expect(graphFocusStore.clipboardNodes.length).toBe(2)
    })

    it('should not copy if no nodes selected', () => {
      const handler = createMockHandler({
        getSelectedNodeIds: () => [],
      })

      graphFocusStore.registerMainGraphHandler(handler)
      const success = graphFocusStore.copy()

      expect(success).toBe(false)
      expect(graphFocusStore.canPaste).toBe(false)
    })

    it('should cut nodes', () => {
      const cutNodeIds: string[] = []
      const nodes: Node[] = [{ id: 'node1', position: { x: 0, y: 0 }, data: { nodeType: 'Gain' } }]

      const handler = createMockHandler({
        getSelectedNodeIds: () => ['node1'],
        copyNodes: (nodeIds: string[]) => nodes.filter(n => nodeIds.includes(n.id)),
        cutNodes: (nodeIds: string[]) => cutNodeIds.push(...nodeIds),
      })

      graphFocusStore.registerMainGraphHandler(handler)
      const success = graphFocusStore.cut()

      expect(success).toBe(true)
      expect(cutNodeIds).toEqual(['node1'])
      expect(graphFocusStore.canPaste).toBe(true)
    })

    it('should not cut if read-only', () => {
      const handler = createMockHandler({
        getSelectedNodeIds: () => ['node1'],
        isReadOnly: () => true,
      })

      graphFocusStore.registerMainGraphHandler(handler)
      const success = graphFocusStore.cut()

      expect(success).toBe(false)
    })

    it('should paste nodes', () => {
      let pastedNodes: Node[] = []

      const nodes: Node[] = [{ id: 'node1', position: { x: 0, y: 0 }, data: { nodeType: 'Gain' } }]

      const handler = createMockHandler({
        getSelectedNodeIds: () => ['node1'],
        copyNodes: (nodeIds: string[]) => nodes.filter(n => nodeIds.includes(n.id)),
        pasteNodes: (nodes: Node[]) => {
          pastedNodes = nodes
        },
      })

      graphFocusStore.registerMainGraphHandler(handler)

      // First copy
      graphFocusStore.copy()

      // Then paste
      const success = graphFocusStore.paste()

      expect(success).toBe(true)
      expect(pastedNodes.length).toBe(1)
    })

    it('should not paste if clipboard is empty', () => {
      const handler = createMockHandler()
      graphFocusStore.registerMainGraphHandler(handler)

      const success = graphFocusStore.paste()

      expect(success).toBe(false)
    })

    it('should clear clipboard', () => {
      const nodes: Node[] = [{ id: 'node1', position: { x: 0, y: 0 }, data: { nodeType: 'Gain' } }]

      const handler = createMockHandler({
        getSelectedNodeIds: () => ['node1'],
        copyNodes: () => nodes,
      })

      graphFocusStore.registerMainGraphHandler(handler)
      graphFocusStore.copy()

      expect(graphFocusStore.canPaste).toBe(true)

      graphFocusStore.clearClipboard()

      expect(graphFocusStore.canPaste).toBe(false)
    })
  })

  describe('Delete Operations', () => {
    it('should delete selected nodes', () => {
      const deletedNodeIds: string[] = []

      const handler = createMockHandler({
        getSelectedNodeIds: () => ['node1', 'node2'],
        deleteNodes: (nodeIds: string[]) => deletedNodeIds.push(...nodeIds),
      })

      graphFocusStore.registerMainGraphHandler(handler)
      const success = graphFocusStore.deleteSelected()

      expect(success).toBe(true)
      expect(deletedNodeIds).toEqual(['node1', 'node2'])
    })

    it('should delete selected edges if no nodes selected', () => {
      const deletedEdgeIds: string[] = []

      const handler = createMockHandler({
        getSelectedNodeIds: () => [],
        getSelectedEdgeIds: () => ['edge1'],
        deleteEdges: (edgeIds: string[]) => deletedEdgeIds.push(...edgeIds),
      })

      graphFocusStore.registerMainGraphHandler(handler)
      const success = graphFocusStore.deleteSelected()

      expect(success).toBe(true)
      expect(deletedEdgeIds).toEqual(['edge1'])
    })

    it('should not delete if read-only', () => {
      const handler = createMockHandler({
        getSelectedNodeIds: () => ['node1'],
        isReadOnly: () => true,
      })

      graphFocusStore.registerMainGraphHandler(handler)
      const success = graphFocusStore.deleteSelected()

      expect(success).toBe(false)
    })
  })

  describe('Undo/Redo Operations', () => {
    it('should undo', () => {
      let undoCalled = false

      const handler = createMockHandler({
        canUndo: () => true,
        undo: () => {
          undoCalled = true
        },
      })

      graphFocusStore.registerMainGraphHandler(handler)
      const success = graphFocusStore.undo()

      expect(success).toBe(true)
      expect(undoCalled).toBe(true)
    })

    it('should not undo if cannot undo', () => {
      const handler = createMockHandler({
        canUndo: () => false,
      })

      graphFocusStore.registerMainGraphHandler(handler)
      const success = graphFocusStore.undo()

      expect(success).toBe(false)
    })

    it('should redo', () => {
      let redoCalled = false

      const handler = createMockHandler({
        canRedo: () => true,
        redo: () => {
          redoCalled = true
        },
      })

      graphFocusStore.registerMainGraphHandler(handler)
      const success = graphFocusStore.redo()

      expect(success).toBe(true)
      expect(redoCalled).toBe(true)
    })

    it('should report canUndo correctly', () => {
      const handler = createMockHandler({
        canUndo: () => true,
      })

      graphFocusStore.registerMainGraphHandler(handler)
      expect(graphFocusStore.canUndo()).toBe(true)
    })

    it('should report canRedo correctly', () => {
      const handler = createMockHandler({
        canRedo: () => true,
      })

      graphFocusStore.registerMainGraphHandler(handler)
      expect(graphFocusStore.canRedo()).toBe(true)
    })
  })

  describe('Context Switching', () => {
    it('should route operations to the correct context', () => {
      let mainCopyCount = 0
      let compositeCopyCount = 0

      const mainHandler = createMockHandler({
        getSelectedNodeIds: () => ['node1'],
        copyNodes: () => {
          mainCopyCount++
          return [{ id: 'node1', position: { x: 0, y: 0 }, data: {} }]
        },
      })

      const compositeHandler = createMockHandler({
        getSelectedNodeIds: () => ['internal_node1'],
        copyNodes: () => {
          compositeCopyCount++
          return [{ id: 'internal_node1', position: { x: 0, y: 0 }, data: {} }]
        },
      })

      graphFocusStore.registerMainGraphHandler(mainHandler)
      graphFocusStore.registerCompositeEditorHandler(compositeHandler)

      // Copy in main context
      graphFocusStore.activateMainGraph()
      graphFocusStore.copy()
      expect(mainCopyCount).toBe(1)
      expect(compositeCopyCount).toBe(0)

      // Copy in composite context
      graphFocusStore.activateCompositeEditor()
      graphFocusStore.copy()
      expect(mainCopyCount).toBe(1)
      expect(compositeCopyCount).toBe(1)
    })
  })

  describe('Read-Only Context', () => {
    it('should report isActiveContextReadOnly correctly', () => {
      const readOnlyHandler = createMockHandler({
        isReadOnly: () => true,
      })

      const editableHandler = createMockHandler({
        isReadOnly: () => false,
      })

      graphFocusStore.registerMainGraphHandler(editableHandler)
      graphFocusStore.registerCompositeEditorHandler(readOnlyHandler)

      graphFocusStore.activateMainGraph()
      expect(graphFocusStore.isActiveContextReadOnly).toBe(false)

      graphFocusStore.activateCompositeEditor()
      expect(graphFocusStore.isActiveContextReadOnly).toBe(true)
    })
  })
})
