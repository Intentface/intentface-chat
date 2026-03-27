"use client";

import type React from "react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

type CommandsRootProps = ComponentProps<"div">;

const CommandsRoot = ({ className, ...props }: CommandsRootProps) => (
  <div
    data-slot="command-list"
    className={cn("flex flex-col p-1", className)}
    {...props}
  />
);

// ---------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------

type CommandsGroupProps = ComponentProps<"div">;

const CommandsGroup = ({ className, ...props }: CommandsGroupProps) => (
  <div
    data-slot="command-group"
    className={cn("flex flex-col", className)}
    {...props}
  />
);

// ---------------------------------------------------------------------------
// GroupLabel
// ---------------------------------------------------------------------------

type CommandsGroupLabelProps = ComponentProps<"div">;

const CommandsGroupLabel = ({
  className,
  ...props
}: CommandsGroupLabelProps) => (
  <div
    data-slot="command-group-label"
    className={cn(
      "px-3 py-1 text-2xs font-medium text-ink-tertiary uppercase tracking-wider",
      className,
    )}
    {...props}
  />
);

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

type CommandsItemProps = ComponentProps<"button"> & {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  highlighted?: boolean;
};

const CommandsItem = ({
  icon: Icon,
  highlighted,
  className,
  children,
  ...props
}: CommandsItemProps) => (
  <button
    type="button"
    data-slot="command-item"
    data-highlighted={highlighted || undefined}
    className={cn(
      "flex w-full items-center rounded-lg gap-2.5 px-3 h-8 text-sm text-ink-primary cursor-pointer data-highlighted:bg-primary-hover",
      className,
    )}
    {...props}
  >
    {Icon && <Icon className="size-4 text-ink-tertiary shrink-0" />}
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// ItemLabel
// ---------------------------------------------------------------------------

type CommandsItemLabelProps = ComponentProps<"span">;

const CommandsItemLabel = ({ className, ...props }: CommandsItemLabelProps) => (
  <span className={cn("text-sm", className)} {...props} />
);

// ---------------------------------------------------------------------------
// ItemDescription
// ---------------------------------------------------------------------------

type CommandsItemDescriptionProps = ComponentProps<"span">;

const CommandsItemDescription = ({
  className,
  ...props
}: CommandsItemDescriptionProps) => (
  <span
    className={cn("text-xs text-ink-tertiary truncate", className)}
    {...props}
  />
);

// ---------------------------------------------------------------------------
// Empty
// ---------------------------------------------------------------------------

type CommandsEmptyProps = ComponentProps<"div">;

const CommandsEmpty = ({
  className,
  children,
  ...props
}: CommandsEmptyProps) => (
  <div
    data-slot="command-empty"
    className={cn(
      "flex items-center px-3 h-8 text-sm text-ink-tertiary",
      className,
    )}
    {...props}
  >
    {children ?? "No results"}
  </div>
);

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

type CommandsFooterProps = ComponentProps<"div">;

const CommandsFooter = ({ className, ...props }: CommandsFooterProps) => (
  <div
    className={cn(
      "border-t border-slate-6 pt-1 px-3 flex items-center gap-3 text-2xs text-ink-tertiary",
      className,
    )}
    {...props}
  />
);

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Commands = Object.assign(CommandsRoot, {
  Group: CommandsGroup,
  GroupLabel: CommandsGroupLabel,
  Item: CommandsItem,
  ItemLabel: CommandsItemLabel,
  ItemDescription: CommandsItemDescription,
  Empty: CommandsEmpty,
  Footer: CommandsFooter,
});
