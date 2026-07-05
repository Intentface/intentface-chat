"use client";

import { useState } from "react";
import { type AttachmentItem, Attachments } from "@/components/ai/attachments";

// A removable attachment strip. Non-image items so no remote image loading is
// needed; the strip collapses when the last item is removed.
const INITIAL: AttachmentItem[] = [
  {
    id: "1",
    filename: "quarterly-report.pdf",
    mediaType: "application/pdf",
    url: "#",
    fileSize: 248_000,
  },
  {
    id: "2",
    filename: "meeting-notes.txt",
    mediaType: "text/plain",
    url: "#",
    fileSize: 1_200,
  },
];

export const AttachmentsBasic = () => {
  const [items, setItems] = useState<AttachmentItem[]>(INITIAL);

  return (
    <div className="w-full max-w-md">
      <Attachments show={items.length > 0}>
        {items.map((item) => (
          <Attachments.Item key={item.id} item={item}>
            <Attachments.Remove
              onRemove={() => setItems((current) => current.filter((i) => i.id !== item.id))}
            />
          </Attachments.Item>
        ))}
      </Attachments>
      {items.length === 0 && (
        <button
          type="button"
          onClick={() => setItems(INITIAL)}
          className="text-accent text-sm hover:text-accent-hover"
        >
          Reset
        </button>
      )}
    </div>
  );
};
