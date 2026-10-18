import { describe, expect, it } from "vitest";
import { createRecentTrips, forgetTripAtPath, recordTripLookup, type RecentTripsStorage } from "./recent-trips";
import type { TripSnapshot } from "./trip/snapshot";

/** An in-memory stand-in for `localStorage`. */
function memoryStorage(initial: Record<string, string> = {}): RecentTripsStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

/** A clock that moves forward one minute each time it is read. */
function tickingClock(start = Date.UTC(2026, 9, 17, 9, 0)) {
  let now = start;
  return () => {
    const value = now;
    now += 60_000;
    return value;
  };
}

const osaka = { token: "osakaTrip0000000000000", title: "오사카 먹방 여행", startDate: "2026-11-20", endDate: "2026-11-23" };
const jeju = { token: "jejuTrip00000000000000", title: "제주 가족 여행", startDate: "2026-12-01", endDate: "2026-12-03" };
const busan = { token: "busanTrip0000000000000", title: "부산 당일치기", startDate: "2027-01-09", endDate: "2027-01-09" };

describe("recent trips", () => {
  it("starts empty", () => {
    expect(createRecentTrips(memoryStorage(), tickingClock()).list()).toEqual([]);
  });

  it("remembers a trip with its snapshot and when it was opened", () => {
    const recent = createRecentTrips(memoryStorage(), () => Date.UTC(2026, 9, 17, 9, 0));

    recent.remember(osaka);

    expect(recent.list()).toEqual([{ ...osaka, openedAt: Date.UTC(2026, 9, 17, 9, 0) }]);
  });

  it("keeps the list in storage for the next visit", () => {
    const storage = memoryStorage();
    createRecentTrips(storage, tickingClock()).remember(osaka);

    expect(createRecentTrips(storage, tickingClock()).list().map((trip) => trip.token)).toEqual([osaka.token]);
  });

  it("lists the most recently opened trip first", () => {
    const recent = createRecentTrips(memoryStorage(), tickingClock());

    recent.remember(osaka);
    recent.remember(jeju);
    recent.remember(busan);

    expect(recent.list().map((trip) => trip.title)).toEqual(["부산 당일치기", "제주 가족 여행", "오사카 먹방 여행"]);
  });

  it("reopening a trip updates its snapshot and moves it to the top without a duplicate", () => {
    const storage = memoryStorage();
    const first = createRecentTrips(storage, () => Date.UTC(2026, 9, 17, 9, 0));
    first.remember(osaka);
    first.remember(jeju);
    // A day later someone renamed the trip and moved its end date.
    const second = createRecentTrips(storage, () => Date.UTC(2026, 9, 18, 21, 30));
    second.remember({ ...osaka, title: "오사카·교토 여행", endDate: "2026-11-24" });

    expect(second.list()).toEqual([
      { token: osaka.token, title: "오사카·교토 여행", startDate: "2026-11-20", endDate: "2026-11-24", openedAt: Date.UTC(2026, 9, 18, 21, 30) },
      { ...jeju, openedAt: Date.UTC(2026, 9, 17, 9, 0) },
    ]);
  });

  it("keeps at most 50 trips, pushing out the least recently opened", () => {
    const storage = memoryStorage();
    const recent = createRecentTrips(storage, tickingClock());
    for (let n = 1; n <= 51; n++) {
      recent.remember({ ...osaka, token: `trip${String(n).padStart(18, "0")}`, title: `여행 ${n}` });
    }

    const titles = recent.list().map((trip) => trip.title);
    expect(titles).toHaveLength(50);
    expect(titles[0]).toBe("여행 51");
    expect(titles.at(-1)).toBe("여행 2");
    expect(createRecentTrips(storage).list()).toHaveLength(50);
  });

  it("forgets a trip and can put it back where it was", () => {
    const storage = memoryStorage();
    const recent = createRecentTrips(storage, tickingClock());
    recent.remember(osaka);
    recent.remember(jeju);
    recent.remember(busan);
    const before = recent.list();

    const forgotten = recent.forget(jeju.token);
    expect(recent.list().map((trip) => trip.title)).toEqual(["부산 당일치기", "오사카 먹방 여행"]);
    expect(createRecentTrips(storage).list()).toHaveLength(2);

    recent.restore(forgotten!);
    expect(recent.list()).toEqual(before);
  });

  it("forgetting a trip that is not listed changes nothing", () => {
    const recent = createRecentTrips(memoryStorage(), tickingClock());
    recent.remember(osaka);

    expect(recent.forget(jeju.token)).toBeUndefined();
    expect(recent.list().map((trip) => trip.token)).toEqual([osaka.token]);
  });

  it("undo does not bring back an old snapshot over a trip opened again since", () => {
    const recent = createRecentTrips(memoryStorage(), tickingClock());
    recent.remember(osaka);
    const forgotten = recent.forget(osaka.token)!;
    recent.remember({ ...osaka, title: "오사카·교토 여행" });

    recent.restore(forgotten);

    expect(recent.list().map((trip) => trip.title)).toEqual(["오사카·교토 여행"]);
  });

  it("works for the visit when storage is unavailable or throws", () => {
    const throwing: RecentTripsStorage = {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    };

    const full = memoryStorage({ "forj.recentTrips": "[]" });
    full.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };

    for (const storage of [null, throwing, full]) {
      const recent = createRecentTrips(storage, tickingClock());
      recent.remember(osaka);
      recent.remember(jeju);
      recent.forget(osaka.token);
      expect(recent.list().map((trip) => trip.token)).toEqual([jeju.token]);
    }
  });

  it("ignores stored data it cannot read", () => {
    const valid = { ...jeju, openedAt: 1 };
    const broken = memoryStorage({ "forj.recentTrips": "{not json" });
    const mixed = memoryStorage({
      "forj.recentTrips": JSON.stringify([valid, { token: 42 }, null, { ...osaka, openedAt: "yesterday" }]),
    });

    expect(createRecentTrips(broken).list()).toEqual([]);
    expect(createRecentTrips(mixed).list()).toEqual([valid]);
  });

  it("tells subscribers when the list changes", () => {
    const recent = createRecentTrips(memoryStorage(), tickingClock());
    const seen: string[][] = [];
    const unsubscribe = recent.subscribe(() => seen.push(recent.list().map((trip) => trip.token)));

    recent.remember(osaka);
    recent.forget(osaka.token);
    unsubscribe();
    recent.remember(jeju);

    expect(seen).toEqual([[osaka.token], []]);
  });
});

