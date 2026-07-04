"use client";

import { Composer, type ComposerSubmitData } from "@/components/ai/composer";
import { PaperClipIcon } from "@/components/icons/paperclip";

// Attachments sits inside the container, above the input: it renders the file
// strip and drop zone. The trigger opens the file dialog; files can also be
// dropped onto the composer.
export const ComposerAttachments = () => {
  const handleSubmit = (_data: ComposerSubmitData) => {};

  return (
    // Reserve height and bottom-anchor so the drop zone / file strip appearing
    // grows the composer upward instead of shifting the layout.
    <div className="flex min-h-[220px] w-full max-w-xl flex-col justify-end">
      <Composer onSubmit={handleSubmit}>
        <Composer.Container>
          <Composer.Attachments />
          <Composer.Textarea>
            <Composer.Placeholder placeholder="Attach a file, or drag one in..." />
          </Composer.Textarea>
          <Composer.Actions>
            <Composer.AttachmentTrigger>
              <PaperClipIcon />
            </Composer.AttachmentTrigger>
            <Composer.Submit />
          </Composer.Actions>
        </Composer.Container>
      </Composer>
    </div>
  );
};
