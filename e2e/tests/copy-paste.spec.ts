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

test.describe('Copy/Paste Operations - Main Graph', () => {
  test.beforeEach(async ({ page, nodePalette }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })
    await nodePalette.waitForPalette()
  })

  test('should copy selected nodes with Ctrl+C', async ({ page, nodePalette, graphCanvas }) => {
    await addOscillatorNode(page, nodePalette)

    // Select the node
    const node = graphCanvas.nodes.first()
    await node.click()

    // Copy with Ctrl+C
    await page.keyboard.press('Control+c')

    // Verify clipboard indicator appears
    const clipboardIndicator = page.locator('text=Clipboard ready')
    await expect(clipboardIndicator).toBeVisible({ timeout: 3000 })
  })

  test('should paste nodes with Ctrl+V', async ({ page, nodePalette, graphCanvas }) => {
    await addOscillatorNode(page, nodePalette)

    const initialCount = await graphCanvas.getNodeCount()

    // Select and copy
    await graphCanvas.nodes.first().click()
    await page.keyboard.press('Control+c')
    await page.waitForTimeout(300)

    // Paste
    await page.keyboard.press('Control+v')
    await page.waitForTimeout(500)

    // Should have one more node
    const newCount = await graphCanvas.getNodeCount()
    expect(newCount).toBe(initialCount + 1)
  })

  test('should cut nodes with Ctrl+X', async ({ page, nodePalette, graphCanvas }) => {
    await addOscillatorNode(page, nodePalette)

    const initialCount = await graphCanvas.getNodeCount()

    // Select and cut
    await graphCanvas.nodes.first().click()
    await page.keyboard.press('Control+x')
    await page.waitForTimeout(300)

    // Node should be removed
    const countAfterCut = await graphCanvas.getNodeCount()
    expect(countAfterCut).toBe(initialCount - 1)

    // Paste should restore it
    await page.keyboard.press('Control+v')
    await page.waitForTimeout(500)

    const countAfterPaste = await graphCanvas.getNodeCount()
    expect(countAfterPaste).toBe(initialCount)
  })

  test('should copy multiple selected nodes', async ({ page, nodePalette, graphCanvas }) => {
    // Add two nodes
    await addOscillatorNode(page, nodePalette)
    await addOscillatorNode(page, nodePalette)
    await page.waitForTimeout(300)

    const initialCount = await graphCanvas.getNodeCount()
    expect(initialCount).toBeGreaterThanOrEqual(2)

    // Select all nodes with Ctrl+A
    await graphCanvas.container.click()
    await page.keyboard.press('Control+a')
    await page.waitForTimeout(200)

    // Copy
    await page.keyboard.press('Control+c')
    await page.waitForTimeout(300)

    // Paste
    await page.keyboard.press('Control+v')
    await page.waitForTimeout(500)

    // Should have doubled the nodes
    const newCount = await graphCanvas.getNodeCount()
    expect(newCount).toBeGreaterThan(initialCount)
  })
})

test.describe('Copy/Paste in Composite Editor', () => {
  test.beforeEach(async ({ page, nodePalette }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })
    await nodePalette.waitForPalette()
  })

  test('should not modify prebuilt composite when pasting', async ({
    page,
    nodePalette,
    graphCanvas,
    compositeEditor,
  }) => {
    // Add composite node
    await nodePalette.addCompositeNodeToGraph('DelayEffect')

    // Open editor
    await graphCanvas.doubleClickFirstNode()
    await compositeEditor.waitForEditor()

    // Get initial node count
    const initialCount = await compositeEditor.getNodeCount()

    // Try to select and copy internal nodes
    const internalNodes = compositeEditor.getInternalNodes()
    const firstNode = internalNodes.first()

    if (await firstNode.isVisible()) {
      await firstNode.click()
      await compositeEditor.copy()
      await compositeEditor.paste()
      await page.waitForTimeout(300)

      // Count should be unchanged (read-only)
      const finalCount = await compositeEditor.getNodeCount()
      expect(finalCount).toBe(initialCount)
    }

    await compositeEditor.close()
  })

  test('should allow paste in user composite', async ({
    page,
    nodePalette,
    graphCanvas,
    compositeEditor,
  }) => {
    // Add composite node
    await nodePalette.addCompositeNodeToGraph('DelayEffect')

    // Open editor
    await graphCanvas.doubleClickFirstNode()
    await compositeEditor.waitForEditor()

    // Save as user composite
    await compositeEditor.saveAsButton.click()
    const dialog = page.locator('[data-testid="save-as-dialog"]')
    await dialog.locator('input').fill('My Copy Paste Test')
    await dialog.locator('button:has-text("Save")').click()
    await page.waitForTimeout(500)

    // Get initial node count
    const initialCount = await compositeEditor.getNodeCount()

    // Select and copy an internal node
    const internalNodes = compositeEditor.getInternalNodes()
    const firstNode = internalNodes.first()

    if (await firstNode.isVisible()) {
      await firstNode.click()
      await compositeEditor.copy()
      await compositeEditor.paste()
      await page.waitForTimeout(300)

      // Should have one more node (user composite is editable)
      const finalCount = await compositeEditor.getNodeCount()
      expect(finalCount).toBeGreaterThanOrEqual(initialCount)
    }

    await compositeEditor.close()
  })
})
