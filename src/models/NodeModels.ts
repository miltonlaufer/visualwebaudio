import { types } from 'mobx-state-tree'

export const NodeInput = types.model('NodeInput', {
  name: types.string,
  type: types.enumeration(['audio', 'control']),
})

export const NodeOutput = types.model('NodeOutput', {
  name: types.string,
  type: types.enumeration(['audio', 'control']),
})

export const NodeProperty = types.model('NodeProperty', {
  name: types.string,
  type: types.string,
  defaultValue: types.frozen(),
  min: types.maybe(types.number),
  max: types.maybe(types.number),
})

export const NodeMetadataModel = types.model('NodeMetadata', {
  name: types.string,
  description: types.string,
  category: types.enumeration([
    'source',
    'effect',
    'destination',
    'analysis',
    'processing',
    'context',
    'control',
    'logic',
    'input',
    'misc',
  ]),
  inputs: types.array(NodeInput),
  outputs: types.array(NodeOutput),
  properties: types.array(NodeProperty),
  methods: types.array(types.string),
  events: types.array(types.string),
})

export const VisualNodeData = types.model('VisualNodeData', {
  nodeType: types.string,
  metadata: NodeMetadataModel,
  properties: types.map(types.frozen()),
})

export const VisualNodeModel = types.model('VisualNode', {
  id: types.identifier,
  type: types.string,
  position: types.model({
    x: types.number,
    y: types.number,
  }),
  data: VisualNodeData,
})

export const VisualEdgeModel = types.model('VisualEdge', {
  id: types.identifier,
  source: types.string,
  target: types.string,
  sourceHandle: types.maybe(types.string),
  targetHandle: types.maybe(types.string),
})

export const AudioConnectionModel = types.model('AudioConnection', {
  sourceNodeId: types.string,
  targetNodeId: types.string,
  sourceOutput: types.string,
  targetInput: types.string,
})
