"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

const getScrollParent = (element: HTMLElement): HTMLElement | null => {
  let parent = element.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") return parent;
    parent = parent.parentElement;
  }
  return null;
};

type DynamicSpacerProps = {
  /** Explicit ref to the element to keep at the top. Defaults to the last user message. */
  targetRef?: RefObject<HTMLElement | null>;
  /** Offset from the top of the visible area in px. Defaults to 0. */
  topOffset?: number;
  /** Minimum spacer height in px. Defaults to 0. */
  minHeight?: number;
};

const DynamicSpacer = ({
  targetRef,
  topOffset,
  minHeight,
}: DynamicSpacerProps) => {
  const spacerRef = useRef<HTMLDivElement>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);
  const prevUserMessageCountRef = useRef(0);
  const pendingScrollRef = useRef<number | null>(null);

  const calculateHeight = useCallback(() => {
    if (!spacerRef.current) return;

    if (!scrollParentRef.current) {
      scrollParentRef.current = getScrollParent(spacerRef.current);
    }
    const scrollContainer = scrollParentRef.current;
    if (!scrollContainer) return;

    const userMessages = scrollContainer.querySelectorAll<HTMLElement>(
      '[data-slot="message"][data-role="user"]',
    );
    const target =
      targetRef?.current ?? userMessages[userMessages.length - 1] ?? null;
    if (!target) return;

    // Thread root container height minus the top overlay height
    const threadRoot = scrollContainer.closest<HTMLElement>(
      '[data-slot="thread-root"]',
    );
    const rootHeight = threadRoot?.clientHeight ?? scrollContainer.clientHeight;
    const remSize = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    const rootStyles = threadRoot ? getComputedStyle(threadRoot) : null;
    const topOverlayHeight = rootStyles
      ? Number.parseFloat(
          rootStyles.getPropertyValue("--thread-overlay-top-height"),
        ) * remSize
      : 0;
    const bottomOverlayHeight = rootStyles
      ? Number.parseFloat(
          rootStyles.getPropertyValue("--thread-overlay-bottom-height"),
        ) * remSize
      : 0;

    const effectiveTopOffset = topOffset ?? topOverlayHeight;
    const effectiveMinHeight = minHeight ?? 0;

    // Measure actual content height: sum heights of siblings from target to spacer
    const parent = spacerRef.current.parentElement;
    let contentHeight = 0;
    if (parent) {
      const children = Array.from(parent.children) as HTMLElement[];
      const spacerIndex = children.indexOf(spacerRef.current);
      // Find the target or its closest ancestor that is a direct child of parent
      const targetChild =
        children.find((child) => child.contains(target)) ?? target;
      const targetIndex = children.indexOf(targetChild);
      const gap = Number.parseFloat(getComputedStyle(parent).gap) || 0;

      if (targetIndex >= 0 && spacerIndex > targetIndex) {
        for (let i = targetIndex; i < spacerIndex; i++) {
          contentHeight += children[i].offsetHeight;
          if (gap && i > targetIndex) contentHeight += gap;
        }
      }
    }

    const calculatedHeight =
      rootHeight - effectiveTopOffset - bottomOverlayHeight - contentHeight;

    spacerRef.current.style.height = `${Math.max(effectiveMinHeight, calculatedHeight)}px`;

    // Re-read positions after spacer height is set
    const containerRect = scrollContainer.getBoundingClientRect();
    const updatedTargetRect = target.getBoundingClientRect();
    const targetAbsoluteTop =
      scrollContainer.scrollTop + (updatedTargetRect.top - containerRect.top);
    if (userMessages.length > prevUserMessageCountRef.current) {
      if (calculatedHeight <= 0) {
        // Content taller than viewport — scroll to bottom
        pendingScrollRef.current = scrollContainer.scrollHeight;
      } else {
        // Content fits — scroll target to just below the top overlay
        pendingScrollRef.current = Math.max(
          0,
          targetAbsoluteTop - effectiveTopOffset,
        );
      }
    }
    prevUserMessageCountRef.current = userMessages.length;
  }, [targetRef, topOffset, minHeight]);

  // Set spacer height synchronously before paint
  useLayoutEffect(() => {
    calculateHeight();
  });

  // Smooth-scroll to user message after paint
  useEffect(() => {
    if (pendingScrollRef.current !== null && scrollParentRef.current) {
      scrollParentRef.current.scrollTo({
        top: pendingScrollRef.current,
        behavior: "smooth",
      });
      pendingScrollRef.current = null;
    }
  });

  useEffect(() => {
    window.addEventListener("resize", calculateHeight);
    return () => window.removeEventListener("resize", calculateHeight);
  }, [calculateHeight]);

  return (
    <div
      ref={spacerRef}
      data-slot="thread-spacer"
      className="w-full shrink-0 ease-out"
      style={{ overflowAnchor: "none" }}
    />
  );
};

export { DynamicSpacer };
export type { DynamicSpacerProps };
