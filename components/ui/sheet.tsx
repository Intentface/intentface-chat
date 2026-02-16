"use client";

import { DrawerPreview as Drawer } from "@base-ui/react/drawer";
import type * as React from "react";

import { cn } from "@/lib/utils";

type Side = "top" | "right" | "bottom" | "left";

const swipeDirectionMap: Record<Side, "up" | "right" | "down" | "left"> = {
  top: "up",
  right: "right",
  bottom: "down",
  left: "left",
};

const Sheet = ({
  side = "right",
  ...props
}: Drawer.Root.Props & { side?: Side }) => {
  return <Drawer.Root swipeDirection={swipeDirectionMap[side]} {...props} />;
};

const SheetContent = ({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof Drawer.Popup> & {
  side?: Side;
}) => {
  return (
    <Drawer.Portal>
      <Drawer.Backdrop className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-50 bg-black/50" />
      <Drawer.Popup
        className={cn(
          "bg-background fixed z-50 flex flex-col gap-4 shadow-lg transition-transform duration-200 ease-in-out",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm data-closed:translate-x-full",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm data-closed:-translate-x-full",
          side === "top" &&
            "inset-x-0 top-0 border-b data-closed:-translate-y-full",
          side === "bottom" &&
            "inset-x-0 bottom-0 border-t data-closed:translate-y-full",
          className,
        )}
        {...props}
      >
        {children}
      </Drawer.Popup>
    </Drawer.Portal>
  );
};

const SheetHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="sheet-header"
    className={cn("flex flex-col gap-1.5 p-4", className)}
    {...props}
  />
);

const SheetTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof Drawer.Title>) => (
  <Drawer.Title
    data-slot="sheet-title"
    className={cn("text-foreground font-semibold text-base", className)}
    {...props}
  />
);

const SheetDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof Drawer.Description>) => (
  <Drawer.Description
    data-slot="sheet-description"
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
);

export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription };
