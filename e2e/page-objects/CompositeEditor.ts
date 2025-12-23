import { Page, Locator } from '@playwright/test'

/**
 * Page object for the CompositeEditorPanel component.
 * Provides methods to interact with the composite node editor.
 */
export class CompositeEditorPage {
  readonly page: Page
  readonly panel: Locator
  readonly nameInput: Locator
  readonly descriptionTextarea: Locator
  readonly saveButton: Locator
  readonly saveAsButton: Locator
  readonly deleteButton: Locator
  readonly closeButton: Locator
  readonly exportButton: Locator
  readonly importButton: Locator
  readonly canvas: Locator
  readonly nodes: Locator
  readonly edges: Locator

  constructor(page: Page) {
    this.page = page
    this.panel = page.locator('[data-testid="composite-editor-panel"]')
    this.nameInput = page.locator('[data-testid="composite-name-input"]')
    this.descriptionTextarea = page.locator('[data-testid="composite-description"]')
    this.saveButton = page.locator('[data-testid="composite-save-button"]')
    this.saveAsButton = page.locator('[data-testid="composite-save-as-button"]')
    this.deleteButton = page.locator('[data-testid="composite-delete-button"]')
    this.closeButton = page.locator('[data-testid="composite-close-button"]')
    this.exportButton = page.locator('[data-testid="composite-export-button"]')
    this.importButton = page.locator('[data-testid="composite-import-button"]')
    this.canvas = page.locator('[data-testid="composite-editor-canvas"] .react-flow')
    this.nodes = this.canvas.locator('.react-flow__node')
    this.edges = this.canvas.locator('.react-flow__edge')
  }

  /**
   * Check if the editor panel is visible
   */
  async isOpen(): Promise<boolean> {
    return await this.panel.isVisible()
  }

  /**
   * Wait for the editor to be visible
   */
  async waitForEditor() {
    await this.panel.waitFor({ state: 'visible' })
  }

  /**
   * Wait for the editor to be hidden
   */
  async waitForEditorClosed() {
    await this.panel.waitFor({ state: 'hidden' })
  }

  /**
   * Close the editor using the close button
   */
  async close() {
    await this.closeButton.click()
    await this.waitForEditorClosed()
  }

  /**
   * Close the editor using Escape key
   */
  async closeWithEscape() {
    await this.page.keyboard.press('Escape')
    await this.waitForEditorClosed()
  }

  /**
   * Get the current name
   */
  async getName(): Promise<string> {
    return await this.nameInput.inputValue()
  }

  /**
   * Set the composite name
   */
  async setName(name: string) {
    await this.nameInput.clear()
    await this.nameInput.fill(name)
  }

  /**
   * Get the current description
   */
  async getDescription(): Promise<string> {
    return await this.descriptionTextarea.inputValue()
  }

  /**
   * Set the description
   */
  async setDescription(description: string) {
    await this.descriptionTextarea.clear()
    await this.descriptionTextarea.fill(description)
  }

  /**
   * Save the composite node
   */
  async save() {
    await this.saveButton.click()
  }

  /**
   * Open Save As dialog and save with new name
   */
  async saveAs(newName: string) {
    await this.saveAsButton.click()

    // Wait for dialog
    const dialog = this.page.locator('[data-testid="save-as-dialog"]')
    await dialog.waitFor({ state: 'visible' })

    // Fill name and save
    const nameInput = dialog.locator('input')
    await nameInput.clear()
    await nameInput.fill(newName)

    const confirmButton = dialog.locator('button:has-text("Save")')
    await confirmButton.click()
  }

  /**
   * Delete the composite node
   */
  async delete() {
    await this.deleteButton.click()

    // Handle confirmation dialog
    this.page.on('dialog', dialog => dialog.accept())
  }

  /**
   * Get node count in editor
   */
  async getNodeCount(): Promise<number> {
    return await this.nodes.count()
  }

  /**
   * Get edge count in editor
   */
  async getEdgeCount(): Promise<number> {
    return await this.edges.count()
  }

  /**
   * Get input connectors
   */
  getInputConnectors(): Locator {
    return this.canvas.locator('[data-testid^="edge-connector-input"]')
  }

  /**
   * Get output connectors
   */
  getOutputConnectors(): Locator {
    return this.canvas.locator('[data-testid^="edge-connector-output"]')
  }

  /**
   * Get internal nodes (not edge connectors)
   */
  getInternalNodes(): Locator {
    return this.canvas.locator('.react-flow__node[data-type="internalNode"]')
  }

  /**
   * Add input port
   */
  async addInputPort(name: string, type: 'audio' | 'control' = 'audio') {
    const addInputButton = this.page.locator('[data-testid="add-input-button"]')
    await addInputButton.click()

    // Fill dialog
    const dialog = this.page.locator('[data-testid="add-port-dialog"]')
    await dialog.waitFor({ state: 'visible' })

    await dialog.locator('input[placeholder*="name"]').fill(name)
    await dialog.locator('select').selectOption(type)
    await dialog.locator('button:has-text("Add")').click()
  }

  /**
   * Add output port
   */
  async addOutputPort(name: string, type: 'audio' | 'control' = 'audio') {
    const addOutputButton = this.page.locator('[data-testid="add-output-button"]')
    await addOutputButton.click()

    // Fill dialog
    const dialog = this.page.locator('[data-testid="add-port-dialog"]')
    await dialog.waitFor({ state: 'visible' })

    await dialog.locator('input[placeholder*="name"]').fill(name)
    await dialog.locator('select').selectOption(type)
    await dialog.locator('button:has-text("Add")').click()
  }

  /**
   * Delete selected elements using keyboard
   */
  async deleteSelected() {
    await this.page.keyboard.press('Delete')
  }

  /**
   * Copy selected elements
   */
  async copy() {
    await this.page.keyboard.press('Control+c')
  }

  /**
   * Paste elements
   */
  async paste() {
    await this.page.keyboard.press('Control+v')
  }

  /**
   * Undo in editor
   */
  async undo() {
    await this.page.keyboard.press('Control+z')
  }

  /**
   * Redo in editor
   */
  async redo() {
    await this.page.keyboard.press('Control+Shift+z')
  }

  /**
   * Check if editor is in read-only mode
   */
  async isReadOnly(): Promise<boolean> {
    const readOnlyBadge = this.page.locator('text=Prebuilt (Read-only)')
    return await readOnlyBadge.isVisible()
  }

  /**
   * Get error message if displayed
   */
  async getErrorMessage(): Promise<string | null> {
    const errorBanner = this.page.locator('.bg-red-100 p')
    if (await errorBanner.isVisible()) {
      return await errorBanner.textContent()
    }
    return null
  }

  /**
   * Get success message if displayed
   */
  async getSuccessMessage(): Promise<string | null> {
    const successBanner = this.page.locator('.bg-green-100 p')
    if (await successBanner.isVisible()) {
      return await successBanner.textContent()
    }
    return null
  }
}
