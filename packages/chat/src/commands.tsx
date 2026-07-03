"use client";

// Headless command-list structure. Pure markup with data-slot hooks — the
// selection/keyboard behavior lives in the composer's command plumbing, and
// all styling (including item icons) belongs to the styled layer.

import type { ComponentProps } from "react";

type CommandsRootProps = ComponentProps<"div">;

const CommandsRoot = (props: CommandsRootProps) => <div data-slot="command-list" {...props} />;

type CommandsGroupProps = ComponentProps<"div">;

const CommandsGroup = (props: CommandsGroupProps) => <div data-slot="command-group" {...props} />;

type CommandsGroupLabelProps = ComponentProps<"div">;

const CommandsGroupLabel = (props: CommandsGroupLabelProps) => (
  <div data-slot="command-group-label" {...props} />
);

export type CommandsItemProps = ComponentProps<"button"> & {
  highlighted?: boolean;
};

const CommandsItem = ({ highlighted, ...props }: CommandsItemProps) => (
  <button
    type="button"
    data-slot="command-item"
    data-highlighted={highlighted || undefined}
    {...props}
  />
);

type CommandsItemLabelProps = ComponentProps<"span">;

const CommandsItemLabel = (props: CommandsItemLabelProps) => (
  <span data-slot="command-item-label" {...props} />
);

type CommandsItemDescriptionProps = ComponentProps<"span">;

const CommandsItemDescription = (props: CommandsItemDescriptionProps) => (
  <span data-slot="command-item-description" {...props} />
);

type CommandsEmptyProps = ComponentProps<"div">;

const CommandsEmpty = ({ children, ...props }: CommandsEmptyProps) => (
  <div data-slot="command-empty" {...props}>
    {children ?? "No results"}
  </div>
);

type CommandsFooterProps = ComponentProps<"div">;

const CommandsFooter = (props: CommandsFooterProps) => (
  <div data-slot="command-footer" {...props} />
);

export const Commands = Object.assign(CommandsRoot, {
  Group: CommandsGroup,
  GroupLabel: CommandsGroupLabel,
  Item: CommandsItem,
  ItemLabel: CommandsItemLabel,
  ItemDescription: CommandsItemDescription,
  Empty: CommandsEmpty,
  Footer: CommandsFooter,
});
