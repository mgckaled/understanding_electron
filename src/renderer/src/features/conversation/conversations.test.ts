import type { AiModel } from '@shared/ipc'
import { DEFAULT_TITLE, resolveModel, stoppedFromError, titleFromText } from './conversations'

/*
 * The reducer tests that used to live here are gone with the reducer: the list
 * and the transcripts are a server cache now, and what the reducer used to
 * assert (ordering, electing another conversation when the active one is
 * removed, titling from the first user message) is asserted where it now
 * happens — the level-3 handler tests and the level-2 tests of the view.
 */

describe('titleFromText', () => {
  it('collapses whitespace and keeps a short message whole', () => {
    expect(titleFromText('  duas   linhas\ne mais  ')).toBe('duas linhas e mais')
  })

  it('truncates a long message with an ellipsis', () => {
    const title = titleFromText('a'.repeat(80))
    expect(title).toHaveLength(48)
    expect(title.endsWith('…')).toBe(true)
  })

  it('falls back to the default for an empty message', () => {
    expect(titleFromText('   ')).toBe(DEFAULT_TITLE)
  })
})

describe('stoppedFromError', () => {
  it('maps the two interruptions to their own markers', () => {
    expect(stoppedFromError({ kind: 'cancelled' })).toBe('cancelled')
    expect(stoppedFromError({ kind: 'timeout', afterMs: 1000 })).toBe('timeout')
  })

  it('maps a failure of the call itself to no marker at all', () => {
    // Nothing was cut short here: the request never produced a reply, so there
    // is no partial to keep and a marker would claim otherwise.
    expect(stoppedFromError({ kind: 'unavailable', service: 'ollama', hint: 'x' })).toBeNull()
    expect(
      stoppedFromError({ kind: 'upstream', service: 'ollama', status: 500, message: 'x' })
    ).toBeNull()
  })
})

describe('resolveModel', () => {
  function model(name: string): AiModel {
    return {
      provider: 'ollama',
      name,
      parameterSize: '',
      sizeBytes: 0,
      capabilities: [],
      contextLength: null,
      attention: null
    }
  }

  const catalog = [model('gemma3:4b'), model('qwen2.5-coder:3b')]

  it('keeps the chosen model when it is installed', () => {
    expect(resolveModel('qwen2.5-coder:3b', catalog)).toBe('qwen2.5-coder:3b')
  })

  it('falls back to the first installed model when nothing was chosen', () => {
    // There is no hardcoded default any more (D15.2). The old constant was how
    // the app could confidently send `gemma3:4b` to an Ollama that never had it.
    expect(resolveModel(undefined, catalog)).toBe('gemma3:4b')
  })

  it('falls back when the chosen model was uninstalled', () => {
    // Nothing about the transcript is lost: each message records the model that
    // produced it (D13.4), so history keeps saying what it was written with.
    expect(resolveModel('mistral:7b', catalog)).toBe('gemma3:4b')
  })

  it('is null when the machine has no model at all', () => {
    // A state the selector draws — not one the send path should work around.
    expect(resolveModel('gemma3:4b', [])).toBeNull()
    expect(resolveModel(undefined, [])).toBeNull()
  })
})
