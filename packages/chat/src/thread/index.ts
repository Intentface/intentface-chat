// Public surface of @intentface/chat/thread. No directive — see index.parts.ts.

export * as Thread from "./index.parts";
export type { ThreadVisibilityState } from "./stores";
export type {
  ThreadAutoScrollMode,
  ThreadComposerProps,
  ThreadContentProps,
  ThreadOverlayProps,
  ThreadOverlayState,
  ThreadPlaceholderProps,
  ThreadRootProps,
  ThreadScrollToMessageOptions,
  ThreadViewportProps,
} from "./thread";
export { useThread, useThreadVisibility } from "./thread";
