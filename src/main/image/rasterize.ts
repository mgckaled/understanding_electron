import { BrowserWindow } from 'electron'
import type { RasterFormat } from '@core/image/sniff'

/**
 * Rasterizes an SVG or WebP source to PNG (D17.7) — a hidden `BrowserWindow`
 * decodes the bytes into an `<img>`, draws it to a canvas at its natural
 * size, and reads the pixels back out via `toDataURL`. Bytes travel as a
 * `data:` URI, never `file://`: an image loaded across origins taints the
 * canvas and `toDataURL` throws, and a `data:` URI carries no origin to taint
 * with in the first place.
 *
 * Chosen over `capturePage()` (needs the window resized to the image's own
 * dimensions first) and `offscreen: true` (software compositing on this
 * machine's integrated GPU is the riskier path) after a live spike of all
 * three against a real SVG and a real WebP produced by Chromium's own canvas
 * encoder — this candidate produced a correct PNG for both on the first try
 * (D17.7). Genuinely untestable below live Electron (no jsdom `<canvas>`
 * decoder for SVG/WebP), so there is no unit test for this file.
 *
 * `bytes` is a file the USER picked, not code this app wrote — sandboxed the
 * same as the app's own window, spelled out rather than left to the
 * defaults (architecture skill), because this window is created and
 * destroyed inside a handler and never seen by `security-boundary.spec.ts`.
 * Safe to decode untrusted bytes this way because an `<img>` never executes
 * script or fetches a remote resource, even for SVG — that property is what
 * the whole approach rests on; loading the source through `loadURL` instead
 * would lose it silently.
 */
export async function rasterizeToPng(bytes: Buffer, format: RasterFormat): Promise<Buffer> {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  try {
    await window.loadURL('data:text/html,<div></div>')
    const dataUri = `data:${format};base64,${bytes.toString('base64')}`
    const dataUrl = await window.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight
            canvas.getContext('2d').drawImage(img, 0, 0)
            resolve(canvas.toDataURL('image/png'))
          } catch (error) {
            reject(new Error('draw/export failed: ' + error.message))
          }
        }
        img.onerror = () => reject(new Error('image failed to decode'))
        img.src = ${JSON.stringify(dataUri)}
      })
    `)
    return Buffer.from(dataUrl.split(',')[1], 'base64')
  } finally {
    window.destroy()
  }
}
