import type { ComponentProps } from "react";

import type { CustomSeeds } from "@/lib/interface-theme";
import { cn } from "@/lib/utils";

type PresetSwatchProps = {
  seeds: CustomSeeds;
} & ComponentProps<"div">;

export const PresetSwatch = ({ seeds, className, style, ...props }: PresetSwatchProps) => (
  <div
    className={cn(
      "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] font-[550] text-[9px] leading-none shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)]",
      className,
    )}
    style={{ background: seeds.bg, color: seeds.acc, ...style }}
    aria-hidden="true"
    {...props}
  >
    Aa
  </div>
);
