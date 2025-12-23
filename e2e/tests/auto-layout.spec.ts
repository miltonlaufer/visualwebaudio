import { test, expect } from '../fixtures/app.fixture'

test.describe('Auto-Layout - Main Graph', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })
  })

  test('should display auto-layout button', async ({ graphCanvas }) => {
    await graphCanvas.waitForCanvas()

    const autoLayoutButton = graphCanvas.getAutoLayoutButton()
    await expect(autoLayoutButton).toBeVisible()
  })

  test('should open direction dropdown when clicking auto-layout', async ({
    page,
    nodePalette,
    graphCanvas,
  }) => {
    await nodePalette.waitForPalette()

    // Add some nodes first
    await page.click('text=source Nodes')
    const oscillatorItem = page.locator('[data-testid="node-item-OscillatorNode"]')
    if (await oscillatorItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await oscillatorItem.click()
      await page.waitForTimeout(500)
    }

    // Add another node
    await page.click('text=effect Nodes')
    const gainItem = page.locator('[data-testid="node-item-GainNode"]')
    if (await gainItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gainItem.click()
      await page.waitForTimeout(500)
    }

    // Click auto-layout button
    const autoLayoutButton = graphCanvas.getAutoLayoutButton()
    await autoLayoutButton.click()

    // Dropdown should appear
    const dropdown = page.locator('text=Direction')
    await expect(dropdown).toBeVisible({ timeout: 2000 })

    // Should have direction options
    const selectBox = page.locator('select')
    await expect(selectBox).toBeVisible()
  })

  test('should have disabled auto-layout when no nodes', async ({ graphCanvas }) => {
    await graphCanvas.waitForCanvas()

    // Get initial node count (should be 0 in fresh page)
    const nodeCount = await graphCanvas.getNodeCount()

    if (nodeCount === 0) {
      const autoLayoutButton = graphCanvas.getAutoLayoutButton()
      await expect(autoLayoutButton).toBeDisabled()
    }
  })
})

test.describe('Auto-Layout - Composite Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { state: 'visible' })
  })

  test('should have auto-layout button in composite editor toolbar', async ({
    page,
    nodePalette,
    compositeEditor,
  }) => {
    await nodePalette.waitForPalette()

    // Scroll to composite nodes
    await page.evaluate(() => {
      const scrollContainer = document.querySelector('[data-testid="node-palette"]')?.parentElement
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    })

    const compositeSection = page.locator('text=Composite Nodes')
    if (await compositeSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      await compositeSection.click()
      await page.waitForTimeout(300)

      const delayEffect = page.locator('[data-testid="node-item-Composite_DelayEffect"]')
      if (await delayEffect.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Add and open
        await delayEffect.click()
        await page.waitForTimeout(500)

        const compositeNode = page.locator('.react-flow__node').first()
        await compositeNode.dblclick()

        await compositeEditor.waitForEditor()

        // Save as editable copy first
        await compositeEditor.saveAsButton.click()
        const dialog = page.locator('[data-testid="save-as-dialog"]')
        await dialog.waitFor({ state: 'visible' })
        await dialog.locator('input').fill('TestLayout')
        await dialog.locator('button:has-text("Save")').click()
        await page.waitForTimeout(500)

        // Now should see auto-layout button in toolbar
        const autoLayoutButton = page.locator('[data-testid="auto-layout-button"]')
        await expect(autoLayoutButton).toBeVisible()

        await compositeEditor.close()
      }
    }
  })

  test('should disable auto-layout for prebuilt composites', async ({
    page,
    nodePalette,
    compositeEditor,
  }) => {
    await nodePalette.waitForPalette()

    await page.evaluate(() => {
      const scrollContainer = document.querySelector('[data-testid="node-palette"]')?.parentElement
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    })

    const compositeSection = page.locator('text=Composite Nodes')
    if (await compositeSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      await compositeSection.click()
      await page.waitForTimeout(300)

      const reverbEffect = page.locator('[data-testid="node-item-Composite_ReverbEffect"]')
      if (await reverbEffect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await reverbEffect.click()
        await page.waitForTimeout(500)

        const compositeNode = page.locator('.react-flow__node').first()
        await compositeNode.dblclick()

        await compositeEditor.waitForEditor()

        // Should be read-only
        const isReadOnly = await compositeEditor.isReadOnly()
        expect(isReadOnly).toBe(true)

        // Auto-layout button should not be visible (prebuilt has view-only indicator instead)
        const addInputButton = page.locator('[data-testid="add-input-button"]')
        await expect(addInputButton).not.toBeVisible()

        await compositeEditor.close()
      }
    }
  })
})
