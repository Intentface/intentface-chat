"use client";

import { useForm } from "@tanstack/react-form";
import { motion } from "motion/react";
import { z } from "zod";
import { PromptInput } from "@/components/ai/prompt-input";
import { ArrowUpIcon } from "@/components/icons/arrow-up";
import { PaperClipIcon } from "@/components/icons/paperclip";
import { ModelSelector } from "@/components/model-selector";
import { IconButton } from "@/components/ui/icon-button";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { useModelStore } from "@/lib/store";
import { Conversation } from "./ai/conversation";
import { SendIcon } from "./icons/send";

const messageSchema = z.string().min(1, "Message cannot be empty").trim();

type ChatInputProps = {
  onSendMessage: (text: string) => Promise<void>;
  isEmpty: boolean;
};

export const ChatInput = ({ onSendMessage, isEmpty }: ChatInputProps) => {
  const { model, setModel } = useModelStore();

  const form = useForm({
    defaultValues: {
      message: "",
    },
    onSubmit: async ({ value }) => {
      const validated = messageSchema.safeParse(value.message);
      if (!validated.success) return;

      // Clear input immediately for better UX
      form.reset();

      await onSendMessage(validated.data);
    },
  });

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    form.handleSubmit();
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-10 w-(--conversation-width) mx-auto">
      <ProgressiveBlur
        direction="bottom"
        className="absolute inset-x-0 bottom-0 h-16 -z-10 bg-linear-to-t from-background to-transparent pointer-events-none"
      />
      <Conversation.ScrollButton />
      <div className="flex justify-center px-4 pb-4">
        <motion.form
          onSubmit={handleSubmit}
          className="w-full"
          initial={{ y: "calc(-50vh + 50%)" }}
          animate={{
            y: isEmpty ? "calc(-50vh + 50%)" : 0,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
          }}
        >
          <form.Field name="message">
            {(field) => (
              <PromptInput>
                <PromptInput.Textarea
                  value={field.state.value}
                  onValueChange={(value) => field.handleChange(value)}
                >
                  <PromptInput.Placeholder
                    placeholder={
                      isEmpty
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
                <PromptInput.Footer className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <IconButton variant="ghost">
                      <PaperClipIcon />
                    </IconButton>
                    <ModelSelector value={model} onValueChange={setModel} />
                  </div>
                  <IconButton
                    variant="outline"
                    disabled={!field.state.value.trim()}
                  >
                    <SendIcon />
                  </IconButton>
                </PromptInput.Footer>
              </PromptInput>
            )}
          </form.Field>
        </motion.form>
      </div>
    </div>
  );
};
