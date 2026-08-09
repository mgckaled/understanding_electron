import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/*
 * jsdom 30.0.1 does not implement <dialog>. Read from the source rather than a
 * changelog: lib/jsdom/living/nodes/HTMLDialogElement-impl.js is an empty
 * subclass of HTMLElement — no show, no showModal, no close, nothing behind a
 * flag. A component that opens a dialog therefore dies with
 * "showModal is not a function" before any assertion runs.
 *
 * The three methods below are the minimum that lets such a component mount and
 * be driven. They are NOT a stand-in for the platform: the top layer, the focus
 * trap, Esc, `closedby` and ::backdrop have no equivalent here, and asserting
 * them against this shim would be testing the shim. Those are verified live
 * against the real Chromium — see the plano 13 diary.
 */
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  const open = function (this: HTMLDialogElement): void {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.show = open
  HTMLDialogElement.prototype.showModal = open
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement, value?: string): void {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    if (value !== undefined) this.returnValue = value
    this.dispatchEvent(new Event('close'))
  }
}

afterEach(() => {
  cleanup()
})
