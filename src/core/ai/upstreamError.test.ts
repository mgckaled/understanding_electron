import { describeUpstreamError } from './upstreamError'

describe('describeUpstreamError', () => {
  it('classifies 401 as a missing/invalid key, ignoring the body', () => {
    expect(describeUpstreamError(401, '{"error":"whatever"}')).toBe(
      'Chave de acesso ausente ou inválida (HTTP 401 Unauthorized).'
    )
  })

  it('classifies 403 as a forbidden key, ignoring the body', () => {
    expect(describeUpstreamError(403, '')).toBe(
      'Chave de acesso sem permissão para este recurso (HTTP 403 Forbidden).'
    )
  })

  it('classifies 429 as a rate-limit hint, ignoring the body', () => {
    expect(describeUpstreamError(429, '')).toBe(
      'Limite de uso do serviço atingido (HTTP 429 Too Many Requests) — tente novamente em instantes.'
    )
  })

  it('extracts a flat error string and appends the status — Ollama shape', () => {
    const body = JSON.stringify({ error: "model 'foo' not found, try pulling it first" })

    expect(describeUpstreamError(500, body)).toBe(
      "model 'foo' not found, try pulling it first (HTTP 500)."
    )
  })

  it('extracts error.message and appends the status — GLM/OpenAI shape', () => {
    const body = JSON.stringify({ error: { message: 'invalid model', code: 'bad_request' } })

    expect(describeUpstreamError(400, body)).toBe('invalid model (HTTP 400).')
  })

  it('omits the status suffix when there is no status to report', () => {
    const body = JSON.stringify({ error: 'model runner crashed' })

    expect(describeUpstreamError(null, body)).toBe('model runner crashed')
  })

  it('truncates a very long body message before appending the status', () => {
    const long = 'x'.repeat(500)
    const body = JSON.stringify({ error: long })

    const result = describeUpstreamError(500, body)

    expect(result.startsWith(`${'x'.repeat(200)}…`)).toBe(true)
    expect(result.endsWith('(HTTP 500).')).toBe(true)
  })

  it('falls back to a 5xx class message for an unparseable or empty server-error body', () => {
    expect(describeUpstreamError(502, 'not json')).toBe(
      'O serviço reportou um erro interno (HTTP 502).'
    )
    expect(describeUpstreamError(500, '')).toBe('O serviço reportou um erro interno (HTTP 500).')
  })

  it('falls back to a 4xx class message for an unparseable or empty client-error body', () => {
    expect(describeUpstreamError(404, '')).toBe(
      'A requisição foi rejeitada pelo serviço (HTTP 404).'
    )
  })

  it('falls back to a status-less message when status is null and the body has no error', () => {
    expect(describeUpstreamError(null, '')).toBe('Falha ao se comunicar com o serviço.')
  })
})
