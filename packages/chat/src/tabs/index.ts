// Public surface of @intentface/chat/tabs: the `Tabs` namespace plus the store. No "use client" directive here — see
// index.parts.ts.

export type {
  TabsAlign,
  TabsPopupProps,
  TabsPopupState,
  TabsPortalProps,
  TabsPositionerProps,
  TabsPositionerState,
  TabsSide,
} from "./anchored";
export * as Tabs from "./index.parts";
export type { TabsDirection, TabsSelectOnClose, TabsState, TabsStore } from "./store";
export { useTabs, useTabsStore } from "./store";
export type {
  TabsActionProps,
  TabsCloseProps,
  TabsIconProps,
  TabsListProps,
  TabsOrientation,
  TabsPartState,
  TabsRootProps,
  TabsTriggerProps,
  TabsTriggerState,
  TabsViewportProps,
  TabsViewportState,
} from "./tabs";
