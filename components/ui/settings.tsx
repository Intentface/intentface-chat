import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const SettingsRoot = ({ className, children, ...props }: ComponentProps<"section">) => (
  <section data-slot="settings" className={cn("flex flex-col gap-2", className)} {...props}>
    {children}
  </section>
);

const SettingsHeader = ({ className, children, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="settings-header"
    className={cn("flex flex-col gap-0.5 px-2.5", className)}
    {...props}
  >
    {children}
  </div>
);

const SettingsTitle = ({ className, children, ...props }: ComponentProps<"h2">) => (
  <h2
    data-slot="settings-title"
    className={cn("text-md font-medium text-ink-primary", className)}
    {...props}
  >
    {children}
  </h2>
);

const SettingsSubtitle = ({ className, children, ...props }: ComponentProps<"p">) => (
  <p
    data-slot="settings-subtitle"
    className={cn("text-sm text-ink-secondary", className)}
    {...props}
  >
    {children}
  </p>
);

const SettingsCard = ({ className, children, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="settings-card"
    className={cn("flex flex-col rounded-lg border border-primary-border bg-primary", className)}
    {...props}
  >
    {children}
  </div>
);

const SettingsRow = ({ className, children, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="settings-row"
    className={cn(
      "flex min-h-14 items-center gap-3 border-b border-primary-border p-3 last-of-type:border-0",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

const SettingsLabel = ({ className, children, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="settings-label"
    className={cn("text-sm text-ink-primary font-[450]", className)}
    {...props}
  >
    {children}
  </span>
);

const SettingsDescription = ({ className, children, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="settings-description"
    className={cn("text-xs text-ink-secondary", className)}
    {...props}
  >
    {children}
  </span>
);

const SettingsLabelGroup = ({ className, children, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="settings-label-group"
    className={cn("flex flex-1 flex-col gap-0.5", className)}
    {...props}
  >
    {children}
  </div>
);

const SettingsControl = ({ className, children, ...props }: ComponentProps<"div">) => (
  <div data-slot="settings-control" className={cn("flex w-60 justify-end", className)} {...props}>
    {children}
  </div>
);

export const Settings = Object.assign(SettingsRoot, {
  Header: SettingsHeader,
  Title: SettingsTitle,
  Subtitle: SettingsSubtitle,
  Card: SettingsCard,
  Row: SettingsRow,
  LabelGroup: SettingsLabelGroup,
  Label: SettingsLabel,
  Description: SettingsDescription,
  Control: SettingsControl,
});
