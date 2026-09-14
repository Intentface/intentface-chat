// Part names for the `Nav` namespace. Deliberately carries no "use client"
// directive: this module and index.ts must stay server-resolvable so a React
// Server Component can reach Nav.Root and its siblings through them. Each part
// module carries the directive itself.
export {
  NavAction as Action,
  NavGroup as Group,
  NavIcon as Icon,
  NavItem as Item,
  NavLabel as Label,
  NavList as List,
  NavRoot as Root,
  NavTrigger as Trigger,
} from "./nav";
/** Create a standalone store handle: `<Nav.Root store={…}>` plus `useNavStore(store, selector)` for reading it from outside the tree. */
export { createNavStore as createStore } from "./store";
