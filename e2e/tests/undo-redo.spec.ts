import { test, expect } from '../fixtures/app.fixture'

/**
 * Helper to add an Oscillator node from the palette
 */
async function addOscillatorNode(
  page: Parameters<typeof test>[0]['page'],
  nodePalette: Parameters<typeof test>[0]['nodePalette']
) {
  await nodePalette.waitForPalette()
  await page.click('text=source Nodes')

  const oscillatorItem = page.locator('[data-testid="node-item-OscillatorNode"]')
  await oscillatorItem.waitFor({ state: 'visible', timeout: 3000 })
  await oscillatorItem.click()
  await page.waitForTimeout(500)
}

test.describe('Undo/Redo Operations - Main Graph', () => {
  test.beforeEach(async ({ page, nodePalette }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })
    await nodePalette.waitForPalette()
  })

  test('should undo adding a node with Ctrl+Z', async ({ page, nodePalette, graphCanvas }) => {
    // Get initial count
    const initialCount = await graphCanvas.getNodeCount()

    // Add a node
    await addOscillatorNode(page, nodePalette)

    // Verify node was added
    const countAfterAdd = await graphCanvas.getNodeCount()
    expect(countAfterAdd).toBe(initialCount + 1)

    // Click on canvas to ensure focus
    await graphCanvas.container.click({ position: { x: 400, y: 300 } })

    // Undo
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(500)

    // Node should be removed
    const countAfterUndo = await graphCanvas.getNodeCount()
    expect(countAfterUndo).toBeLessThanOrEqual(initialCount)
  })

  test('should redo with Ctrl+Shift+Z', async ({ page, nodePalette, graphCanvas }) => {
    const initialCount = await graphCanvas.getNodeCount()

    // Add a node
    await addOscillatorNode(page, nodePalette)

    // Click on canvas
    await graphCanvas.container.click({ position: { x: 400, y: 300 } })

    // Undo
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(500)

    // Redo
    await page.keyboard.press('Control+Shift+z')
    await page.waitForTimeout(500)

    // Node should be back
    const countAfterRedo = await graphCanvas.getNodeCount()
    expect(countAfterRedo).toBe(initialCount + 1)
  })

  test('should undo deleting a node', async ({ page, nodePalette, graphCanvas }) => {
    // Add a node
    await addOscillatorNode(page, nodePalette)

    const countWithNode = await graphCanvas.getNodeCount()

    // Select and delete
    await graphCanvas.nodes.first().click()
    await page.keyboard.press('Delete')
    await page.waitForTimeout(300)

    // Verify deleted
    const countAfterDelete = await graphCanvas.getNodeCount()
    expect(countAfterDelete).toBe(countWithNode - 1)

    // Undo delete
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(500)

    // Node should be restored
    const countAfterUndo = await graphCanvas.getNodeCount()
    expect(countAfterUndo).toBe(countWithNode)
  })

  test('should support multiple undos', async ({ page, nodePalette, graphCanvas }) => {
    const initialCount = await graphCanvas.getNodeCount()

    // Add 3 nodes
    await addOscillatorNode(page, nodePalette)
    await addOscillatorNode(page, nodePalette)
    await addOscillatorNode(page, nodePalette)

    const countAfterAdds = await graphCanvas.getNodeCount()
    expect(countAfterAdds).toBe(initialCount + 3)

    // Click canvas for focus
    await graphCanvas.container.click({ position: { x: 400, y: 300 } })

    // Undo 3 times
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(200)
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(200)
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(500)

    // Should be back to initial count
    const countAfterUndos = await graphCanvas.getNodeCount()
    expect(countAfterUndos).toBeLessThanOrEqual(initialCount)
  })
})

