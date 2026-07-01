import type { UIMessage } from "ai";

export type AppUIMessage = UIMessage<{
  stopped?: boolean;
}>;