describe("recordTripLookup", () => {
  const renamed: TripSnapshot = { title: "오사카·교토 여행", start_date: "2026-11-20", end_date: "2026-11-24", items: [] };

  function withOsakaAndJeju() {
    const recent = createRecentTrips(memoryStorage(), tickingClock());
    recent.remember(osaka);
    recent.remember(jeju);
    return recent;
  }

  it("a successful lookup refreshes the trip's snapshot and moves it to the top", () => {
    const recent = withOsakaAndJeju();

    recordTripLookup(recent, osaka.token, { status: "found", trip: renamed });

    expect(recent.list()[0]).toMatchObject({
      token: osaka.token,
      title: "오사카·교토 여행",
      startDate: "2026-11-20",
      endDate: "2026-11-24",
    });
  });

  it("a shared trip opened for the first time joins the list", () => {
    const recent = createRecentTrips(memoryStorage(), tickingClock());

    recordTripLookup(recent, busan.token, {
      status: "found",
      trip: { title: busan.title, start_date: busan.startDate, end_date: busan.endDate, items: [] },
    });

    expect(recent.list().map((trip) => trip.token)).toEqual([busan.token]);
  });

  it("TRIP_NOT_FOUND removes the trip from the list", () => {
    const recent = withOsakaAndJeju();

    recordTripLookup(recent, osaka.token, { status: "not_found" });

    expect(recent.list().map((trip) => trip.token)).toEqual([jeju.token]);
  });

  it("a network error keeps the trip as it was", () => {
    const recent = withOsakaAndJeju();
    const before = recent.list();

    recordTripLookup(recent, osaka.token, { status: "error" });
    recordTripLookup(recent, osaka.token, { status: "error", trip: renamed });
    recordTripLookup(recent, osaka.token, { status: "loading" });

    expect(recent.list()).toEqual(before);
  });
});

describe("forgetTripAtPath", () => {
  it("the not-found page of a trip's link removes that trip from the list", () => {
    const recent = createRecentTrips(memoryStorage(), tickingClock());
    recent.remember(osaka);
    recent.remember(jeju);

    forgetTripAtPath(recent, `/t/${osaka.token}`);

    expect(recent.list().map((trip) => trip.token)).toEqual([jeju.token]);
  });

  it("any other path leaves the list alone", () => {
    const recent = createRecentTrips(memoryStorage(), tickingClock());
    recent.remember(osaka);
    const before = recent.list();

    forgetTripAtPath(recent, "/");
    forgetTripAtPath(recent, `/t/${osaka.token}/extra`);
    forgetTripAtPath(recent, `/x/${osaka.token}`);

    expect(recent.list()).toEqual(before);
  });
});
