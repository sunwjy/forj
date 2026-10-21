/**
 * Test-only casts for writing fixtures as literals. App code gets these types
 * from a `parse*` function or the RPC boundary instead.
 */

import type { HhMm, IsoDate, ShareToken } from "./branded";

export const isoDate = (s: string) => s as IsoDate;
export const hhMm = (s: string) => s as HhMm;
export const shareToken = (s: string) => s as ShareToken;
