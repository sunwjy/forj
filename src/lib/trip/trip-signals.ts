/**
 * When to refetch a trip (spec 6.4) and whether its realtime channel is down
 * (spec 7.7).
 *
 * - A `changed` signal, a (re)connect of the channel and the page coming back
 *   (tab visible again, network back) each ask for a reload. Triggers that
 *   arrive within `COALESCE_MS` of each other become one reload. The store
 *   applies only the newest response, and there is no polling.
 * - The channel counts as disconnected once it has not been subscribed, or
 *   the browser has been offline, for `DISCONNECTED_AFTER_MS`. An open socket
 *   can take a heartbeat or two to notice a lost network, hence the second
 *   source. supabase-js rejoins by itself, so nothing here reconnects.
 *
 * Framework-free so it can be tested with fake timers; `useTripSignals` binds
 * it to Supabase Realtime and the page.
 */

export const COALESCE_MS = 250;
export const DISCONNECTED_AFTER_MS = 3000;

/** The statuses supabase-js reports to `channel.subscribe`. */
export type ChannelStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

export type TripSignalsDeps = {
  reload: () => void;
  /** Joins the trip's channel; returns a function that leaves it. */
  channel: (handlers: { onChanged: () => void; onStatus: (status: ChannelStatus) => void }) => () => void;
  /**
   * Listens for the tab becoming visible and the network going away or coming
   * back; returns a function that stops listening.
   */
  page: (handlers: { onVisible: () => void; onOnline: () => void; onOffline: () => void }) => () => void;
};

export type TripSignals = {
  isDisconnected: () => boolean;
  subscribe: (listener: () => void) => () => void;
  stop: () => void;
};

export function createTripSignals({ reload, channel, page }: TripSignalsDeps): TripSignals {
  let disconnected = false;
  let stopped = false;
  let subscribed = false;
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  let downTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  function setDisconnected(value: boolean) {
    if (disconnected === value) return;
    disconnected = value;
    for (const listener of listeners) listener();
  }

  function scheduleReload() {
    if (stopped) return;
    reloadTimer ??= setTimeout(() => {
      reloadTimer = undefined;
      reload();
    }, COALESCE_MS);
  }

  function wentDown() {
    downTimer ??= setTimeout(() => setDisconnected(true), DISCONNECTED_AFTER_MS);
  }

  function cameUp() {
    if (downTimer !== undefined) clearTimeout(downTimer);
    downTimer = undefined;
    setDisconnected(false);
  }

  function onStatus(status: ChannelStatus) {
    if (stopped) return;
    subscribed = status === "SUBSCRIBED";
    if (!subscribed) {
      wentDown();
      return;
    }
    cameUp();
    scheduleReload();
  }

  function onOnline() {
    if (stopped) return;
    // The channel stayed joined while offline: nothing to wait for.
    if (subscribed) cameUp();
    scheduleReload();
  }

  function onOffline() {
    if (!stopped) wentDown();
  }

  // Not subscribed yet counts as down, so a channel that never joins shows up.
  wentDown();
  const leaveChannel = channel({ onChanged: scheduleReload, onStatus });
  const leavePage = page({ onVisible: scheduleReload, onOnline, onOffline });

  return {
    isDisconnected: () => disconnected,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    stop() {
      stopped = true;
      if (reloadTimer !== undefined) clearTimeout(reloadTimer);
      if (downTimer !== undefined) clearTimeout(downTimer);
      reloadTimer = downTimer = undefined;
      leaveChannel();
      leavePage();
      setDisconnected(false);
      listeners.clear();
    },
  };
}
