// Part names for the `Tabs` namespace. Deliberately carries no "use client"
// directive: this module and index.ts must stay server-resolvable so a React
// Server Component can reach Tabs.Root and its siblings through them. Each
// part module carries the directive itself.
export {
  TabsPopup as Popup,
  TabsPortal as Portal,
  TabsPositioner as Positioner,
} from "./anchored";
/** Create a standalone store handle: `<Tabs.Root store={…}>` plus `useTabsStore(store, selector)` for reading it from outside the tree. */
export { createTabsStore as createStore } from "./store";
export {
  TabsAction as Action,
  TabsClose as Close,
  TabsIcon as Icon,
  TabsList as List,
  TabsRoot as Root,
  TabsTrigger as Trigger,
  TabsViewport as Viewport,
} from "./tabs";
