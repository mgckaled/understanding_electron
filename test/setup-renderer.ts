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

/*
 * jsdom 30.0.1 does not implement the Popover API either — no showPopover /
 * hidePopover, and `:popover-open` is not a selector `.matches()` recognizes. Same
 * shape as the <dialog> shim above: enough to mount and drive a component built on
 * `popover="auto"`, not a stand-in for the platform. Light-dismiss, Esc and CSS
 * anchor positioning have no equivalent here — verified live against a real
 * Chromium build instead (DS-4 plan, Fase 3: clicking a trigger to close an open
 * popover does not reopen it).
 */
if (typeof HTMLElement !== 'undefined' && !HTMLElement.prototype.showPopover) {
  const OPEN_ATTR = 'data-popover-open-shim'

  HTMLElement.prototype.showPopover = function (this: HTMLElement): void {
    this.setAttribute(OPEN_ATTR, '')
    const event = new Event('toggle')
    Object.assign(event, { newState: 'open' })
    this.dispatchEvent(event)
  }
  HTMLElement.prototype.hidePopover = function (this: HTMLElement): void {
    if (!this.hasAttribute(OPEN_ATTR)) return
    this.removeAttribute(OPEN_ATTR)
    const event = new Event('toggle')
    Object.assign(event, { newState: 'closed' })
    this.dispatchEvent(event)
  }

  const originalMatches = Element.prototype.matches
  Element.prototype.matches = function (this: Element, selector: string): boolean {
    if (selector === ':popover-open') return this.hasAttribute(OPEN_ATTR)
    return originalMatches.call(this, selector)
  }
}

afterEach(() => {
  cleanup()
})
