// Part names for the `Shell` namespace. Deliberately carries no "use client"
// directive: this module and index.ts must stay server-resolvable so a React
// Server Component can reach Shell.Root and its siblings through them. Each
// part module carries the directive itself.
export {
  ShellPeekZone as PeekZone,
  ShellResizeHandle as ResizeHandle,
  ShellRoot as Root,
  ShellSidebar as Sidebar,
  ShellTrigger as Trigger,
  ShellViewport as Viewport,
} from "./shell";
/** Create a standalone store handle: `<Shell.Root store={…}>` plus `useShellStore(store, selector)` for reading it from outside the tree. */
export { createShellStore as createStore } from "./store";
