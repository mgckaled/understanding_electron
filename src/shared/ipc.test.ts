import { argsSchema } from './ipc'

describe('argsSchema', () => {
  it('accepts void args for app:info', () => {
    expect(argsSchema['app:info'].safeParse(undefined).success).toBe(true)
  })

  it('accepts a valid https URL for shell:openExternal', () => {
    const result = argsSchema['shell:openExternal'].safeParse({ url: 'https://electronjs.org' })
    expect(result.success).toBe(true)
  })

  it('rejects a non-URL string for shell:openExternal', () => {
    const result = argsSchema['shell:openExternal'].safeParse({ url: 'not-a-url' })
    expect(result.success).toBe(false)
  })
})
