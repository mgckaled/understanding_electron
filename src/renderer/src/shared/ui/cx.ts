/**
 * Joins truthy class name fragments with a space. Purely a join — it does
 * NOT resolve conflicting utilities (e.g. two `rounded-*` classes). That
 * problem is already solved by the variant-as-constant convention (skill
 * design-system): whatever a variant/size/shape overrides never sits in a
 * shared BASE, so there is nothing left to resolve at the string level.
 *
 * @param classes - Class name fragments; falsy values are dropped.
 * @returns The space-joined result.
 */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
