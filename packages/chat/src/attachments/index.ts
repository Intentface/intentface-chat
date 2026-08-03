// Public surface of @intentface/chat/attachments. No directive — see index.parts.ts.

export type {
  AttachmentErrorCode,
  AttachmentItem,
  AttachmentsDropzoneProps,
  AttachmentsDropzoneState,
  AttachmentsErrorProps,
  AttachmentsItemProps,
  AttachmentsRemoveProps,
  AttachmentsRootProps,
  AttachmentsTriggerProps,
} from "./attachments";
export {
  matchesAccept,
  revokeAllAttachmentUrls,
  revokeAttachmentUrl,
  toAttachmentItem,
} from "./attachments";
export * as Attachments from "./index.parts";
