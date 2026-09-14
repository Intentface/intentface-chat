// Public surface of @intentface/chat/nav: the `Nav` namespace plus the store and
// persistence building blocks. No "use client" directive here — see
// index.parts.ts.

export * as Nav from "./index.parts";
export type {
  NavActionProps,
  NavGroupProps,
  NavGroupState,
  NavGuide,
  NavIconProps,
  NavItemProps,
  NavItemState,
  NavLabelProps,
  NavListProps,
  NavListState,
  NavPartState,
  NavRootProps,
  NavTriggerProps,
  NavTriggerState,
} from "./nav";
export type { NavState, NavStore } from "./store";
export { useNav, useNavStore } from "./store";
