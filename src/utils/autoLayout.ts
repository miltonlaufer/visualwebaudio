import dagre from '@dagrejs/dagre'

interface LayoutNode {
  id: string
  width: number
  height: number
}

interface LayoutEdge {
  source: string
  target: string
}

interface LayoutResult {
  id: string
  x: number
  y: number
}

/**
 * Auto-layout nodes using dagre (directed acyclic graph layout).
 * Arranges nodes left-to-right following audio signal flow.
 */
export function autoLayoutNodes(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: {
    direction?: 'LR' | 'TB' | 'RL' | 'BT'
    nodeSpacingX?: number
    nodeSpacingY?: number
  } = {}
): LayoutResult[] {
  const {
    direction = 'LR', // Left to right (audio flows source -> destination)
    nodeSpacingX = 80,
    nodeSpacingY = 50,
  } = options

  // Create a new directed graph
  const g = new dagre.graphlib.Graph()

  // Set graph options
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSpacingY,
    ranksep: nodeSpacingX,
    marginx: 50,
    marginy: 50,
  })

  // Required for dagre
  g.setDefaultEdgeLabel(() => ({}))

  // Add nodes
  for (const node of nodes) {
    g.setNode(node.id, {
      width: node.width || 280,
      height: node.height || 200,
    })
  }

  // Add edges
  for (const edge of edges) {
    // Only add edge if both nodes exist
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  // Run the layout algorithm
  dagre.layout(g)

  // Extract positions
  const results: LayoutResult[] = []
  for (const node of nodes) {
    const nodeWithPosition = g.node(node.id)
    if (nodeWithPosition) {
      // dagre returns center positions, convert to top-left
      results.push({
        id: node.id,
        x: nodeWithPosition.x - (node.width || 280) / 2,
        y: nodeWithPosition.y - (node.height || 200) / 2,
      })
    }
  }

  return results
}

/**
 * Direction options for the layout
 */
export type LayoutDirection = 'LR' | 'TB' | 'RL' | 'BT'

export const LAYOUT_DIRECTIONS: { value: LayoutDirection; label: string }[] = [
  { value: 'LR', label: 'Left → Right' },
  { value: 'TB', label: 'Top → Bottom' },
  { value: 'RL', label: 'Right → Left' },
  { value: 'BT', label: 'Bottom → Top' },
]
