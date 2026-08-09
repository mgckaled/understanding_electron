import { APP_ID, APP_NAME } from './meta'

describe('APP_NAME', () => {
  it('is the human-readable product name', () => {
    expect(APP_NAME).toBe('crivo')
  })
})

describe('APP_ID', () => {
  // Not a tautology: this value has to match `appId` in electron-builder.yml,
  // and nothing else compares the two. A change here without a change there
  // desynchronises the shortcut from the running process on Windows.
  it('is the AppUserModelId, in reverse-domain form, matching electron-builder.yml', () => {
    expect(APP_ID).toBe('com.mgckaled.crivo')
  })
})
