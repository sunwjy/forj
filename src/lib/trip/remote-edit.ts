/**
 * Someone else changed what an open edit sheet shows (spec 7.7).
 *
 * - A field I have not touched takes the new value ("theirs").
 * - A field I edited keeps my input ("mine"); saving will overwrite theirs
 *   (field-level last-write-wins, spec 6.1).
 *
 * The caller then compares against the latest values, so saving still sends
 * only the fields I changed and never echoes values I merely took over.
 */

import type { ItemFields } from "./changes";
import { draftFromItem, type ItemDraft } from "./item-draft";

export type RemoteMark = "theirs" | "mine";
export type RemoteMarks<K extends string = keyof ItemDraft> = Partial<Record<K, RemoteMark>>;

/** Merges form values; `base` is what the form last compared against. */
export function mergeRemoteFields<K extends string>(
  base: Record<K, string>,
  draft: Record<K, string>,
  latest: Record<K, string>,
): { draft: Record<K, string>; marks: RemoteMarks<K> } {
  const next = { ...draft };
  const marks: RemoteMarks<K> = {};
  for (const field of Object.keys(base) as K[]) {
    if (latest[field] === base[field]) continue;
    if (draft[field] === base[field]) {
      next[field] = latest[field];
      marks[field] = "theirs";
    } else if (draft[field] !== latest[field]) {
      marks[field] = "mine";
    }
  }
  return { draft: next, marks };
}

export type MergedItem = { base: ItemFields; draft: ItemDraft; marks: RemoteMarks };

/** The item sheet's merge; the new `base` is the latest item. */
export function mergeRemoteItem(base: ItemFields, draft: ItemDraft, latest: ItemFields): MergedItem {
  const merged = mergeRemoteFields(draftFromItem(base), draft, draftFromItem(latest));
  return { base: latest, ...merged };
}
