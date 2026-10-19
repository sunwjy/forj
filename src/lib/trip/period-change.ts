import { tripDays } from "./days";
import type { ItemSnapshot, TripSnapshot } from "./snapshot";

export type PeriodChange = {
  /** Dates of the current period that the new one leaves out, in order. */
  removedDates: string[];
  /**
   * Items on those dates, in timeline order. Changing the period deletes them,
   * so they must be shown and confirmed first (spec 2.6), and their ids are
   * what `set_trip_dates` is sent as the confirmed deletions.
   */
  deletedItems: ItemSnapshot[];
};

/** What changing `trip`'s period to `startDate`–`endDate` (`YYYY-MM-DD`, valid) would remove. */
export function periodChange(trip: TripSnapshot, startDate: string, endDate: string): PeriodChange {
  const outside = (date: string) => date < startDate || date > endDate;
  return {
    removedDates: tripDays(trip.startDate, trip.endDate)
      .map((day) => day.date)
      .filter(outside),
    deletedItems: trip.items.filter((item) => outside(item.date)),
  };
}
