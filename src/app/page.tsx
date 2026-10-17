import { TripCreateForm } from "@/components/TripCreateForm";
import styles from "./page.module.css";

/**
 * First screen (spec 7.1), in its no-recent-trips form: an introduction and
 * the trip creation form. The recent trips list arrives with its own issue.
 */
export default function Home() {
  return (
    <main className={styles.main}>
      <p className={`display ${styles.brand}`}>forj</p>
      <section className={styles.hero}>
        <div className={styles.emoji} aria-hidden>
          🧳
        </div>
        <h1 className="display">함께 짜는 여행 일정표</h1>
        <p>가입 없이 링크 하나로 일행과 함께 편집해요.</p>
      </section>
      <section className={styles.card} aria-label="여행 만들기">
        <TripCreateForm />
      </section>
    </main>
  );
}
