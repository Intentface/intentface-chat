// Public surface of @intentface/chat/shell: the `Shell` namespace plus the store. No "use client" directive here — see
// index.parts.ts.

export * as Shell from "./index.parts";
export type {
  ShellPartState,
  ShellPeekZoneProps,
  ShellResizeHandleProps,
  ShellRootProps,
  ShellSidebarProps,
  ShellSidebarState,
  ShellTriggerProps,
  ShellViewportProps,
} from "./shell";
export { SHELL_SIDEBAR_WIDTH_VAR } from "./shell";
export type { ShellState, ShellStore } from "./store";
export { useShell, useShellStore } from "./store";
