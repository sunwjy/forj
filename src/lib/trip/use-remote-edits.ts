"use client";

import { useState } from "react";
import type { RemoteMarks } from "./remote-edit";

type Merge<Base, Draft, K extends string> = (
  base: Base,
  draft: Draft,
  latest: Base,
) => { base: Base; draft: Draft; marks: RemoteMarks<K> };

/**
 * An open edit sheet's form state, kept in step with others' edits (spec 7.7).
 * `base` is what the sheet last compared against, so saving sends only my
 * edits (spec 6.1). Whenever `latest` (the values as shown now) differs from
 * it, `merge` folds the change into the draft and the marks accumulate.
 * `base` and `latest` are `undefined` when there is nothing to compare, such
 * as for a new item or one someone else deleted.
 */
export function useRemoteEdits<Base, Draft, K extends string>(options: {
  initialBase: Base | undefined;
  initialDraft: Draft;
  latest: Base | undefined;
  differs: (base: Base, latest: Base) => boolean;
  merge: Merge<Base, Draft, K>;
}) {
  const { latest, differs, merge } = options;
  const [base, setBase] = useState(options.initialBase);
  const [draft, setDraft] = useState(options.initialDraft);
  const [marks, setMarks] = useState<RemoteMarks<K>>({});

  // Adjusting state while rendering: React re-renders before painting.
  if (base !== undefined && latest !== undefined && differs(base, latest)) {
    const merged = merge(base, draft, latest);
    setBase(merged.base);
    setDraft(merged.draft);
    setMarks((m) => ({ ...m, ...merged.marks }));
  }

  return { base, draft, setDraft, marks };
}
