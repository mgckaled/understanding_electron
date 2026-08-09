import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'

/*
 * Configuration has two scales, and this is the machine one (D13.4).
 *
 *   machine  — does not change the answer, changes the computer's appetite
 *   conversa — changes what the model answers (model, num_ctx, system prompt)
 *
 * `numThread` is machine scale. The criterion is not "rarely chosen": it is a
 * property OF THIS COMPUTER. Stored per conversation, reopening an old one
 * would restore a thread count that has nothing to do with today's machine,
 * and changing your mind would mean editing every conversation.
 *
 * Plano 14 persists this; until then it lives for the session.
 */

export type Settings = {
  /** Cap on the CPU threads Ollama may use — maps to options.num_thread. */
  numThread: number
}

// Capped for a laptop already running VS Code, a browser and this agent. The
// inference lives in the Ollama process, so this is the one lever the app has
// over its CPU appetite. See plano 09 D9.1.
export const DEFAULT_SETTINGS: Settings = { numThread: 4 }

type SettingsContextValue = {
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext)
  if (value === null) {
    throw new Error('useSettings must be called inside <SettingsProvider>.')
  }
  return value
}
