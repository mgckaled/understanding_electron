/** Human-readable product name — window titles, panel headings. */
export const APP_NAME = 'crivo'

/**
 * AppUserModelID, used by `electronApp.setAppUserModelId`.
 *
 * Must stay identical to `appId` in electron-builder.yml. The NSIS installer
 * stamps that value onto the shortcut it creates; when the running process
 * declares a different one, Windows treats shortcut and process as two separate
 * applications — the taskbar stops grouping the window under its own icon and
 * Action Center notifications lose their attribution.
 *
 * Reverse-domain form is the platform convention, and it is why this is not the
 * same constant as APP_NAME: that one is shown to the user, this one never is.
 */
export const APP_ID = 'com.mgckaled.crivo'
