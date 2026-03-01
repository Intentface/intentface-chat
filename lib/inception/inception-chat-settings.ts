export type InceptionChatSettings = {
  /**
   * Control the amount of reasoning.
   * @default "medium"
   */
  reasoningEffort?: "instant" | "low" | "medium" | "high";

  /**
   * Whether to return a best-effort summary of the model's reasoning.
   * @default true
   */
  reasoningSummary?: boolean;

  /**
   * Whether to delay the final response until the reasoning summary is ready.
   * @default false
   */
  reasoningSummaryWait?: boolean;

  /**
   * Enable the diffusion denoising streaming effect.
   * When true, streaming chunks contain the full content being refined
   * rather than incremental deltas.
   * @default false
   */
  diffusing?: boolean;
};
