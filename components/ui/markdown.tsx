import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

const Markdown = ({
  className,
  controls,
  ...props
}: ComponentProps<typeof Streamdown>) => (
  <Streamdown
    controls={false}
    className={cn(
      "text-md [&_p]:whitespace-pre-wrap [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
      className,
    )}
    {...props}
  />
);

export { Markdown };
