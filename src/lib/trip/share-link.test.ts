import { afterEach, describe, expect, it } from "vitest";
import { dismissToast, getToast } from "@/components/toast";
import { copyShareLink } from "./share-link";

function clipboard(write: (text: string) => Promise<void> = async () => {}) {
  const written: string[] = [];
  return {
    written,
    clipboard: {
      writeText: async (text: string) => {
        await write(text);
        written.push(text);
      },
    },
  };
}

afterEach(dismissToast);

describe("copyShareLink", () => {
  it("copies the trip's link without query or hash and says so", async () => {
    const { clipboard: board, written } = clipboard();

    await copyShareLink("https://forj.example/t/devExampleTrip00000000?x=1#day-2", board);

    expect(written).toEqual(["https://forj.example/t/devExampleTrip00000000"]);
    expect(getToast()?.message).toBe("공유 링크를 복사했어요");
  });

  it("tells the user when the browser refuses to copy", async () => {
    const { clipboard: board } = clipboard(async () => {
      throw new DOMException("denied", "NotAllowedError");
    });

    await copyShareLink("https://forj.example/t/devExampleTrip00000000", board);

    expect(getToast()?.message).toBe("공유 링크를 복사하지 못했어요");
  });
});
