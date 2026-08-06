import { APP_ID } from './meta'

describe('APP_ID', () => {
  it('identifies the app for the OS shell (AppUserModelId, taskbar)', () => {
    expect(APP_ID).toBe('data-lab')
  })
})
