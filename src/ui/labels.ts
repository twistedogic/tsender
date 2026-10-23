/**
 * The scenario schema is snake_case; the form is read by a person.
 *
 * One mechanical transform rather than a per-field label map, so a newly added
 * event type gets readable titles without anyone editing a lookup table.
 */

/** `reserve_months` -> `Reserve months`. A trailing `(hint)` is preserved. */
export function humanize(key: string): string {
  const [name, hint] = key.split(" (");
  const words = (name ?? "").replace(/_/g, " ");
  const label = words.charAt(0).toUpperCase() + words.slice(1);
  const withId = label.replace(/^Id\b/, "ID");
  return hint ? `${withId} (${hint}` : withId;
}