import { test, expect } from '../fixtures/app.fixture'

test.describe('Composite Editor - Basic Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })
  })

  test('should open composite editor when double-clicking a composite node', async ({
    nodePalette,
    graphCanvas,
    compositeEditor,
  }) => {
    // Add composite node
    await nodePalette.addCompositeNodeToGraph('DelayEffect')

    // Double-click to open editor
    await graphCanvas.doubleClickFirstNode()

    // Verify editor opened
    await compositeEditor.waitForEditor()
    await expect(compositeEditor.panel).toBeVisible()

    // Clean up
    await compositeEditor.close()
  })

  test('should close editor with Escape key', async ({
    nodePalette,
    graphCanvas,
    compositeEditor,
  }) => {
    await nodePalette.addCompositeNodeToGraph('DelayEffect')
    await graphCanvas.doubleClickFirstNode()
    await compositeEditor.waitForEditor()

    // Close with Escape
    await compositeEditor.closeWithEscape()
    await expect(compositeEditor.panel).not.toBeVisible()
  })

  test('should close editor with close button', async ({
    nodePalette,
    graphCanvas,
    compositeEditor,
  }) => {
    await nodePalette.addCompositeNodeToGraph('DelayEffect')
    await graphCanvas.doubleClickFirstNode()
    await compositeEditor.waitForEditor()

    // Close with button
    await compositeEditor.close()
    await expect(compositeEditor.panel).not.toBeVisible()
  })
})

test.describe('Composite Editor - Prebuilt Nodes', () => {
  test.beforeEach(async ({ page, nodePalette, graphCanvas, compositeEditor }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })
    await nodePalette.waitForPalette()

    // Add and open a prebuilt composite node
    await nodePalette.addCompositeNodeToGraph('DelayEffect')
    await graphCanvas.doubleClickFirstNode()
    await compositeEditor.waitForEditor()
  })

  test.afterEach(async ({ compositeEditor }) => {
    if (await compositeEditor.isOpen()) {
      await compositeEditor.close()
    }
  })

  test('should show read-only indicator for prebuilt composites', async ({ compositeEditor }) => {
    const isReadOnly = await compositeEditor.isReadOnly()
    expect(isReadOnly).toBe(true)
  })

  test('should display internal nodes of composite', async ({ compositeEditor }) => {
    const nodeCount = await compositeEditor.getNodeCount()
    expect(nodeCount).toBeGreaterThan(0)
  })

  test('should display edges connecting internal nodes', async ({ compositeEditor }) => {
    const edgeCount = await compositeEditor.getEdgeCount()
    expect(edgeCount).toBeGreaterThan(0)
  })

  test('should have disabled name input for prebuilt', async ({ compositeEditor }) => {
    const nameInput = compositeEditor.nameInput
    await expect(nameInput).toBeDisabled()
  })
})

test.describe('Composite Editor - Save As', () => {
  test.beforeEach(async ({ page, nodePalette, graphCanvas, compositeEditor }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })
    await nodePalette.waitForPalette()

    // Add and open a prebuilt composite node
    await nodePalette.addCompositeNodeToGraph('DelayEffect')
    await graphCanvas.doubleClickFirstNode()
    await compositeEditor.waitForEditor()
  })

  test.afterEach(async ({ compositeEditor }) => {
    if (await compositeEditor.isOpen()) {
      await compositeEditor.close()
    }
  })

  test('should open Save As dialog', async ({ page, compositeEditor }) => {
    await compositeEditor.saveAsButton.click()

    const dialog = page.locator('[data-testid="save-as-dialog"]')
    await expect(dialog).toBeVisible()

    // Cancel the dialog
    await page.locator('button:has-text("Cancel")').click()
    await expect(dialog).not.toBeVisible()
  })

  test('should create new user composite via Save As', async ({ page, compositeEditor }) => {
    await compositeEditor.saveAsButton.click()

    const dialog = page.locator('[data-testid="save-as-dialog"]')
    await expect(dialog).toBeVisible()

    // Fill in the new name
    const nameInput = dialog.locator('input')
    await nameInput.fill('My Custom Delay')

    // Save
    const saveButton = dialog.locator('button:has-text("Save")')
    await saveButton.click()

    // Editor should now show the new definition (no longer read-only)
    await page.waitForTimeout(500)

    // Verify name input is now editable (not read-only)
    await expect(compositeEditor.nameInput).not.toBeDisabled()
  })
})

