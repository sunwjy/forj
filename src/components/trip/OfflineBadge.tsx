import styles from "./trip.module.css";

/** Shown in the top bar's D-day spot and atop the edit sheet while offline (spec 7.7). */
export function OfflineBadge() {
  return (
    <span className={styles.offline} role="status">
      연결 끊김 · 다시 연결하는 중
    </span>
  );
}
