const MAX_BODY_MESSAGE_LENGTH = 200

/**
 * Turns a non-2xx HTTP response into a short PT-BR reason to show the user,
 * following RFC 9110's status classes: 401/403/429 get a status-specific
 * hint (the fix is the same regardless of what the body says); other 4xx and
 * 5xx prefer the provider's own error body, falling back to a class-level
 * message that still names the status code. Provider-agnostic — covers both
 * Ollama's `{"error": "..."}` and GLM/OpenAI's `{"error": {"message": "..."}}`
 * shapes.
 *
 * @param status - HTTP status, or `null` for an in-stream error with no status.
 * @param body - Raw response body, read once by the caller before this runs.
 * @returns A message short enough for a status card, never the raw body.
 */
export function describeUpstreamError(status: number | null, body: string): string {
  if (status === 401) return 'Chave de acesso ausente ou inválida (HTTP 401 Unauthorized).'
  if (status === 403) {
    return 'Chave de acesso sem permissão para este recurso (HTTP 403 Forbidden).'
  }
  if (status === 429) {
    return 'Limite de uso do serviço atingido (HTTP 429 Too Many Requests) — tente novamente em instantes.'
  }

  const fromBody = messageFromBody(body)
  if (fromBody !== null) return status === null ? fromBody : `${fromBody} (HTTP ${status}).`

  if (status === null) return 'Falha ao se comunicar com o serviço.'
  if (status >= 500) return `O serviço reportou um erro interno (HTTP ${status}).`
  if (status >= 400) return `A requisição foi rejeitada pelo serviço (HTTP ${status}).`
  return `Falha ao se comunicar com o serviço (HTTP ${status}).`
}

function messageFromBody(body: string): string | null {
  if (body.trim() === '') return null
  try {
    const parsed = JSON.parse(body) as { error?: string | { message?: string } }
    const message = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message
    return typeof message === 'string' && message.trim() !== '' ? truncate(message) : null
  } catch {
    return null
  }
}

function truncate(text: string): string {
  return text.length > MAX_BODY_MESSAGE_LENGTH ? `${text.slice(0, MAX_BODY_MESSAGE_LENGTH)}…` : text
}
