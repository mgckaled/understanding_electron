import { BrowserWindow } from 'electron'

/**
 * Prints a self-contained HTML document to PDF bytes in a hidden window.
 *
 * The document arrives in two stages — a minimal `data:` URL, then the real
 * content by `executeJavaScript` — because a `data:` URL carrying the whole
 * document fails with `ERR_FAILED` somewhere between 128 and 192 kB, measured,
 * which a long draft reaches (DE1F.2). The `<meta>` policy inside the document
 * still applies through that path: verified live, against the general advice
 * that a dynamically inserted CSP is ignored.
 *
 * Sandboxed explicitly, like {@link rasterizeToPng}: this window is born and
 * destroyed inside a handler and `security-boundary.spec.ts` never sees it.
 *
 * @param html - A complete document, with every run already escaped (DE1F.3).
 */
export async function printPdf(html: string): Promise<Uint8Array> {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  })

  try {
    await window.loadURL('data:text/html,<div></div>')
    await window.webContents.executeJavaScript(
      `document.documentElement.innerHTML = ${JSON.stringify(html)}; true`
    )
    // Printing before the load settles yields a BLANK pdf with no error, so
    // both awaits above are the guarantee, not hygiene.
    return await window.webContents.printToPDF({
      preferCSSPageSize: true,
      printBackground: true
    })
  } finally {
    window.destroy()
  }
}
