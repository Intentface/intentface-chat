"use client";

// Composer.Attachments (headless) — the hidden file input plus the config
// sync (accept/max/global-drop) onto the store. The visible strip (items,
// dropzone, error) is presentation: the styled layer composes it from
// useComposer((c) => c.attachments) and the Attachments primitives.

import type { ChangeEvent, ReactNode } from "react";
import {
  DEFAULT_ATTACHMENT_ACCEPT,
  DEFAULT_ATTACHMENT_MAX_FILE_SIZE,
  DEFAULT_ATTACHMENT_MAX_FILES,
} from "../attachments";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";
import { useComposer, useComposerContextStore } from "./store";

export type ComposerAttachmentsProps = {
  accept?: string;
  maxFiles?: number;
  maxFileSize?: number;
  multiple?: boolean;
  globalDrop?: boolean;
  children?: ReactNode;
};

export const ComposerAttachments = ({
  accept = DEFAULT_ATTACHMENT_ACCEPT,
  maxFiles = DEFAULT_ATTACHMENT_MAX_FILES,
  maxFileSize = DEFAULT_ATTACHMENT_MAX_FILE_SIZE,
  multiple = true,
  globalDrop = false,
  children,
}: ComposerAttachmentsProps) => {
  const store = useComposerContextStore();
  const attachments = useComposer((composer) => composer.attachments);

  store.attachmentConfigRef.current = { accept, maxFiles, maxFileSize };
  attachments.globalDropRef.current = globalDrop;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.files) {
      attachments.add(event.currentTarget.files);
    }
    event.currentTarget.value = "";
  };

  return (
    <>
      <input
        accept={accept}
        style={{ display: "none" }}
        multiple={multiple}
        onChange={handleFileChange}
        ref={attachments.fileInputRef}
        type="file"
      />
      {children}
    </>
  );
};

export type ComposerAttachmentTriggerProps = PrimitiveProps<"button">;

export const ComposerAttachmentTrigger = ({
  className,
  render,
  style,
  ...elementProps
}: ComposerAttachmentTriggerProps) => {
  const attachments = useComposer((composer) => composer.attachments);

  return useRenderElement(
    "button",
    { className, render, style },
    {
      props: [
        {
          "data-slot": "composer-attachment-trigger",
          onClick: () => attachments.openFileDialog(),
        },
        elementProps,
      ],
    },
  );
};
