import { extractText } from 'unpdf'
import type { Result } from '@shared/ipc'
import { ok, err } from '../result'

/**
 * Extracts a PDF's text layer (D17.3), merged into one string — matching the
 * verbatim inline text {@link decodeText} produces for `.txt`/`.md`. A
 * scanned PDF has no text layer to extract; refusing here, never attempting
 * OCR, is the line docs/ESCOPO.md draws — read, never guessed from pixels.
 */
export async function extractPdfText(buffer: Buffer): Promise<Result<string>> {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true })
  if (text.trim() === '') {
    return err({
      kind: 'blocked',
      reason:
        'Este PDF não tem texto selecionável — provavelmente é uma digitalização. Anexe uma versão com texto, ou converta com OCR antes.'
    })
  }
  return ok(text)
}
