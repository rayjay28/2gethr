/**
 * Helpers for converting the separate date/time <input> values used in the
 * calendar event forms into correct, timezone-aware ISO 8601 instants.
 *
 * BUG THIS FIXES: the create-event and edit-event forms used to build the
 * timestamp sent to the API by string-concatenating the date/time inputs
 * with no offset (create) or by falsely labeling the local wall-clock value
 * as UTC with a trailing "Z" (edit). Since `events.start_time`/`end_time`
 * are TIMESTAMPTZ columns, a zone-less string is interpreted by Postgres as
 * UTC, so a user's local time got shifted by their UTC offset on save (and
 * could roll over to the wrong calendar day near midnight).
 *
 * These helpers instead construct a real JS Date from explicit local
 * year/month/day/hour/minute components, so `.toISOString()` always
 * produces the correct UTC instant for whatever the user actually typed in
 * their own timezone.
 */

/**
 * Combine a `YYYY-MM-DD` date input value and an `HH:mm` time input value,
 * both understood to be in the browser's local timezone, into a UTC ISO
 * 8601 string suitable for a TIMESTAMPTZ column.
 */
export function localDateTimeToISO(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  const local = new Date(year, month - 1, day, hour, minute, 0, 0)
  return local.toISOString()
}

/** Local midnight (00:00) of the given `YYYY-MM-DD` date, as a UTC ISO string. */
export function localStartOfDayToISO(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const local = new Date(year, month - 1, day, 0, 0, 0, 0)
  return local.toISOString()
}

/** Local end-of-day (23:59:59.999) of the given `YYYY-MM-DD` date, as a UTC ISO string. */
export function localEndOfDayToISO(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const local = new Date(year, month - 1, day, 23, 59, 59, 999)
  return local.toISOString()
}
