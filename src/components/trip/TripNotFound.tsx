import Link from "next/link";
import styles from "./trip.module.css";

/**
 * Shown for an unknown token, whether on first open or after the trip
 * disappears while open (spec 7.6).
 */
export function TripNotFound() {
  return (
    <main className={styles.message}>
      <Link href="/" className={styles.brand}>
        forj
      </Link>
      <div className={styles.messageArt} aria-hidden>
        🗺️
      </div>
      <h1 className={styles.messageTitle}>여행을 찾을 수 없어요</h1>
      <p className={styles.messageBody}>
        링크가 정확한지 확인해 주세요.
        <br />
        여행이 삭제되었을 수도 있어요.
      </p>
      <Link href="/" className={styles.primaryButton}>
        처음 화면으로
      </Link>
    </main>
  );
}
