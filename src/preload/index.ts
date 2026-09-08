import { contextBridge } from 'electron'
import { api } from './api'

// The composition root of the bridge, and nothing else. Local imports are
// inlined by rollup — externalizeDepsPlugin never enters the preload block, so
// the built output stays the single file a sandboxed preload can load.

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}
