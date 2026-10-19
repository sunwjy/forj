import type { IsoDate } from "./branded";
import type { ItemSnapshot, TripSnapshot } from "./snapshot";
import { sortItems } from "./timeline";

/** The editable fields of an item. */
export type ItemFields = Pick<ItemSnapshot, "date" | "title" | "memo" | "startTime" | "endTime" | "emoji">;

/**
 * The fields an `update_item` sends: only those that changed. `startTime` and
 * `endTime` are both present or both absent (spec 6.1).
 */
export type ItemPatch = Partial<ItemFields>;

/**
 * One pending write, in the shape it is shown optimistically and sent to the
 * server. Each kind maps to one RPC (spec 5.3); `CHANGE_DEFINITIONS` defines how.
 */
export type TripChange =
  /** `item` carries the client-generated id and an optimistic `createdAt`. */
  | { kind: "create_item"; item: ItemSnapshot }
  | { kind: "update_item"; id: string; patch: ItemPatch }
  | { kind: "delete_item"; id: string }
  | { kind: "update_trip_title"; title: string }
  /**
   * `confirmedDeletedIds` are the items the user confirmed would go with the
   * dates that leave the trip (spec 2.6); the server refuses if they differ.
   */
  | { kind: "set_trip_dates"; startDate: IsoDate; endDate: IsoDate; confirmedDeletedIds: string[] };

/** Everything the client does differently for one kind of change. */
export type ChangeDefinition<C extends TripChange> = {
  /**
   * The RPC that sends the change (spec 5.3) and its arguments other than
   * `token`. Argument names are camelCase; `sendChange` spells them the way
   * the server does (`itemId` → `item_id`), and likewise the field names in
   * `update_item`'s `patch`. Nothing else nested is renamed.
   */
  rpc: (change: C) => { name: string; args: Record<string, unknown> };
  /** Replays the change on a snapshot (`rebase`). Must not modify `trip`. */
  apply: (trip: TripSnapshot, change: C) => TripSnapshot;
  /**
   * The item the change writes, or `undefined` for a change to the trip itself.
   * `from` is the view, before or after the change, that shows the item as a
   * rejection should offer it back (see `Rejection.item`).
   */
  item: { id: (change: C) => string; from: "before" | "after" } | undefined;
};

type ChangeDefinitions = { [K in TripChange["kind"]]: ChangeDefinition<Extract<TripChange, { kind: K }>> };

/** Every kind's definition. A kind added to `TripChange` must be defined here. */
export const CHANGE_DEFINITIONS: ChangeDefinitions = {
  create_item: {
    rpc: ({ item: { id, date, title, memo, startTime, endTime, emoji } }) => ({
      name: "create_item",
      args: { id, date, title, memo, startTime, endTime, emoji },
    }),
    // Once the server has it, its copy (with the real createdAt) wins.
    apply: (trip, { item }) => (trip.items.some((i) => i.id === item.id) ? trip : { ...trip, items: [...trip.items, item] }),
    item: { id: (change) => change.item.id, from: "after" },
  },
  update_item: {
    rpc: ({ id, patch }) => ({ name: "update_item", args: { itemId: id, patch } }),
    apply: (trip, { id, patch }) => ({ ...trip, items: trip.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }),
    item: { id: (change) => change.id, from: "after" },
  },
  delete_item: {
    rpc: ({ id }) => ({ name: "delete_item", args: { itemId: id } }),
    apply: (trip, { id }) => ({ ...trip, items: trip.items.filter((i) => i.id !== id) }),
    // After the delete the item is gone; offer it back as it was.
    item: { id: (change) => change.id, from: "before" },
  },
  update_trip_title: {
    rpc: ({ title }) => ({ name: "update_trip_title", args: { title } }),
    apply: (trip, { title }) => ({ ...trip, title }),
    item: undefined,
  },
  set_trip_dates: {
    rpc: ({ startDate, endDate, confirmedDeletedIds }) => ({
      name: "set_trip_dates",
      args: { startDate, endDate, confirmedDeletedIds },
    }),
    // Shown as the server will leave it: nothing outside the new period.
    apply: (trip, { startDate, endDate }) => ({
      ...trip,
      startDate,
      endDate,
      items: trip.items.filter((i) => i.date >= startDate && i.date <= endDate),
    }),
    item: undefined,
  },
};

/** The definition of `change`'s kind. */
export function changeDefinition<C extends TripChange>(change: C): ChangeDefinition<C> {
  // TypeScript cannot correlate `change.kind` with the indexed definition.
  return CHANGE_DEFINITIONS[change.kind] as unknown as ChangeDefinition<C>;
}

/** The id of the item a change writes, or `undefined` for a change to the trip itself. */
export function changedItemId(change: TripChange): string | undefined {
  return changeDefinition(change).item?.id(change);
}

/**
 * `createdAt` for an item shown before the server has it, in the server's
 * fixed-width format (`YYYY-MM-DDTHH:MM:SS.ffffffZ`) so it sorts among the
 * snapshot's items by plain string comparison (spec 2.4).
 */
export function optimisticCreatedAt(now: Date): string {
  return now.toISOString().replace("Z", "000Z");
}

/**
 * What the screen shows: the server snapshot with the pending changes replayed
 * on top, in the order they were made (spec 6.2). A change whose item the
 * snapshot no longer has is skipped. The snapshot is not modified.
 */
export function rebase(snapshot: TripSnapshot, changes: readonly TripChange[]): TripSnapshot {
  if (changes.length === 0) return snapshot;
  const trip = changes.reduce((view, change) => changeDefinition(change).apply(view, change), snapshot);
  return { ...trip, items: sortItems(trip.items) };
}
