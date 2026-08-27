// The 64 hex chars of a sha256 digest (D16.3). It lives in core/, and not
// beside any one caller, because three of them interpolate the value into a
// path — a copy next to one becomes a bypass in the next (DF3E.4).
const ATTACHMENT_HASH = /^[a-f0-9]{64}$/

/** Whether `hash` can address a stored attachment blob. */
export function isAttachmentHash(hash: string): boolean {
  return ATTACHMENT_HASH.test(hash)
}
