"use client";

import { type CommandItemData, Composer, type ComposerSubmitData } from "@/components/ai/composer";

const MENTIONS: CommandItemData[] = [
  { value: "readme", label: "README.md", description: "Project overview" },
  { value: "package", label: "package.json", description: "Dependencies and scripts" },
  { value: "composer", label: "composer.tsx", description: "The composer primitive" },
];

// The floating variant. Composer.Popover takes the same content as a Composer.Panel
// (including the state callback) but portals it above the field instead of growing
// it — it opens while the command list is active.
export const ComposerPopover = () => {
  const handleSubmit = (_data: ComposerSubmitData) => {};

  return (
    <Composer
      onSubmit={handleSubmit}
      commands={{
        "@": { kind: "insert", trigger: "after-whitespace", items: MENTIONS },
      }}
    >
      <Composer.Popover>
        {(composer) =>
          composer.commands.active ? (
            <Composer.Command prefix="@">
              <Composer.CommandEmpty />
              <Composer.CommandList>
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
              </Composer.CommandList>
            </Composer.Command>
          ) : null
        }
      </Composer.Popover>
      <Composer.Container>
        <Composer.Textarea>
          <Composer.Placeholder placeholder="Type @ to mention a file..." />
        </Composer.Textarea>
        <Composer.Actions>
          <Composer.Submit />
        </Composer.Actions>
      </Composer.Container>
    </Composer>
  );
};
