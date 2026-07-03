"use client";

import { useState } from "react";
import { Composer, type ComposerSubmitData } from "@/components/ai/composer";

// A self-contained composer: its own store instance via Composer.Provider, no
// app-global state, and an in-memory echo instead of a real chat transport.
export const ComposerBasic = () => {
  const [sent, setSent] = useState<string[]>([]);

  const handleSubmit = (data: ComposerSubmitData) => {
    if (data.kind !== "message" || !data.text.trim()) return;
    setSent((current) => [...current, data.text]);
  };

  return (
    <Composer.Provider>
      <div className="flex w-full max-w-xl flex-col gap-3">
        {sent.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {sent.map((message, index) => (
              <li
                key={`${message}-${index}`}
                className="self-end rounded-2xl bg-primary px-3 py-1.5 text-ink-primary text-sm"
              >
                {message}
              </li>
            ))}
          </ul>
        )}
        <Composer onSubmit={handleSubmit}>
          <Composer.Container>
            <Composer.Textarea>
              <Composer.Placeholder placeholder="Send a message..." />
            </Composer.Textarea>
            <Composer.Actions>
              <Composer.Submit />
            </Composer.Actions>
          </Composer.Container>
        </Composer>
      </div>
    </Composer.Provider>
  );
};
