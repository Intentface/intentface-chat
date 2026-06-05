import type { UIMessage } from "ai";
import type { ChipData } from "@/components/ai/composer";

export type AppUIMessage = UIMessage<
  {
    stopped?: boolean;
  },
  {
    chip: ChipData[];
  }
>;
