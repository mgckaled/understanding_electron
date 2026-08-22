import { argsSchema } from './ipc'

describe('argsSchema', () => {
  // ai:chat carries Message[] (D17.5), the app's own shape — not the
  // provider's flat ChatMessage[]. Main materializes one into the other.
  const chatMessages = [
    { id: 'm1', role: 'user', parts: [{ kind: 'text', text: 'oi' }], createdAt: 1 }
  ]

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
      messages: chatMessages,
      jobId: 'j1'
    })
    expect(result.success).toBe(true)
  })

  it('rejects ai:chat with an empty model', () => {
    const result = argsSchema['ai:chat'].safeParse({
      service: 'ollama',
      model: '',
      messages: chatMessages,
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
      messages: chatMessages,
      numThread: 4,
      jobId: 'j1'
    })
    expect(result.success).toBe(true)
  })

  it('rejects ai:chat with a non-positive numThread', () => {
    const result = argsSchema['ai:chat'].safeParse({
      service: 'ollama',
      model: 'gemma3:4b',
      messages: chatMessages,
      numThread: 0,
      jobId: 'j1'
    })
    expect(result.success).toBe(false)
  })
})

describe('argsSchema — conversation:*', () => {
  const message = {
    id: 'm1',
    role: 'user',
    parts: [{ kind: 'text', text: 'oi' }],
    createdAt: 1_700_000_000_000
  }

  it('accepts an append carrying a message and an optional title', () => {
    const result = argsSchema['conversation:append'].safeParse({
      conversationId: 'c1',
      message: { ...message, model: 'gemma3:4b' },
      title: 'Vendas'
    })
    expect(result.success).toBe(true)
  })

  it('accepts an append with no title — the conversation keeps the one it has', () => {
    const result = argsSchema['conversation:append'].safeParse({ conversationId: 'c1', message })
    expect(result.success).toBe(true)
  })

  it('rejects a message part of an unknown kind', () => {
    // The 'dataset' (plano 16) and 'document'/'image' (plano 17) variants join
    // messagePartSchema when they exist. Until then the payload is closed, and
    // a part the storage cannot describe never reaches the disk.
    const result = argsSchema['conversation:append'].safeParse({
      conversationId: 'c1',
      message: { ...message, parts: [{ kind: 'image', url: 'x' }] }
    })
    expect(result.success).toBe(false)
  })

  it('rejects a message with no parts at all', () => {
    const result = argsSchema['conversation:append'].safeParse({
      conversationId: 'c1',
      message: { ...message, parts: [] }
    })
    expect(result.success).toBe(false)
  })

  it('rejects a create with a fractional timestamp', () => {
    // createdAt is milliseconds since the epoch and goes into an INTEGER
    // column; SQLite would store 1.5 as a float and the round trip would drift.
    const result = argsSchema['conversation:create'].safeParse({
      id: 'c1',
      title: 'Nova conversa',
      createdAt: 1.5
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty id, which no primary key should ever be', () => {
    expect(argsSchema['conversation:remove'].safeParse({ id: '' }).success).toBe(false)
  })

  it('accepts an empty rename — the renderer decides what an empty title means', () => {
    expect(argsSchema['conversation:rename'].safeParse({ id: 'c1', title: '' }).success).toBe(true)
  })
})

describe('argsSchema — secrets:*', () => {
  it('accepts a well-formed secrets:write payload', () => {
    const result = argsSchema['secrets:write'].safeParse({ provider: 'gemini', apiKey: 'sk-x' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty apiKey', () => {
    const result = argsSchema['secrets:write'].safeParse({ provider: 'gemini', apiKey: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a provider outside CLOUD_PROVIDERS', () => {
    const result = argsSchema['secrets:write'].safeParse({ provider: 'openai', apiKey: 'sk-x' })
    expect(result.success).toBe(false)
  })

  it('accepts secrets:has/secrets:remove with a known provider', () => {
    expect(argsSchema['secrets:has'].safeParse({ provider: 'glm' }).success).toBe(true)
    expect(argsSchema['secrets:remove'].safeParse({ provider: 'glm' }).success).toBe(true)
  })
})
