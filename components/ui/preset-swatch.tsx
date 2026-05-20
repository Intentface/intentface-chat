import type { ComponentProps } from "react";

import type { CustomSeeds } from "@/lib/interface-theme";
import { cn } from "@/lib/utils";

type PresetSwatchProps = {
  seeds: CustomSeeds;
} & ComponentProps<"div">;

export const PresetSwatch = ({
  seeds,
  className,
  style,
  ...props
}: PresetSwatchProps) => (
  <div
    className={cn(
      "flex size-6 shrink-0 items-center justify-center rounded-md text-2xs font-[550] leading-none",
      className,
    )}
    style={{ background: seeds.bg, color: seeds.acc, ...style }}
    aria-hidden="true"
    {...props}
  >
    Aa
  </div>
);
