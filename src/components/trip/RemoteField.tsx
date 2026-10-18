import type { RemoteMark } from "@/lib/trip/remote-edit";
import styles from "./RemoteField.module.css";

const NOTES: Record<RemoteMark, string> = {
  theirs: "방금 다른 사람이 바꿨어요",
  mine: "다른 사람도 바꿨어요. 저장하면 내 입력으로 바뀌어요",
};

/** Adds the butter highlight to a field's class when someone else changed it (spec 7.7). */
export function remoteClass(className: string, mark: RemoteMark | undefined): string {
  return mark ? `${className} ${styles.remote}` : className;
}

/** The note under a field someone else changed. */
export function RemoteNote({ mark }: { mark: RemoteMark | undefined }) {
  if (!mark) return null;
  return <p className={styles.note}>{NOTES[mark]}</p>;
}
