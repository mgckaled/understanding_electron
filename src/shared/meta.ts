/** Human-readable product name — window titles, panel headings. */
export const APP_NAME = 'crivo'

/**
 * AppUserModelID, used by `electronApp.setAppUserModelId`. Must stay identical
 * to `appId` in electron-builder.yml: the NSIS installer stamps it onto the
 * shortcut, and a process that declares a different one is treated by Windows as
 * a separate app — the taskbar stops grouping the window and notifications lose
 * their attribution.
 */
export const APP_ID = 'com.mgckaled.crivo'
