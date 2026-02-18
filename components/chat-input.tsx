"use client";

import type { FileUIPart } from "ai";
import { useCallback, useRef, useState } from "react";
import {
  PromptInput,
  type PromptInputHandle,
  usePromptInputAttachments,
} from "@/components/ai/prompt-input";
import { PaperClipIcon } from "@/components/icons/paperclip";
import { ModelSelector } from "@/components/model-selector";
import { IconButton } from "@/components/ui/icon-button";
import { useModelStore } from "@/lib/store/model";

type ChatInputProps = {
  onSendMessage: (payload: {
    text: string;
    files: FileUIPart[];
  }) => Promise<void>;
};

export const ChatInput = ({ onSendMessage }: ChatInputProps) => {
  const { model, setModel } = useModelStore();
  const promptInputRef = useRef<PromptInputHandle>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const attachments = usePromptInputAttachments();

  const handleSubmit = useCallback(
    async (e: React.SubmitEvent<HTMLFormElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (isSending) {
        return;
      }

      const trimmedText = message.trim();
      const hasText = trimmedText.length > 0;
      const hasAttachments = promptInputRef.current?.hasAttachments() ?? false;

      if (!(hasText || hasAttachments)) {
        return;
      }

      setIsSending(true);

      try {
        const submitText = hasText ? trimmedText : "Sent with attachments";
        const files = hasAttachments
          ? await (promptInputRef.current?.prepareAttachments() ??
              Promise.resolve([]))
          : [];

        promptInputRef.current?.clearAttachments();
        setMessage("");
        setHasSubmitted(true);

        await onSendMessage({
          files,
          text: submitText,
        });
      } finally {
        setIsSending(false);
      }
    },
    [isSending, message, onSendMessage],
  );

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <PromptInput ref={promptInputRef}>
        <PromptInput.Attachments />
        <PromptInput.Body>
          <PromptInput.Textarea value={message} onValueChange={setMessage}>
            <PromptInput.Placeholder
              placeholder={
                !hasSubmitted
                  ? [
                      "Ask me anything...",
                      "Recall past conversations...",
                      "Search the web...",
                      "Generate a report...",
                      "Explain a concept...",
                      "Help with a project...",
                      "Give a tutorial...",
                      "Provide a recommendation...",
                      "Translate text...",
                      "Summarize a document...",
                      "Write a story...",
                      "Create a presentation...",
                    ]
                  : "Ask a follow-up question..."
              }
            />
          </PromptInput.Textarea>
        </PromptInput.Body>
        <PromptInput.AttachmentsError />
        <PromptInput.Footer className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <IconButton
              onClick={attachments.openFileDialog}
              type="button"
              variant="ghost"
            >
              <PaperClipIcon />
            </IconButton>

            <ModelSelector value={model} onValueChange={setModel} />
          </div>
          <PromptInput.Submit
            disabled={
              (!message.trim() && attachments.files.length === 0) || isSending
            }
          />
        </PromptInput.Footer>
      </PromptInput>
    </form>
  );
};
