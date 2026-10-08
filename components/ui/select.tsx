"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown, ChevronsUpDown, ChevronUp } from "@keyline-icons/react";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const selectTriggerVariants = cva(
  [
    // Layout
    "flex w-fit items-center justify-between gap-1.5",
    "whitespace-nowrap",
    // Base styles: fields are rounded squares, not pills
    "rounded-[7px] text-sm text-ink-primary",
    "cursor-pointer select-none",
    "transition-[background-color,box-shadow]",
    // Focus states
    "focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2",
    // Disabled state
    "disabled:cursor-not-allowed disabled:opacity-50",
    // Placeholder styling
    "data-placeholder:text-ink-tertiary",
    // Select value (child) styling
    "*:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center",
    "*:data-[slot=select-value]:gap-1.5 *:data-[slot=select-value]:line-clamp-1",
    // Select icon (child) styling
    "*:data-[slot=select-icon]:pointer-events-none *:data-[slot=select-icon]:shrink-0",
    "*:data-[slot=select-icon]:text-ink-tertiary",
  ],
  {
    variants: {
      variant: {
        primary: "bg-raised shadow-raised hover:bg-raised-hover aria-expanded:bg-raised-hover",
        ghost: "hover:bg-ink-primary/5 aria-expanded:bg-ink-primary/5",
      },
      size: {
        sm: "h-8 pr-2 pl-2.5 text-sm *:data-[slot=select-value]:text-sm *:data-[slot=select-icon]:size-3.5",
        md: "h-9 pr-2 pl-2.5 text-md *:data-[slot=select-value]:text-md *:data-[slot=select-icon]:size-4",
        lg: "h-10 pr-2 pl-2.5 text-lg *:data-[slot=select-value]:text-lg *:data-[slot=select-icon]:size-4.5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

const SelectRoot = SelectPrimitive.Root;

const SelectValue = ({ className, ...props }: SelectPrimitive.Value.Props) => {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn(["flex flex-1 text-left truncate"], className)}
      {...props}
    />
  );
};

function SelectTrigger({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & VariantProps<typeof selectTriggerVariants>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(selectTriggerVariants({ variant, size, className }))}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon data-slot="select-icon" render={<ChevronsUpDown />} />
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            [
              // Layout & positioning
              "relative isolate z-50 min-w-36 origin-(--transform-origin) max-h-(--available-height)",
              // "w-(--anchor-width)",
              // Styling
              "rounded-xl p-1 shadow-overlay",
              "bg-primary-bg text-ink-primary",
              // Overflow
              "overflow-x-hidden overflow-y-auto",
              // Animation base
              "duration-100",
              // Open/close animations
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              // Slide animations by side
              "data-[side=bottom]:slide-in-from-top-2",
              "data-[side=top]:slide-in-from-bottom-2",
              "data-[side=left]:slide-in-from-right-2",
              "data-[side=right]:slide-in-from-left-2",
              "data-[side=inline-start]:slide-in-from-right-2",
              "data-[side=inline-end]:slide-in-from-left-2",
              // Conditional states
              "data-[align-trigger=true]:animate-none",
            ],
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

const SelectGroup = ({ className, ...props }: SelectPrimitive.Group.Props) => {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn(["scroll-my-1 p-1"], className)}
      {...props}
    />
  );
};

const SelectLabel = ({ className, ...props }: SelectPrimitive.GroupLabel.Props) => {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(["px-1.5 py-1 text-xs text-ink-secondary"], className)}
      {...props}
    />
  );
};

const SelectItem = ({ className, children, ...props }: SelectPrimitive.Item.Props) => {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative cursor-pointer select-none outline-hidden h-8 px-2 rounded-lg text-sm flex w-full items-center gap-2",
        // Focus states
        "data-highlighted:bg-ink-primary/5",
        // Disabled states
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        // SVG styling
        "[&_svg:not([class*='size-'])]:size-3",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        // Span (child) styling
        "*:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className={cn(["flex flex-1 shrink-0 gap-1.5 whitespace-nowrap"])}>
        {children}
      </SelectPrimitive.ItemText>

      <div className={cn(["pointer-events-none flex size-4 shrink-0 items-center justify-center"])}>
        <SelectPrimitive.ItemIndicator>
          <Check className="pointer-events-none" />
        </SelectPrimitive.ItemIndicator>
      </div>
    </SelectPrimitive.Item>
  );
};

const SelectSeparator = ({ className, ...props }: SelectPrimitive.Separator.Props) => {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn(["-mx-1 my-1 h-px pointer-events-none bg-ink-primary/6"], className)}
      {...props}
    />
  );
};

const SelectScrollUpButton = ({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) => {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        [
          // Layout & positioning
          "top-0 z-10 flex w-full items-center justify-center",
          "py-1",
          // Styling
          "cursor-default hover:bg-ink-primary/5",
          // SVG sizing
          "[&_svg:not([class*='size-'])]:size-4",
        ],
        className,
      )}
      {...props}
    >
      <ChevronUp />
    </SelectPrimitive.ScrollUpArrow>
  );
};

const SelectScrollDownButton = ({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) => {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        // Layout & positioning
        "bottom-0 z-10 flex w-full items-center justify-center",
        "py-1",
        // Styling
        "cursor-default hover:bg-ink-primary/5",
        // SVG sizing
        "[&_svg:not([class*='size-'])]:size-4",

        className,
      )}
      {...props}
    >
      <ChevronDown />
    </SelectPrimitive.ScrollDownArrow>
  );
};

const Select = Object.assign(SelectRoot, {
  Content: SelectContent,
  Group: SelectGroup,
  Item: SelectItem,
  Label: SelectLabel,
  ScrollDownButton: SelectScrollDownButton,
  ScrollUpButton: SelectScrollUpButton,
  Separator: SelectSeparator,
  Trigger: SelectTrigger,
  Value: SelectValue,
});

export default Select;
