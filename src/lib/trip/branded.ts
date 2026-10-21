/**
 * Strings whose format the type system tracks. A plain `string` cannot be
 * used where one of these is expected: user input goes through its `parse*`
 * function, and values the server sent are cast at the RPC boundary
 * (`fetchTrip`, `createTrip`) without a runtime check.
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** A date that exists, `YYYY-MM-DD`, in the trip's local calendar. */
export type IsoDate = Brand<string, "IsoDate">;

/** A local time of day with no timezone, `HH:MM` from `00:00` to `23:59`. */
export type HhMm = Brand<string, "HhMm">;

/**
 * A trip's share token as `create_trip` issues it: 128 random bits as unpadded
 * base64url, 22 characters.
 */
export type ShareToken = Brand<string, "ShareToken">;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const SHARE_TOKEN = /^[A-Za-z0-9_-]{22}$/;

/** `s` as an `IsoDate`, or `null` unless it is `YYYY-MM-DD` and the date exists (`2026-02-30` does not). */
export function parseIsoDate(s: string): IsoDate | null {
  const match = ISO_DATE.exec(s);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Date.UTC rolls an out-of-range month or day over into the next one.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return s as IsoDate;
}

/** `s` as an `HhMm`, or `null` unless it is `HH:MM` from `00:00` to `23:59`. */
export function parseHhMm(s: string): HhMm | null {
  return HH_MM.test(s) ? (s as HhMm) : null;
}

/** `s` as a `ShareToken`, or `null` unless it has the shape `create_trip` issues. */
export function parseShareToken(s: string): ShareToken | null {
  return SHARE_TOKEN.test(s) ? (s as ShareToken) : null;
}
