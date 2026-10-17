import { showToast } from "@/components/toast";

type Clipboard = Pick<globalThis.Clipboard, "writeText">;

/**
 * Copies the share link of the trip open at `pageUrl` (spec 7.5). The link is
 * the page URL without query or hash: the token in the path is the whole key.
 */
export async function copyShareLink(pageUrl: string, clipboard: Clipboard | undefined) {
  const url = new URL(pageUrl);
  const link = `${url.origin}${url.pathname}`;
  try {
    if (!clipboard) throw new Error("Clipboard API unavailable");
    await clipboard.writeText(link);
    showToast("공유 링크를 복사했어요");
  } catch {
    showToast("공유 링크를 복사하지 못했어요");
  }
}
