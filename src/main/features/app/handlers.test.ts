import { getAppInfo } from './handlers'

describe('getAppInfo', () => {
  it('returns the expected shape', () => {
    const getVersion = vi.fn().mockReturnValue('1.0.0')

    const info = getAppInfo(getVersion, true)

    expect(info).toEqual({
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      app: '1.0.0',
      platform: process.platform,
      isDev: true
    })
  })
})
