import { resolve } from 'node:path'

export const aliases = {
  '@shared': resolve('src/shared'),
  '@core': resolve('src/core'),
  '@renderer': resolve('src/renderer/src')
}
