import type { Result } from '@shared/ipc'
import { checkExternalUrl } from '@core/url'

export async function openExternal(
  { url }: { url: string },
  openExternalFn: (url: string) => Promise<void>
): Promise<Result<void>> {
  const checked = checkExternalUrl(url)
  if (!checked.ok) return checked

  await openExternalFn(checked.value)
  return { ok: true, value: undefined }
}
