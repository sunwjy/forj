import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COALESCE_MS, createTripSignals, DISCONNECTED_AFTER_MS, type ChannelStatus } from "./trip-signals";

/** A fake realtime channel and page that the test drives by hand. */
function setup() {
  let onChanged = () => {};
  let onStatus: (status: ChannelStatus) => void = () => {};
  let onVisible = () => {};
  let onOnline = () => {};
  let onOffline = () => {};
  const closed = { channel: false, page: false };
  const reload = vi.fn();
  const signals = createTripSignals({
    reload,
    channel: (handlers) => {
      onChanged = handlers.onChanged;
      onStatus = handlers.onStatus;
      return () => {
        closed.channel = true;
      };
    },
    page: (handlers) => {
      ({ onVisible, onOnline, onOffline } = handlers);
      return () => {
        closed.page = true;
      };
    },
  });
  return {
    signals,
    reload,
    closed,
    changed: () => onChanged(),
    status: (s: ChannelStatus) => onStatus(s),
    visible: () => onVisible(),
    online: () => onOnline(),
    offline: () => onOffline(),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("trip signals", () => {
  it("merges a burst of `changed` signals into one reload", () => {
    const { reload, changed, status } = setup();
    status("SUBSCRIBED");
    vi.advanceTimersByTime(COALESCE_MS);
    reload.mockClear();

    changed();
    vi.advanceTimersByTime(COALESCE_MS / 2);
    changed();
    changed();
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(COALESCE_MS);
    expect(reload).toHaveBeenCalledTimes(1);

    changed();
    vi.advanceTimersByTime(COALESCE_MS);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("reloads every time the channel (re)connects, to catch changes missed meanwhile", () => {
    const { reload, status } = setup();
    status("SUBSCRIBED");
    vi.advanceTimersByTime(COALESCE_MS);
    expect(reload).toHaveBeenCalledTimes(1);

    status("CHANNEL_ERROR");
    status("SUBSCRIBED");
    vi.advanceTimersByTime(COALESCE_MS);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("reloads when the tab is visible again", () => {
    const { reload, visible } = setup();
    visible();
    vi.advanceTimersByTime(COALESCE_MS);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads when the network is back", () => {
    const { reload, online } = setup();
    online();
    vi.advanceTimersByTime(COALESCE_MS);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("merges different triggers that arrive together", () => {
    const { reload, status, changed, visible, online } = setup();
    status("SUBSCRIBED");
    changed();
    visible();
    online();
    vi.advanceTimersByTime(COALESCE_MS);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reports disconnected only after the channel has been down for a few seconds", () => {
    const { signals, status } = setup();
    const seen: boolean[] = [];
    signals.subscribe(() => seen.push(signals.isDisconnected()));
    status("SUBSCRIBED");
    expect(signals.isDisconnected()).toBe(false);

    status("CHANNEL_ERROR");
    vi.advanceTimersByTime(DISCONNECTED_AFTER_MS - 1);
    expect(signals.isDisconnected()).toBe(false);
    status("TIMED_OUT");
    vi.advanceTimersByTime(1);
    expect(signals.isDisconnected()).toBe(true);

    status("SUBSCRIBED");
    expect(signals.isDisconnected()).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it("does not report a short drop that recovers in time", () => {
    const { signals, status } = setup();
    status("SUBSCRIBED");
    status("CHANNEL_ERROR");
    vi.advanceTimersByTime(DISCONNECTED_AFTER_MS - 1);
    status("SUBSCRIBED");
    vi.advanceTimersByTime(DISCONNECTED_AFTER_MS);
    expect(signals.isDisconnected()).toBe(false);
  });

  it("reports disconnected when the channel never connects", () => {
    const { signals } = setup();
    vi.advanceTimersByTime(DISCONNECTED_AFTER_MS);
    expect(signals.isDisconnected()).toBe(true);
  });

  it("reports disconnected when the browser goes offline, even if the socket has not noticed yet", () => {
    const { signals, status, offline, online, visible, reload } = setup();
    status("SUBSCRIBED");
    vi.advanceTimersByTime(COALESCE_MS);
    reload.mockClear();

    offline();
    vi.advanceTimersByTime(DISCONNECTED_AFTER_MS);
    expect(signals.isDisconnected()).toBe(true);
    visible();
    expect(signals.isDisconnected()).toBe(true);

    // Back online and the channel never dropped: connected again, and catch up.
    online();
    expect(signals.isDisconnected()).toBe(false);
    vi.advanceTimersByTime(COALESCE_MS);
    expect(reload).toHaveBeenCalled();
  });

  it("stays disconnected after going online while the channel is still down", () => {
    const { signals, status, offline, online } = setup();
    status("SUBSCRIBED");
    offline();
    status("CHANNEL_ERROR");
    vi.advanceTimersByTime(DISCONNECTED_AFTER_MS);
    online();
    expect(signals.isDisconnected()).toBe(true);
    status("SUBSCRIBED");
    expect(signals.isDisconnected()).toBe(false);
  });

  it("stops listening and reloading once stopped", () => {
    const { signals, reload, closed, changed, status } = setup();
    changed();
    signals.stop();
    // Leaving the channel reports CLOSED, and late signals may still come in.
    status("CLOSED");
    changed();
    vi.advanceTimersByTime(DISCONNECTED_AFTER_MS);
    expect(reload).not.toHaveBeenCalled();
    expect(signals.isDisconnected()).toBe(false);
    expect(closed).toEqual({ channel: true, page: true });
  });
});
