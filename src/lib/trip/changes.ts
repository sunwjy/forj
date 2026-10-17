import type { ItemSnapshot, TripSnapshot } from "./snapshot";
import { sortItems } from "./timeline";

/** The editable fields of an item. */
export type ItemFields = Pick<ItemSnapshot, "date" | "title" | "memo" | "start_time" | "end_time" | "emoji">;

/**
 * The fields an `update_item` sends: only those that changed. `start_time` and
 * `end_time` are both present or both absent (spec 6.1).
 */
export type ItemPatch = Partial<ItemFields>;

/**
 * One pending write, in the shape it is shown optimistically and sent to the
 * server. Each kind maps to one RPC (spec 5.3). Trip edits (#21) add kinds here.
 */
export type TripChange =
  /** `item` carries the client-generated id and an optimistic `created_at`. */
  | { kind: "create_item"; item: ItemSnapshot }
  | { kind: "update_item"; id: string; patch: ItemPatch }
  | { kind: "delete_item"; id: string };

/**
 * `created_at` for an item shown before the server has it, in the server's
 * fixed-width format (`YYYY-MM-DDTHH:MM:SS.ffffffZ`) so it sorts among the
 * snapshot's items by plain string comparison (spec 2.4).
 */
export function optimisticCreatedAt(now: Date): string {
  return now.toISOString().replace("Z", "000Z");
}

function applyChange(items: ItemSnapshot[], change: TripChange): ItemSnapshot[] {
  switch (change.kind) {
    case "create_item":
      // Once the server has it, its copy (with the real created_at) wins.
      return items.some((i) => i.id === change.item.id) ? items : [...items, change.item];
    case "update_item":
      return items.map((i) => (i.id === change.id ? { ...i, ...change.patch } : i));
    case "delete_item":
      return items.filter((i) => i.id !== change.id);
  }
}

/**
 * What the screen shows: the server snapshot with the pending changes replayed
 * on top, in the order they were made (spec 6.2). A change whose item the
 * snapshot no longer has is skipped. The snapshot is not modified.
 */
export function rebase(snapshot: TripSnapshot, changes: readonly TripChange[]): TripSnapshot {
  if (changes.length === 0) return snapshot;
  const items = changes.reduce(applyChange, snapshot.items);
  return { ...snapshot, items: sortItems(items) };
}
