// Part names for the `Attachments` namespace. Deliberately carries no
// "use client" directive: this module and index.ts must stay server-resolvable
// so a React Server Component can reach Attachments.Root and its siblings
// through them. The directive lives one level down, on attachments.tsx.
export {
  AttachmentsDropzone as Dropzone,
  AttachmentsError as Error,
  AttachmentsItem as Item,
  AttachmentsRemove as Remove,
  AttachmentsRoot as Root,
  AttachmentsTrigger as Trigger,
} from "./attachments";
