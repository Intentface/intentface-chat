"use client";

import { type CommandItemData, Composer, type ComposerSubmitData } from "@/components/ai/composer";

const MENTIONS: CommandItemData[] = [
  { value: "readme", label: "README.md", description: "Project overview" },
  { value: "package", label: "package.json", description: "Dependencies and scripts" },
  { value: "composer", label: "composer.tsx", description: "The composer primitive" },
];

// Demonstrates the `@` mention command list. Type "@" in the field to trigger it.
// The Panel's children is a callback that receives composer state, so the command
// list shows only while a prefix is active.
export const ComposerCommands = () => {
  const handleSubmit = (_data: ComposerSubmitData) => {};

  return (
    // Reserve height and bottom-anchor the composer so opening the command list
    // grows it upward into the reserved space instead of shifting the layout.
    <div className="flex min-h-[300px] w-full max-w-xl flex-col justify-end">
      <Composer
        onSubmit={handleSubmit}
        commands={{
          "@": { kind: "insert", trigger: "after-whitespace", items: MENTIONS },
        }}
      >
        <Composer.Panel>
          {(composer) =>
            composer.commands.active ? (
              <Composer.CommandList prefix="@">
                <Composer.CommandEmpty />
                <Composer.CommandItems>
                  {(item) => (
                    <Composer.CommandItem value={item.value}>
                      <Composer.CommandItemLabel>{item.label}</Composer.CommandItemLabel>
                      {item.description && (
                        <Composer.CommandItemDescription>
                          {item.description}
                        </Composer.CommandItemDescription>
                      )}
                    </Composer.CommandItem>
                  )}
                </Composer.CommandItems>
              </Composer.CommandList>
            ) : null
          }
        </Composer.Panel>
        <Composer.Container>
          <Composer.Textarea>
            <Composer.Placeholder placeholder="Type @ to mention a file..." />
          </Composer.Textarea>
          <Composer.Actions>
            <Composer.Submit />
          </Composer.Actions>
        </Composer.Container>
      </Composer>
    </div>
  );
};
