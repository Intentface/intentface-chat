import type { AttachmentItem } from "@intentface/chat/attachments";
import type { FilePart } from "@intentface/chat/types";

// App-owned attachment policy + presentation + send strategy. The headless
// package ships the generic item machine and platform-default blob ingestion;
// what this app accepts, how items look, and how they serialize into message
// parts are decided here.

// ---------------------------------------------------------------------------
// Media taxonomy + size formatting (presentation)
// ---------------------------------------------------------------------------

export const isImageAttachment = (mediaType: string) => mediaType.startsWith("image/");

export const isPdfAttachment = (mediaType: string) => mediaType === "application/pdf";

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ---------------------------------------------------------------------------
// Policy — what this app accepts (the package imposes none)
// ---------------------------------------------------------------------------

export const ATTACHMENT_ACCEPT = "image/*,application/pdf,text/*";
export const ATTACHMENT_MAX_FILES = 5;
export const ATTACHMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Send: AttachmentItem → AI SDK FilePart (inline blob URLs as data URLs). The
// composer submits generic items; this adapter runs in the app's onSubmit.
// ---------------------------------------------------------------------------

const convertBlobUrlToDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const prepareAttachmentsForSend = async (
  attachments: AttachmentItem[],
): Promise<FilePart[]> =>
  Promise.all(
    attachments.map(async (item): Promise<FilePart> => {
      const url = item.url.startsWith("blob:")
        ? ((await convertBlobUrlToDataUrl(item.url)) ?? item.url)
        : item.url;
      return { type: "file", url, mediaType: item.mediaType ?? "", filename: item.filename };
    }),
  );
