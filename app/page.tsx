"use client";

import { useChat } from "@ai-sdk/react";
import { useForm } from "@tanstack/react-form";
import { motion } from "motion/react";
import { z } from "zod";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai/conversation";
import { Messages } from "@/components/ai/messages";
import { PromptInput } from "@/components/ai/prompt-input";
import { Header } from "@/components/header";
import Button from "@/components/ui/button";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";

const messageSchema = z.string().min(1, "Message cannot be empty").trim();

export default function Home() {
  const { messages, sendMessage, status } = useChat();
  const isEmpty = messages.length === 0;

  const form = useForm({
    defaultValues: {
      message: "",
    },
    onSubmit: async ({ value }) => {
      const validated = messageSchema.safeParse(value.message);
      if (!validated.success) return;

      // Clear input immediately for better UX
      form.reset();

      await sendMessage({
        text: validated.data,
      });
    },
  });

  return (
    <div className="relative h-dvh w-full">
      <Header />

      <Conversation>
        <ConversationContent>
          <Messages messages={messages} status={status} />
        </ConversationContent>
      </Conversation>

      <div className="fixed bottom-0 inset-x-0 z-10 w-(--conversation-width) mx-auto">
        <ProgressiveBlur
          direction="bottom"
          className="absolute inset-x-0 bottom-0 h-16 -z-10 bg-linear-to-t from-background to-transparent pointer-events-none"
        />
        <div className="flex justify-center px-4 pb-4 ">
          <motion.form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
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
                      placeholder={[
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
                      ]}
                    />
                  </PromptInput.Textarea>
                  <PromptInput.Footer>
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={!field.state.value.trim()}
                    >
                      Send
                    </Button>
                  </PromptInput.Footer>
                </PromptInput>
              )}
            </form.Field>
          </motion.form>
        </div>
      </div>
    </div>
  );
}