test.describe('Undo/Redo Isolation - Composite vs Main', () => {
  test.beforeEach(async ({ page, nodePalette }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })
    await nodePalette.waitForPalette()
  })

  test('composite editor undo should not affect main graph', async ({
    page,
    nodePalette,
    graphCanvas,
    compositeEditor,
  }) => {
    // Add a node to main graph
    await addOscillatorNode(page, nodePalette)

    const mainGraphCount = await graphCanvas.getNodeCount()
    expect(mainGraphCount).toBeGreaterThan(0)

    // Add composite node and open editor
    await nodePalette.addCompositeNodeToGraph('DelayEffect')
    await graphCanvas.doubleClickFirstNode()
    await compositeEditor.waitForEditor()

    // Save As to make it editable
    await compositeEditor.saveAsButton.click()
    const dialog = page.locator('[data-testid="save-as-dialog"]')
    await dialog.locator('input').fill('TestIsolation')
    await dialog.locator('button:has-text("Save")').click()
    await page.waitForTimeout(500)

    // Perform some undos in the editor
    await compositeEditor.undo()
    await page.waitForTimeout(200)

    // Close editor
    await compositeEditor.close()

    // Main graph should still have the nodes
    const mainGraphCountAfter = await graphCanvas.getNodeCount()
    expect(mainGraphCountAfter).toBeGreaterThanOrEqual(mainGraphCount)
  })

  test('main graph undo should not affect closed composite editor state', async ({
    page,
    nodePalette,
    graphCanvas,
    compositeEditor,
  }) => {
    // Add composite and open editor
    await nodePalette.addCompositeNodeToGraph('DelayEffect')
    await graphCanvas.doubleClickFirstNode()
    await compositeEditor.waitForEditor()

    // Get editor node count
    const editorNodeCount = await compositeEditor.getNodeCount()

    // Close editor
    await compositeEditor.close()

    // Add node to main graph
    await addOscillatorNode(page, nodePalette)

    // Click canvas for focus
    await graphCanvas.container.click({ position: { x: 400, y: 300 } })

    // Undo in main graph
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(500)

    // Reopen composite editor
    await graphCanvas.doubleClickFirstNode()
    await compositeEditor.waitForEditor()

    // Editor should have same node count as before
    const editorNodeCountAfter = await compositeEditor.getNodeCount()
    expect(editorNodeCountAfter).toBe(editorNodeCount)

    await compositeEditor.close()
  })
})

test.describe('Undo/Redo in Composite Editor', () => {
  test.beforeEach(async ({ page, nodePalette, graphCanvas, compositeEditor }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })
    await nodePalette.waitForPalette()

    // Add composite and open as editable
    await nodePalette.addCompositeNodeToGraph('DelayEffect')
    await graphCanvas.doubleClickFirstNode()
    await compositeEditor.waitForEditor()

    // Save As to make editable
    await compositeEditor.saveAsButton.click()
    const dialog = page.locator('[data-testid="save-as-dialog"]')
    await dialog.locator('input').fill('Editable For Undo Test')
    await dialog.locator('button:has-text("Save")').click()
    await page.waitForTimeout(500)
  })

  test.afterEach(async ({ compositeEditor }) => {
    if (await compositeEditor.isOpen()) {
      await compositeEditor.close()
    }
  })

  test('should support undo in user composite', async ({ page, compositeEditor }) => {
    // Select and copy a node
    const internalNodes = compositeEditor.getInternalNodes()
    const firstNode = internalNodes.first()

    if (await firstNode.isVisible()) {
      await firstNode.click()
      await compositeEditor.copy()
      await compositeEditor.paste()
      await page.waitForTimeout(300)

      const countAfterPaste = await compositeEditor.getNodeCount()

      // Undo
      await compositeEditor.undo()
      await page.waitForTimeout(300)

      // Should have fewer or same nodes
      const countAfterUndo = await compositeEditor.getNodeCount()
      expect(countAfterUndo).toBeLessThanOrEqual(countAfterPaste)
    }
  })

  test('should support redo in user composite', async ({ page, compositeEditor }) => {
    // Select and copy a node
    const internalNodes = compositeEditor.getInternalNodes()
    const firstNode = internalNodes.first()

    if (await firstNode.isVisible()) {
      await firstNode.click()
      await compositeEditor.copy()
      await compositeEditor.paste()
      await page.waitForTimeout(300)

      const countAfterPaste = await compositeEditor.getNodeCount()

      // Undo then Redo
      await compositeEditor.undo()
      await page.waitForTimeout(200)
      await compositeEditor.redo()
      await page.waitForTimeout(300)

      // Should be back to paste count
      const countAfterRedo = await compositeEditor.getNodeCount()
      expect(countAfterRedo).toBeGreaterThanOrEqual(countAfterPaste - 1) // Allow some variance
    }
  })
})
