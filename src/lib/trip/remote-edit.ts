/**
 * Someone else changed the item while its edit sheet is open (spec 7.7).
 *
 * - A field I have not touched takes the new value ("theirs").
 * - A field I edited keeps my input ("mine"); saving will overwrite theirs
 *   (field-level last-write-wins, spec 6.1).
 *
 * The new `base` is the latest item, so saving still sends only the fields I
 * changed and never echoes values I merely took over.
 */

import type { ItemFields } from "./changes";
import { draftFromItem, type ItemDraft } from "./item-draft";

export type RemoteMark = "theirs" | "mine";
export type RemoteMarks = Partial<Record<keyof ItemDraft, RemoteMark>>;

export type MergedItem = { base: ItemFields; draft: ItemDraft; marks: RemoteMarks };

const FIELDS = ["emoji", "title", "date", "start_time", "end_time", "memo"] as const;

export function mergeRemoteItem(base: ItemFields, draft: ItemDraft, latest: ItemFields): MergedItem {
  const before = draftFromItem(base);
  const after = draftFromItem(latest);
  const next = { ...draft };
  const marks: RemoteMarks = {};
  for (const field of FIELDS) {
    if (after[field] === before[field]) continue;
    if (draft[field] === before[field]) {
      next[field] = after[field];
      marks[field] = "theirs";
    } else if (draft[field] !== after[field]) {
      marks[field] = "mine";
    }
  }
  return { base: latest, draft: next, marks };
}
