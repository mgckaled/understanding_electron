import { BrowserWindow } from 'electron'

// Chromium renders these templates with NO inherited style and a font size of
// zero, so every rule here is load-bearing. `pageNumber` and `totalPages` are
// its own class names, filled in per page (DE1F.9).
const FOOTER =
  '<div style="width:100%;font-size:9px;color:#555;padding:0 2cm;text-align:right">' +
  'Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>'

/** Empty on purpose: `displayHeaderFooter` alone would print title and date up top. */
const HEADER = '<span></span>'

/**
 * Prints a self-contained HTML document to PDF bytes in a hidden window.
 *
 * The document arrives in two stages — a minimal `data:` URL, then the real
 * content by `executeJavaScript` — which has no ceiling found at 4 MB, while a
 * `data:` URL carrying the whole document dies at 2 MB with `ERR_INVALID_URL`
 * (DE1F.2). The `<meta>` policy inside the document still applies through that
 * path: verified live, against the general advice that a dynamically inserted
 * CSP is ignored.
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
    // The doctype belongs to the FIRST load: `innerHTML` cannot change a
    // document's compat mode later, and without it the page renders in quirks
    // mode, where line height and table sizing follow other rules (DE1F.8).
    await window.loadURL('data:text/html,<!doctype html><div></div>')
    await window.webContents.executeJavaScript(
      `document.documentElement.innerHTML = ${JSON.stringify(html)}; true`
    )
    // Printing before the load settles yields a BLANK pdf with no error, so
    // both awaits above are the guarantee, not hygiene.
    return await window.webContents.printToPDF({
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: HEADER,
      footerTemplate: FOOTER
    })
  } finally {
    window.destroy()
  }
}
