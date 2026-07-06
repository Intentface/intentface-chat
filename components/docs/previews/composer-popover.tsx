"use client";

import { type CommandItemData, Composer, type ComposerSubmitData } from "@/components/ai/composer";

const MENTIONS: CommandItemData[] = [
  { value: "readme", label: "README.md", description: "Project overview" },
  { value: "package", label: "package.json", description: "Dependencies and scripts" },
  { value: "composer", label: "composer.tsx", description: "The composer primitive" },
];

// The floating variant. Composer.Popover takes the same CommandList children as
// Composer.Panel, but portals them above the field instead of growing it — type
// "@" and the list overlays, anchored to the trigger, without shifting layout.
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
