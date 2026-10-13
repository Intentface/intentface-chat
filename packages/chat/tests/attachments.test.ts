import { describe, expect, test } from "bun:test";
import { revokeAllAttachmentUrls, toAttachmentItem } from "../src/attachments/attachments";

describe("toAttachmentItem", () => {
  test("uses the blob URL as the id", () => {
    const item = toAttachmentItem(new File(["x"], "a.png", { type: "image/png" }));
    expect(item.url.startsWith("blob:")).toBe(true);
    expect(item.id).toBe(item.url);
    revokeAllAttachmentUrls([item]);
  });

  test("the same file added twice gets distinct ids", () => {
    const file = new File(["x"], "a.png", { type: "image/png" });
    const first = toAttachmentItem(file);
    const second = toAttachmentItem(file);
    expect(first.id).not.toBe(second.id);
    revokeAllAttachmentUrls([first, second]);
  });
});
