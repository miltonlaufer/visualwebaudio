/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect } from '@playwright/test'
import { NodePalettePage } from '../page-objects/NodePalette'
import { GraphCanvasPage } from '../page-objects/GraphCanvas'
import { CompositeEditorPage } from '../page-objects/CompositeEditor'

/**
 * Extended test fixture with page objects for the visual web audio app.
 *
 * Note: ESLint's react-hooks/rules-of-hooks is disabled because Playwright's
 * fixture pattern uses `use()` which triggers false positives.
 */
type AppFixtures = {
  nodePalette: NodePalettePage
  graphCanvas: GraphCanvasPage
  compositeEditor: CompositeEditorPage
}

export const test = base.extend<AppFixtures>({
  nodePalette: async ({ page }, use) => {
    const nodePalette = new NodePalettePage(page)
    await use(nodePalette)
  },

  graphCanvas: async ({ page }, use) => {
    const graphCanvas = new GraphCanvasPage(page)
    await use(graphCanvas)
  },

  compositeEditor: async ({ page }, use) => {
    const compositeEditor = new CompositeEditorPage(page)
    await use(compositeEditor)
  },
})

export { expect }
