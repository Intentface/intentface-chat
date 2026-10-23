"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// The one way the package portals. A portal can't be server-rendered — there is
// no document to portal into — so the first client render must stay empty too,
// or hydration won't match. useSyncExternalStore renders the server snapshot
// (false) while hydrating and re-renders with the client one right after; a
// client-only mount gets true straight away.
const getSnapshot = () => true;
const getServerSnapshot = () => false;
const subscribe = () => () => {};
const useHydrated = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export type PortalProps = {
  children?: ReactNode;
  container?: Element | null;
};

export const Portal = ({ children, container }: PortalProps) => {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return createPortal(children, container ?? document.body);
};
