import { Home as HomeContent } from "@/components/Home";
import styles from "./page.module.css";

/** First screen (spec 7.1). What sits under the brand depends on this browser's recent trips. */
export default function Home() {
  return (
    <main className={styles.main}>
      <p className={`display ${styles.brand}`}>forj</p>
      <HomeContent />
    </main>
  );
}
