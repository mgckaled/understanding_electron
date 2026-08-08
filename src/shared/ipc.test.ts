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

  it('accepts a well-formed ai:chat payload', () => {
    const result = argsSchema['ai:chat'].safeParse({
      service: 'ollama',
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'oi' }],
      jobId: 'j1'
    })
    expect(result.success).toBe(true)
  })

  it('rejects ai:chat with an empty model', () => {
    const result = argsSchema['ai:chat'].safeParse({
      service: 'ollama',
      model: '',
      messages: [{ role: 'user', content: 'oi' }],
      jobId: 'j1'
    })
    expect(result.success).toBe(false)
  })

  it('rejects ai:chat with no messages', () => {
    const result = argsSchema['ai:chat'].safeParse({
      service: 'ollama',
      model: 'llama3.2',
      messages: [],
      jobId: 'j1'
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown service for ai:isAvailable', () => {
    const result = argsSchema['ai:isAvailable'].safeParse({ service: 'gemini' })
    expect(result.success).toBe(false)
  })

  it('accepts ai:chat with an optional numThread', () => {
    const result = argsSchema['ai:chat'].safeParse({
      service: 'ollama',
      model: 'gemma3:4b',
      messages: [{ role: 'user', content: 'oi' }],
      numThread: 4,
      jobId: 'j1'
    })
    expect(result.success).toBe(true)
  })

  it('rejects ai:chat with a non-positive numThread', () => {
    const result = argsSchema['ai:chat'].safeParse({
      service: 'ollama',
      model: 'gemma3:4b',
      messages: [{ role: 'user', content: 'oi' }],
      numThread: 0,
      jobId: 'j1'
    })
    expect(result.success).toBe(false)
  })
})
