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
 * server. Each kind maps to one RPC (spec 5.3).
 */
export type TripChange =
  /** `item` carries the client-generated id and an optimistic `created_at`. */
  | { kind: "create_item"; item: ItemSnapshot }
  | { kind: "update_item"; id: string; patch: ItemPatch }
  | { kind: "delete_item"; id: string }
  | { kind: "update_trip_title"; title: string }
  /**
   * `deleted_ids` are the items the user confirmed would go with the dates
   * that leave the trip (spec 2.6); the server refuses if they differ.
   */
  | { kind: "set_trip_dates"; start_date: string; end_date: string; deleted_ids: string[] };

/** The id of the item a change writes, or `undefined` for a change to the trip itself. */
export function changedItemId(change: TripChange): string | undefined {
  switch (change.kind) {
    case "create_item":
      return change.item.id;
    case "update_item":
    case "delete_item":
      return change.id;
    default:
      return undefined;
  }
}

/**
 * `created_at` for an item shown before the server has it, in the server's
 * fixed-width format (`YYYY-MM-DDTHH:MM:SS.ffffffZ`) so it sorts among the
 * snapshot's items by plain string comparison (spec 2.4).
 */
export function optimisticCreatedAt(now: Date): string {
  return now.toISOString().replace("Z", "000Z");
}

function applyChange(trip: TripSnapshot, change: TripChange): TripSnapshot {
  const { items } = trip;
  switch (change.kind) {
    case "create_item":
      // Once the server has it, its copy (with the real created_at) wins.
      return items.some((i) => i.id === change.item.id) ? trip : { ...trip, items: [...items, change.item] };
    case "update_item":
      return { ...trip, items: items.map((i) => (i.id === change.id ? { ...i, ...change.patch } : i)) };
    case "delete_item":
      return { ...trip, items: items.filter((i) => i.id !== change.id) };
    case "update_trip_title":
      return { ...trip, title: change.title };
    case "set_trip_dates": {
      const { start_date, end_date } = change;
      // Shown as the server will leave it: nothing outside the new period.
      return { ...trip, start_date, end_date, items: items.filter((i) => i.date >= start_date && i.date <= end_date) };
    }
  }
}

/**
 * What the screen shows: the server snapshot with the pending changes replayed
 * on top, in the order they were made (spec 6.2). A change whose item the
 * snapshot no longer has is skipped. The snapshot is not modified.
 */
export function rebase(snapshot: TripSnapshot, changes: readonly TripChange[]): TripSnapshot {
  if (changes.length === 0) return snapshot;
  const trip = changes.reduce(applyChange, snapshot);
  return { ...trip, items: sortItems(trip.items) };
}
