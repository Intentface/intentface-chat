"use client";

// The hand-over rules follow upstream's navigation menu (@base-ui/react, MIT):
// switch at once while the popup is open or still fading out, and redraw hover
// changes immediately so the next tab never meets a stale popup.

import type { PointerEvent } from "react";
import { flushSync } from "react-dom";
import { createChangeEventDetails } from "../internal/change-event-details";
import { createSafePolygon, type Side } from "../internal/safe-polygon";
import type { TabsRootChangeEventReason, TabsStore } from "./store";

/** A tab the mouse is over, with its own timing. */
export type TabsHoverTarget = { value: string; openDelay: number; closeDelay: number };

type HoverStore = Pick<TabsStore, "getSnapshot" | "selectWithDetails">;

const isMouse = (event: PointerEvent) => event.pointerType === "mouse";

const isInside = (elements: Iterable<Element>, target: EventTarget | null) => {
  if (!(target instanceof Node)) return false;
  for (const element of elements) if (element.contains(target)) return true;
  return false;
};

/** The popup's side of the tab, read off where both actually are. */
const sideOf = (tab: DOMRect, popup: DOMRect): Side => {
  if (popup.top >= tab.bottom) return "bottom";
  if (popup.bottom <= tab.top) return "top";
  return popup.left >= tab.right ? "right" : "left";
};

/**
 * Hover for the whole strip, decided in one place. Every `openOnHover` tab and
 * the popup report to it, so moving between tabs hands the popup over instead
 * of closing it and opening it again.
 */
export const createTabsHover = (store: HoverStore) => {
  const tabs = new Set<Element>();
  let popup: HTMLElement | null = null;
  /** The tab hover opened, until anything else changes the selection or a press claims it. */
  let owner: string | null = null;
  let target: TabsHoverTarget | null = null;
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let stopCone = () => {};

  /** No pending open or close, and no cone. */
  const release = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    openTimer = undefined;
    stopCone();
  };

  /** The popup is open or still fading out, so the next tab takes it over at once. */
  const onScreen = () =>
    popup !== null &&
    (!popup.hasAttribute("data-closed") || popup.hasAttribute("data-ending-style"));

  /** Redrawn at once, so a controlled parent is current before the mouse moves again. */
  const change = (value: string | null, event: Event, tab?: Element) =>
    flushSync(() =>
      store.selectWithDetails(value, createChangeEventDetails("trigger-hover", event, tab)),
    );

  const open = (value: string, event: Event, tab: Element) => {
    const { value: current } = store.getSnapshot();
    // Hover never takes over a tab someone opened on purpose.
    if (current === value || (current !== null && owner === null)) return;
    change(value, event, tab);
  };

  const close = (event: Event) => {
    release();
    if (owner !== null) change(null, event);
  };

  const closeAfterDelay = (event: Event) => {
    clearTimeout(closeTimer);
    const delay = target?.closeDelay ?? 0;
    if (delay > 0) closeTimer = setTimeout(() => close(event), delay);
    else close(event);
  };

  const openAfterRest = (event: Event, tab: Element) => {
    if (!target) return;
    const { value, openDelay } = target;
    clearTimeout(openTimer);
    openTimer = setTimeout(() => {
      openTimer = undefined;
      open(value, event, tab);
    }, openDelay);
  };

  /** Keeps the popup open while the mouse travels from the tab towards it. */
  const armCone = (tab: Element, event: MouseEvent) => {
    stopCone();
    if (!popup) return close(event);
    const cone = createSafePolygon({
      x: event.clientX,
      y: event.clientY,
      side: sideOf(tab.getBoundingClientRect(), popup.getBoundingClientRect()),
      reference: tab,
      floating: popup,
      onClose: () => closeAfterDelay(event),
    });
    document.addEventListener("mousemove", cone.onMouseMove);
    stopCone = () => {
      cone.stop();
      document.removeEventListener("mousemove", cone.onMouseMove);
      stopCone = () => {};
    };
  };

  return {
    /** Lets leaving one hover tab for another hand over. Returns the unregister. */
    register: (tab: Element) => {
      tabs.add(tab);
      return () => {
        tabs.delete(tab);
        release();
      };
    },

    /** Drops anything pending, for when the strip unmounts. */
    release,

    setPopup: (element: HTMLElement | null) => {
      popup = element;
    },

    owns: (value: string) => owner === value,

    /** A change landed: hover owns it only if hover made it. */
    changed: (value: string | null, reason: TabsRootChangeEventReason) => {
      owner = reason === "trigger-hover" ? value : null;
      if (reason !== "trigger-hover") release();
    },

    enterTab: (next: TabsHoverTarget, event: PointerEvent) => {
      if (!isMouse(event)) return;
      release();
      target = next;
      if (store.getSnapshot().value === next.value) return;
      // Already open, or still fading out: switch at once rather than waiting to rest.
      if (owner !== null || onScreen()) {
        return open(next.value, event.nativeEvent, event.currentTarget);
      }
      openAfterRest(event.nativeEvent, event.currentTarget);
    },

    /** Moving restarts the wait, so the tab opens once the mouse comes to rest. */
    moveOnTab: (event: PointerEvent) => {
      if (!isMouse(event) || openTimer === undefined) return;
      openAfterRest(event.nativeEvent, event.currentTarget);
    },

    leaveTab: (event: PointerEvent) => {
      if (!isMouse(event)) return;
      release();
      if (owner === null) return;
      // Onto another hover tab, whose arrival hands over, or straight into the popup.
      if (isInside(tabs, event.relatedTarget)) return;
      if (popup && isInside([popup], event.relatedTarget)) return;
      armCone(event.currentTarget, event.nativeEvent);
    },

    enterPopup: (event: PointerEvent) => {
      if (!isMouse(event)) return;
      stopCone();
      clearTimeout(closeTimer);
    },

    leavePopup: (event: PointerEvent) => {
      if (!isMouse(event) || owner === null || isInside(tabs, event.relatedTarget)) return;
      closeAfterDelay(event.nativeEvent);
    },

    /** A press on the tab, or a press or focus inside the popup: it is in use now. */
    claim: () => {
      release();
      owner = null;
    },
  };
};

export type TabsHover = ReturnType<typeof createTabsHover>;
