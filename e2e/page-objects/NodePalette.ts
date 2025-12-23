import { Page, Locator } from '@playwright/test'

/**
 * Page object for the NodePalette component.
 * Provides methods to interact with the node palette sidebar.
 */
export class NodePalettePage {
  readonly page: Page
  readonly container: Locator
  readonly searchInput: Locator
  readonly categoryHeaders: Locator

  constructor(page: Page) {
    this.page = page
    this.container = page.locator('[data-testid="node-palette"]')
    this.searchInput = page.locator('[data-testid="node-search-input"]')
    this.categoryHeaders = page.locator('[data-testid="category-header"]')
  }

  /**
   * Wait for the palette to be visible
   */
  async waitForPalette() {
    await this.container.waitFor({ state: 'visible' })
  }

  /**
   * Search for a node type
   */
  async searchNodes(query: string) {
    await this.searchInput.fill(query)
  }

  /**
   * Clear the search input
   */
  async clearSearch() {
    await this.searchInput.clear()
  }

  /**
   * Get a node item by its name
   */
  getNodeItem(nodeName: string): Locator {
    return this.page.locator(`[data-testid="node-item-${nodeName}"]`)
  }

  /**
   * Drag a node from palette to canvas
   */
  async dragNodeToCanvas(nodeName: string, targetX: number, targetY: number) {
    const nodeItem = this.getNodeItem(nodeName)
    const canvas = this.page.locator('.react-flow')

    await nodeItem.dragTo(canvas, {
      targetPosition: { x: targetX, y: targetY },
    })
  }

  /**
   * Click on a node item to add it to canvas
   */
  async clickNodeItem(nodeName: string) {
    const nodeItem = this.getNodeItem(nodeName)
    await nodeItem.click()
  }

  /**
   * Expand a category section by name
   */
  async expandCategory(categoryName: string) {
    const categoryHeader = this.page.locator(`[data-testid="category-${categoryName}"]`)
    await categoryHeader.click()
  }

  /**
   * Scroll to and expand the Composite Nodes category
   */
  async navigateToCompositeNodes() {
    // Scroll to bottom of palette to find composite nodes
    await this.page.evaluate(() => {
      const scrollContainer = document.querySelector('[data-testid="node-palette"]')?.parentElement
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    })

    // Wait a bit for scroll to complete
    await this.page.waitForTimeout(200)

    // Find and click the composite nodes category
    const compositeCategory = this.page.locator('text=Composite Nodes').first()
    if (await compositeCategory.isVisible({ timeout: 2000 })) {
      await compositeCategory.click()
      await this.page.waitForTimeout(300) // Wait for expansion animation
    }
  }

  /**
   * Add a composite node to the graph
   */
  async addCompositeNodeToGraph(compositeId: string) {
    await this.navigateToCompositeNodes()

    const nodeItem = this.getNodeItem(`Composite_${compositeId}`)
    await nodeItem.waitFor({ state: 'visible', timeout: 5000 })
    await nodeItem.click()
    await this.page.waitForTimeout(500) // Wait for node to be added
  }

  /**
   * Check if composite nodes section is available
   */
  async hasCompositeNodesSection(): Promise<boolean> {
    await this.page.evaluate(() => {
      const scrollContainer = document.querySelector('[data-testid="node-palette"]')?.parentElement
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    })
    await this.page.waitForTimeout(200)

    const compositeSection = this.page.locator('text=Composite Nodes').first()
    return await compositeSection.isVisible({ timeout: 2000 }).catch(() => false)
  }

  /**
   * Get composite node items
   */
  getCompositeNodes(): Locator {
    return this.page.locator('[data-testid^="node-item-Composite_"]')
  }

  /**
   * Get user composite node items
   */
  getUserCompositeNodes(): Locator {
    return this.page.locator('[data-testid^="node-item-UserComposite_"]')
  }
}
