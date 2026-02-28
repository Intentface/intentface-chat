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
  /** Offset from the top of the viewport in px. Defaults to 25% of viewport height. */
  topOffset?: number;
  /** Minimum spacer height in px. Defaults to 15% of viewport height. Keeps the spacer from fully collapsing, preventing auto-scroll jumps. */
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

    const containerHeight = scrollContainer.clientHeight;
    const containerRect = scrollContainer.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetAbsoluteTop =
      scrollContainer.scrollTop + (targetRect.top - containerRect.top);

    const totalFromTarget = scrollContainer.scrollHeight - targetAbsoluteTop;
    const currentSpacerHeight = spacerRef.current.offsetHeight;
    const contentWithoutSpacer = totalFromTarget - currentSpacerHeight;

    const effectiveTopOffset = topOffset ?? containerHeight * 0.25;
    const effectiveMinHeight = minHeight ?? containerHeight * 0.15;
    const calculatedHeight =
      containerHeight - effectiveTopOffset - contentWithoutSpacer;

    spacerRef.current.style.height = `${Math.max(effectiveMinHeight, calculatedHeight)}px`;

    // When a new user message appears, schedule smooth scroll
    if (userMessages.length > prevUserMessageCountRef.current) {
      pendingScrollRef.current = Math.max(
        0,
        targetAbsoluteTop - effectiveTopOffset,
      );
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
      className="w-full shrink-0"
      style={{ overflowAnchor: "none" }}
    />
  );
};

export { DynamicSpacer };
export type { DynamicSpacerProps };
