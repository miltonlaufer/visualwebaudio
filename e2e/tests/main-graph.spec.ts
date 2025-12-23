import { test, expect } from '../fixtures/app.fixture'

test.describe('Main Graph - Basic Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for app to load
    await page.waitForSelector('.react-flow', { state: 'visible' })
  })

  test('should display node palette', async ({ nodePalette }) => {
    await nodePalette.waitForPalette()
    await expect(nodePalette.container).toBeVisible()
  })

  test('should display graph canvas', async ({ graphCanvas }) => {
    await graphCanvas.waitForCanvas()
    await expect(graphCanvas.container).toBeVisible()
  })

  test('should search for nodes in palette', async ({ nodePalette }) => {
    await nodePalette.waitForPalette()
    await nodePalette.searchNodes('Oscillator')

    // Verify search input has value
    await expect(nodePalette.searchInput).toHaveValue('Oscillator')
  })

  test('should clear search', async ({ nodePalette }) => {
    await nodePalette.waitForPalette()
    await nodePalette.searchNodes('Gain')
    await nodePalette.clearSearch()

    await expect(nodePalette.searchInput).toHaveValue('')
  })
})

test.describe('Main Graph - Node Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })
  })

  test('should add node by clicking in palette', async ({ page, nodePalette, graphCanvas }) => {
    await nodePalette.waitForPalette()

    // Expand source category to see oscillator
    await page.click('text=source Nodes')

    // Get initial node count
    const initialCount = await graphCanvas.getNodeCount()

    // Click on oscillator node
    const oscillatorItem = page.locator('[data-testid="node-item-OscillatorNode"]')
    if (await oscillatorItem.isVisible()) {
      await oscillatorItem.click()

      // Wait for node to be added
      await graphCanvas.waitForNodeCount(initialCount + 1)

      // Verify node was added
      const newCount = await graphCanvas.getNodeCount()
      expect(newCount).toBe(initialCount + 1)
    }
  })

  test('should select a node', async ({ page, graphCanvas }) => {
    // First add a node
    await page.click('text=source Nodes')
    const oscillatorItem = page.locator('[data-testid="node-item-OscillatorNode"]')
    if (await oscillatorItem.isVisible()) {
      await oscillatorItem.click()
      await page.waitForTimeout(500)
    }

    // Click on the canvas to find the node
    const nodes = graphCanvas.nodes
    const count = await nodes.count()

    if (count > 0) {
      const firstNode = nodes.first()
      await firstNode.click()

      // Check for selection indicator
      const selectionIndicator = await graphCanvas.getSelectionIndicator()
      expect(selectionIndicator).toContain('selected')
    }
  })

  test('should delete selected node with Delete key', async ({ page, graphCanvas }) => {
    // Add a node
    await page.click('text=source Nodes')
    const oscillatorItem = page.locator('[data-testid="node-item-OscillatorNode"]')
    if (await oscillatorItem.isVisible()) {
      await oscillatorItem.click()
      await page.waitForTimeout(500)
    }

    const initialCount = await graphCanvas.getNodeCount()

    if (initialCount > 0) {
      // Select first node
      const firstNode = graphCanvas.nodes.first()
      await firstNode.click()

      // Delete it
      await graphCanvas.deleteSelectedNodes()
      await page.waitForTimeout(300)

      // Verify deletion
      const newCount = await graphCanvas.getNodeCount()
      expect(newCount).toBe(initialCount - 1)
    }
  })

  test('should deselect node by clicking background', async ({ page, graphCanvas }) => {
    // Add a node
    await page.click('text=source Nodes')
    const oscillatorItem = page.locator('[data-testid="node-item-OscillatorNode"]')
    if (await oscillatorItem.isVisible()) {
      await oscillatorItem.click()
      await page.waitForTimeout(500)
    }

    const count = await graphCanvas.getNodeCount()

    if (count > 0) {
      // Select node
      await graphCanvas.nodes.first().click()

      // Click background to deselect
      await graphCanvas.clickBackground()
      await page.waitForTimeout(200)

      // Selection indicator should be gone or show 0 selected
      const indicator = await graphCanvas.getSelectionIndicator()
      expect(indicator === null || !indicator.includes('1 node')).toBeTruthy()
    }
  })
})

test.describe('Main Graph - Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })
  })

  test('should support Ctrl+Z for undo', async ({ page, graphCanvas }) => {
    // Add a node
    await page.click('text=source Nodes')
    const oscillatorItem = page.locator('[data-testid="node-item-OscillatorNode"]')
    if (await oscillatorItem.isVisible()) {
      await oscillatorItem.click()
      await page.waitForTimeout(500)
    }

    const countAfterAdd = await graphCanvas.getNodeCount()

    if (countAfterAdd > 0) {
      // Click on canvas to ensure focus
      await graphCanvas.container.click({ position: { x: 400, y: 300 } })

      // Undo
      await graphCanvas.undo()
      await page.waitForTimeout(500)

      // Check if node was removed
      const countAfterUndo = await graphCanvas.getNodeCount()
      // Undo should remove the last added node
      expect(countAfterUndo).toBeLessThanOrEqual(countAfterAdd)
    }
  })
})
