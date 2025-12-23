import { Page, Locator } from '@playwright/test'

/**
 * Page object for the main GraphCanvas component.
 * Provides methods to interact with the audio node graph.
 */
export class GraphCanvasPage {
  readonly page: Page
  readonly container: Locator
  readonly nodes: Locator
  readonly edges: Locator
  readonly controls: Locator
  readonly miniMap: Locator

  constructor(page: Page) {
    this.page = page
    this.container = page.locator('.react-flow')
    this.nodes = page.locator('.react-flow__node')
    this.edges = page.locator('.react-flow__edge')
    this.controls = page.locator('.react-flow__controls')
    this.miniMap = page.locator('.react-flow__minimap')
  }

  /**
   * Wait for the canvas to be ready
   */
  async waitForCanvas() {
    await this.container.waitFor({ state: 'visible' })
  }

  /**
   * Get the count of nodes on the canvas
   */
  async getNodeCount(): Promise<number> {
    return await this.nodes.count()
  }

  /**
   * Get the count of edges on the canvas
   */
  async getEdgeCount(): Promise<number> {
    return await this.edges.count()
  }

  /**
   * Get a node by its ID
   */
  getNodeById(nodeId: string): Locator {
    return this.page.locator(`[data-id="${nodeId}"]`)
  }

  /**
   * Get nodes by type
   */
  getNodesByType(nodeType: string): Locator {
    return this.page.locator(`.react-flow__node[data-type="${nodeType}"]`)
  }

  /**
   * Click on a node to select it
   */
  async selectNode(nodeId: string) {
    const node = this.getNodeById(nodeId)
    await node.click()
  }

  /**
   * Double-click on a node (opens composite editor for composite nodes)
   */
  async doubleClickNode(nodeId: string) {
    const node = this.getNodeById(nodeId)
    await node.dblclick()
  }

  /**
   * Delete selected nodes using keyboard
   */
  async deleteSelectedNodes() {
    await this.page.keyboard.press('Delete')
  }

  /**
   * Copy selected nodes
   */
  async copySelectedNodes() {
    await this.page.keyboard.press('Control+c')
  }

  /**
   * Cut selected nodes
   */
  async cutSelectedNodes() {
    await this.page.keyboard.press('Control+x')
  }

  /**
   * Paste nodes
   */
  async pasteNodes() {
    await this.page.keyboard.press('Control+v')
  }

  /**
   * Undo last action
   */
  async undo() {
    await this.page.keyboard.press('Control+z')
  }

  /**
   * Redo last undone action
   */
  async redo() {
    await this.page.keyboard.press('Control+Shift+z')
  }

  /**
   * Select multiple nodes by holding shift
   */
  async selectMultipleNodes(nodeIds: string[]) {
    for (let i = 0; i < nodeIds.length; i++) {
      const node = this.getNodeById(nodeIds[i])
      if (i === 0) {
        await node.click()
      } else {
        await node.click({ modifiers: ['Shift'] })
      }
    }
  }

  /**
   * Click on the canvas background to deselect all
   */
  async clickBackground() {
    await this.container.click({ position: { x: 10, y: 10 } })
  }

  /**
   * Get the selection indicator text
   */
  async getSelectionIndicator(): Promise<string | null> {
    const indicator = this.page.locator('.absolute.bottom-4.left-4')
    if (await indicator.isVisible()) {
      return await indicator.textContent()
    }
    return null
  }

  /**
   * Wait for a specific number of nodes
   */
  async waitForNodeCount(count: number, timeout = 5000) {
    await this.page.waitForFunction(
      expectedCount => {
        return document.querySelectorAll('.react-flow__node').length === expectedCount
      },
      count,
      { timeout }
    )
  }

  /**
   * Drag a node to a new position
   */
  async dragNode(nodeId: string, deltaX: number, deltaY: number) {
    const node = this.getNodeById(nodeId)
    const box = await node.boundingBox()
    if (!box) throw new Error(`Node ${nodeId} not found`)

    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await this.page.mouse.down()
    await this.page.mouse.move(box.x + box.width / 2 + deltaX, box.y + box.height / 2 + deltaY)
    await this.page.mouse.up()
  }

  /**
   * Connect two nodes by dragging from source handle to target handle
   */
  async connectNodes(
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandle = 'output',
    targetHandle = 'input'
  ) {
    const sourceNode = this.getNodeById(sourceNodeId)
    const targetNode = this.getNodeById(targetNodeId)

    const sourceHandleLocator = sourceNode.locator(`[data-handleid="${sourceHandle}"]`)
    const targetHandleLocator = targetNode.locator(`[data-handleid="${targetHandle}"]`)

    await sourceHandleLocator.dragTo(targetHandleLocator)
  }

  /**
   * Get the auto-layout button
   */
  getAutoLayoutButton(): Locator {
    return this.page.locator('[data-testid="auto-layout-button"]')
  }

  /**
   * Click auto-layout button
   */
  async clickAutoLayout() {
    const button = this.getAutoLayoutButton()
    await button.click()
  }

  /**
   * Double-click the first node on the canvas
   */
  async doubleClickFirstNode() {
    const firstNode = this.nodes.first()
    await firstNode.waitFor({ state: 'visible' })
    await firstNode.dblclick()
  }

  /**
   * Get all node IDs currently on the canvas
   */
  async getNodeIds(): Promise<string[]> {
    const nodes = await this.nodes.all()
    const ids: string[] = []
    for (const node of nodes) {
      const id = await node.getAttribute('data-id')
      if (id) ids.push(id)
    }
    return ids
  }

  /**
   * Check if canvas has any nodes
   */
  async hasNodes(): Promise<boolean> {
    const count = await this.getNodeCount()
    return count > 0
  }
}