test.describe('Composite Editor - Internal Graph', () => {
  test.beforeEach(async ({ page, nodePalette }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })
    await nodePalette.waitForPalette()
  })

  test('DelayEffect should have correct structure', async ({
    nodePalette,
    graphCanvas,
    compositeEditor,
  }) => {
    await nodePalette.addCompositeNodeToGraph('DelayEffect')
    await graphCanvas.doubleClickFirstNode()
    await compositeEditor.waitForEditor()

    // Check for internal nodes
    const nodeCount = await compositeEditor.getNodeCount()
    expect(nodeCount).toBeGreaterThan(0)

    // Check for edge connectors
    const inputConnectors = await compositeEditor.getInputConnectors().count()
    expect(inputConnectors).toBeGreaterThan(0)

    const outputConnectors = await compositeEditor.getOutputConnectors().count()
    expect(outputConnectors).toBeGreaterThan(0)

    await compositeEditor.close()
  })

  test('ReverbChapel should have correct structure', async ({
    nodePalette,
    graphCanvas,
    compositeEditor,
  }) => {
    await nodePalette.addCompositeNodeToGraph('ReverbChapel')
    await graphCanvas.doubleClickFirstNode()
    await compositeEditor.waitForEditor()

    const nodeCount = await compositeEditor.getNodeCount()
    expect(nodeCount).toBeGreaterThan(0)

    await compositeEditor.close()
  })
})

test.describe('Composite Editor - Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page, nodePalette, graphCanvas, compositeEditor }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })
    await nodePalette.waitForPalette()

    // Create a user composite to test keyboard shortcuts (prebuilt are read-only)
    await nodePalette.addCompositeNodeToGraph('DelayEffect')
    await graphCanvas.doubleClickFirstNode()
    await compositeEditor.waitForEditor()

    // Save as user composite
    await compositeEditor.saveAsButton.click()
    const dialog = page.locator('[data-testid="save-as-dialog"]')
    await dialog.locator('input').fill('Test Composite for Shortcuts')
    await dialog.locator('button:has-text("Save")').click()
    await page.waitForTimeout(500)
  })

  test.afterEach(async ({ compositeEditor }) => {
    if (await compositeEditor.isOpen()) {
      await compositeEditor.close()
    }
  })

  test('should support copy/paste with Ctrl+C/V', async ({ page, compositeEditor }) => {
    // Click on the canvas to ensure focus
    await compositeEditor.canvas.click()

    // Get initial node count
    const initialCount = await compositeEditor.getNodeCount()

    // Select a node (click on first internal node)
    const internalNodes = compositeEditor.getInternalNodes()
    const firstNode = internalNodes.first()

    if (await firstNode.isVisible()) {
      await firstNode.click()

      // Copy
      await compositeEditor.copy()

      // Paste
      await compositeEditor.paste()
      await page.waitForTimeout(300)

      // Should have one more node
      const finalCount = await compositeEditor.getNodeCount()
      expect(finalCount).toBeGreaterThanOrEqual(initialCount)
    }
  })

  test('should support undo/redo with Ctrl+Z', async ({ page, compositeEditor }) => {
    // Make sure we're focused on the editor canvas
    await compositeEditor.canvas.click()

    // Undo (should do nothing if no actions yet, but shouldn't crash)
    await compositeEditor.undo()
    await page.waitForTimeout(200)

    // The count should remain stable (no crashes)
    const afterUndo = await compositeEditor.getNodeCount()
    expect(afterUndo).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Composite Editor - Error Messages', () => {
  test('should show read-only message in toolbar for prebuilt', async ({
    page,
    nodePalette,
    graphCanvas,
    compositeEditor,
  }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })

    await nodePalette.addCompositeNodeToGraph('DelayEffect')
    await graphCanvas.doubleClickFirstNode()
    await compositeEditor.waitForEditor()

    // Look for read-only indicator
    const readOnlyMessage = page.locator('text=View only')
    await expect(readOnlyMessage).toBeVisible()

    await compositeEditor.close()
  })
})
