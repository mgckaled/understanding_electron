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
  unknown: FALLBACK_MESSAGE
}

export function errorMessage(error: AppError): string {
  return MESSAGES[error.kind] ?? FALLBACK_MESSAGE
}
