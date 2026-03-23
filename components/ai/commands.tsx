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
    className={cn("flex flex-col py-2", className)}
    {...props}
  />
);

// ---------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------

type CommandsGroupProps = ComponentProps<"div">;

const CommandsGroup = (props: CommandsGroupProps) => <div {...props} />;

// ---------------------------------------------------------------------------
// GroupLabel
// ---------------------------------------------------------------------------

type CommandsGroupLabelProps = ComponentProps<"div">;

const CommandsGroupLabel = ({ className, ...props }: CommandsGroupLabelProps) => (
  <div
    className={cn(
      "px-3 py-1 text-2xs font-medium text-slate-10 uppercase tracking-wider",
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
  selected?: boolean;
};

const CommandsItem = ({
  icon: Icon,
  selected,
  className,
  children,
  ...props
}: CommandsItemProps) => (
  <button
    type="button"
    data-selected={selected || undefined}
    className={cn(
      "flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-slate-12 transition-colors cursor-pointer data-selected:bg-slate-4 hover:bg-slate-4",
      className,
    )}
    {...props}
  >
    {Icon && <Icon className="size-4 text-slate-10 shrink-0" />}
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// ItemLabel
// ---------------------------------------------------------------------------

type CommandsItemLabelProps = ComponentProps<"span">;

const CommandsItemLabel = ({ className, ...props }: CommandsItemLabelProps) => (
  <span className={cn("flex-1 text-left", className)} {...props} />
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
    className={cn("text-xs text-slate-10 truncate max-w-[200px]", className)}
    {...props}
  />
);

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

type CommandsFilterProps = ComponentProps<"input"> & {
  trigger?: string;
};

const CommandsFilter = ({
  trigger = "/",
  className,
  placeholder = "Type to filter",
  ...props
}: CommandsFilterProps) => (
  <div className={cn("flex items-center gap-1 px-3 py-1.5", className)}>
    <span className="text-sm text-slate-10 select-none">{trigger}</span>
    <input
      type="text"
      className="flex-1 bg-transparent text-sm text-slate-12 placeholder:text-slate-10 outline-none"
      placeholder={placeholder}
      {...props}
    />
  </div>
);

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

type CommandsFooterProps = ComponentProps<"div">;

const CommandsFooter = ({ className, ...props }: CommandsFooterProps) => (
  <div
    className={cn(
      "border-t border-slate-6 mt-1 pt-1 px-3 flex items-center gap-3 text-2xs text-slate-10",
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
  Filter: CommandsFilter,
  Footer: CommandsFooter,
});
