import type { FileUIPart } from "ai";
import { nanoid } from "nanoid";

export type AttachmentItem = FileUIPart & { id: string };

export type AttachmentErrorCode = "accept" | "max_file_size" | "max_files";

export interface AttachmentError {
  code: AttachmentErrorCode;
  message: string;
}

export const DEFAULT_ATTACHMENT_ACCEPT = "image/*,application/pdf";
export const DEFAULT_ATTACHMENT_MAX_FILES = 5;
export const DEFAULT_ATTACHMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;

export const matchesAccept = (file: File, accept: string): boolean => {
  if (!accept || accept.trim() === "") {
    return true;
  }

  const patterns = accept
    .split(",")
    .map((pattern) => pattern.trim())
    .filter(Boolean);

  return patterns.some((pattern) => {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1);
      return file.type.startsWith(prefix);
    }
    return file.type === pattern;
  });
};

export const toAttachmentItem = (file: File): AttachmentItem => ({
  filename: file.name,
  id: nanoid(),
  mediaType: file.type,
  type: "file",
  url: URL.createObjectURL(file),
});

export const revokeAttachmentUrl = (item: Pick<AttachmentItem, "url">) => {
  if (item.url?.startsWith("blob:")) {
    URL.revokeObjectURL(item.url);
  }
};

export const revokeAllAttachmentUrls = (items: AttachmentItem[]) => {
  for (const item of items) {
    revokeAttachmentUrl(item);
  }
};

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
): Promise<FileUIPart[]> => {
  return Promise.all(
    attachments.map(async ({ id: _id, ...attachment }) => {
      if (attachment.url.startsWith("blob:")) {
        const converted = await convertBlobUrlToDataUrl(attachment.url);
        return {
          ...attachment,
          url: converted ?? attachment.url,
        };
      }

      return attachment;
    }),
  );
};
