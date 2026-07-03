"use client";

import { Commands as CommandsPrimitive } from "@intentface/chat/commands";
import type React from "react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const CommandsRoot = ({ className, ...props }: ComponentProps<typeof CommandsPrimitive>) => (
  <CommandsPrimitive className={cn("flex flex-col p-1", className)} {...props} />
);

const CommandsGroup = ({ className, ...props }: ComponentProps<typeof CommandsPrimitive.Group>) => (
  <CommandsPrimitive.Group className={cn("flex flex-col", className)} {...props} />
);

const CommandsGroupLabel = ({
  className,
  ...props
}: ComponentProps<typeof CommandsPrimitive.GroupLabel>) => (
  <CommandsPrimitive.GroupLabel
    className={cn(
      "px-3 py-1 text-2xs font-medium text-ink-tertiary uppercase tracking-wider",
      className,
    )}
    {...props}
  />
);

type CommandsItemProps = ComponentProps<typeof CommandsPrimitive.Item> & {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const CommandsItem = ({ icon: Icon, className, children, ...props }: CommandsItemProps) => (
  <CommandsPrimitive.Item
    className={cn(
      "flex w-full items-center rounded-lg gap-2.5 px-3 h-8 text-sm text-ink-primary cursor-pointer data-highlighted:bg-primary-hover",
      className,
    )}
    {...props}
  >
    {Icon && <Icon className="size-4 text-ink-tertiary shrink-0" />}
    {children}
  </CommandsPrimitive.Item>
);

const CommandsItemLabel = ({
  className,
  ...props
}: ComponentProps<typeof CommandsPrimitive.ItemLabel>) => (
  <CommandsPrimitive.ItemLabel className={cn("text-sm", className)} {...props} />
);

const CommandsItemDescription = ({
  className,
  ...props
}: ComponentProps<typeof CommandsPrimitive.ItemDescription>) => (
  <CommandsPrimitive.ItemDescription
    className={cn("text-xs text-ink-tertiary truncate", className)}
    {...props}
  />
);

const CommandsEmpty = ({ className, ...props }: ComponentProps<typeof CommandsPrimitive.Empty>) => (
  <CommandsPrimitive.Empty
    className={cn("flex items-center px-3 h-8 text-sm text-ink-tertiary", className)}
    {...props}
  />
);

const CommandsFooter = ({
  className,
  ...props
}: ComponentProps<typeof CommandsPrimitive.Footer>) => (
  <CommandsPrimitive.Footer
    className={cn(
      "border-t border-slate-6 pt-1 px-3 flex items-center gap-3 text-2xs text-ink-tertiary",
      className,
    )}
    {...props}
  />
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
