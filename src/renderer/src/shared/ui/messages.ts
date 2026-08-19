import type { AppError } from '@shared/ipc'

type ErrorKind = AppError['kind']

const FALLBACK_MESSAGE = 'Ocorreu um erro inesperado.'

// Record<ErrorKind, string> forces every kind added to the union to get a
// message here, checked by pnpm typecheck. The fallback in errorMessage()
// below is the runtime twin of that guarantee: it protects against a kind
// this build genuinely does not know about (main newer than renderer).
const MESSAGES: Record<ErrorKind, string> = {
  'not-found': 'Arquivo não encontrado.',
  permission: 'Sem permissão para acessar este arquivo.',
  blocked: 'Operação bloqueada.',
  cancelled: 'Operação cancelada.',
  timeout: 'A operação demorou demais e foi interrompida.',
  unavailable: 'Serviço indisponível no momento.',
  upstream: 'Falha ao se comunicar com um serviço externo.',
  invalidQuery: 'Consulta inválida.',
  unknown: FALLBACK_MESSAGE
}

// blocked and invalidQuery carry their own text (D17.8; D18B.6 — the
// engine's own error, useful on its own in a diagnostic tool) — the generic
// MESSAGES entry stays as the label for a bare AppError['kind'], but a real
// error of either kind is strictly more informative than that fallback.
export function errorMessage(error: AppError): string {
  if (error.kind === 'blocked') return error.reason
  if (error.kind === 'invalidQuery') return error.message
  return MESSAGES[error.kind] ?? FALLBACK_MESSAGE
}
