"use client";

import { Composer, type ComposerSubmitData } from "@/components/ai/composer";

// A self-contained composer: every bare <Composer> owns an isolated store.
export const ComposerBasic = () => {
  const handleSubmit = (_data: ComposerSubmitData) => {};

  return (
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
  );
};
