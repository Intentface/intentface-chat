"use client";

// Minimal internal disclosure primitive — replaces the @base-ui/react
// Collapsible dependency for the package's own parts. Trigger toggles, Panel
// hides (or unmounts) its content; state is exposed Base UI-style via
// presence attributes (data-open / data-closed) generated from state, plus
// the animation contract: data-starting-style on the panel's first open
// frame, data-ending-style while its exit animations run (hide/unmount waits
// for them), and the panel's natural height as --collapsible-panel-height.
// Every part supports the Base UI render prop.

import {
  type CSSProperties,
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import type { PrimitiveProps } from "./primitive-props";
import type { StateAttributesMapping } from "./render/getStateAttributesProps";
import { useRenderElement } from "./render/useRenderElement";
import { openStateMapping } from "./state-mappings";

// SSR-safe layout effect — same shape as composer/internals.tsx; inlined so
// the internal primitive stays self-contained.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type CollapsibleState = {
  open: boolean;
};

type CollapsibleContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  panelId: string;
};

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

const useCollapsible = () => {
  const ctx = use(CollapsibleContext);
  if (!ctx) throw new Error("Collapsible parts must be used within <Collapsible>");
  return ctx;
};

export type CollapsibleRootProps = PrimitiveProps<"div", CollapsibleState> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const CollapsibleRoot = ({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className,
  render,
  style,
  ...elementProps
}: CollapsibleRootProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const panelId = useId();

  const setOpen = useCallback(
    (value: boolean) => {
      if (!isControlled) setInternalOpen(value);
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange],
  );

  const element = useRenderElement(
    "div",
    { className, render, style },
    {
      state: { open },
      stateAttributesMapping: openStateMapping,
      props: elementProps,
    },
  );

  return <CollapsibleContext value={{ open, setOpen, panelId }}>{element}</CollapsibleContext>;
};

export type CollapsibleTriggerProps = PrimitiveProps<"button", CollapsibleState>;

const CollapsibleTrigger = ({
  className,
  render,
  style,
  ...elementProps
}: CollapsibleTriggerProps) => {
  const { open, setOpen, panelId } = useCollapsible();

  return useRenderElement(
    "button",
    { className, render, style },
    {
      state: { open },
      stateAttributesMapping: openStateMapping,
      props: [
        {
          "aria-expanded": open,
          "aria-controls": panelId,
          // mergeProps runs the consumer's onClick first (rightmost wins), so
          // preventDefault there still cancels the toggle — same contract as
          // the previous inline `if (!event.defaultPrevented)` handler.
          onClick: (event: React.MouseEvent) => {
            if (!event.defaultPrevented) setOpen(!open);
          },
        },
        elementProps,
      ],
    },
  );
};

export type CollapsiblePanelProps = PrimitiveProps<"div", CollapsiblePanelState> & {
  /** Keep the panel in the DOM (hidden) when closed. */
  keepMounted?: boolean;
};

// Panel transition status: "starting" holds data-starting-style for the first
// open frame; "ending" holds data-ending-style until exit animations finish.
// Initial mount renders settled (no animate-on-mount for defaultOpen panels).
type PanelStatus = "closed" | "starting" | "open" | "ending";

export type CollapsiblePanelState = CollapsibleState & {
  transitionStatus: PanelStatus;
};

const panelStateMapping: StateAttributesMapping<CollapsiblePanelState> = {
  ...openStateMapping,
  transitionStatus: (value): Record<string, string> | null => {
    if (value === "starting") return { "data-starting-style": "" };
    if (value === "ending") return { "data-ending-style": "" };
    return null;
  },
};

const CollapsiblePanel = ({
  keepMounted = false,
  className,
  render,
  style,
  ...elementProps
}: CollapsiblePanelProps) => {
  const { open, panelId } = useCollapsible();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<PanelStatus>(open ? "open" : "closed");
  const [panelHeight, setPanelHeight] = useState<number | null>(null);

  // Enter/exit is driven by `open` flips, detected during render (previous-
  // value pattern) so the transitional frame renders its data attribute.
  const previousOpenRef = useRef(open);
  if (previousOpenRef.current !== open) {
    previousOpenRef.current = open;
    setStatus(open ? "starting" : "ending");
  }

  // Starting frame: measure the natural height for --collapsible-panel-height,
  // then drop data-starting-style on the next frame so CSS transitions run
  // from the starting style to the settled one.
  useIsomorphicLayoutEffect(() => {
    if (status !== "starting") return;
    const panel = panelRef.current;
    if (panel) setPanelHeight(panel.scrollHeight);
    const frame = requestAnimationFrame(() => {
      setStatus((current) => (current === "starting" ? "open" : current));
    });
    return () => cancelAnimationFrame(frame);
  }, [status]);

  // Ending: re-measure (content may have grown while open), let the ending
  // styles paint, then wait for the panel's animations before closing. With
  // no animations running, this closes on the next frame — same as before.
  useIsomorphicLayoutEffect(() => {
    if (status !== "ending") return;
    const panel = panelRef.current;
    if (!panel) {
      setStatus("closed");
      return;
    }
    setPanelHeight(panel.scrollHeight);
    let cancelled = false;
    const close = () => {
      if (cancelled) return;
      // flushSync so the browser can't paint a settled frame between the exit
      // animation finishing and React committing the hidden state (Base UI #979).
      flushSync(() => {
        setStatus((current) => (current === "ending" ? "closed" : current));
      });
    };
    const frame = requestAnimationFrame(() => {
      // Panel's own animations only — a subtree query would also wait on
      // infinite child animations (spinners) and never close.
      const animations = panel.getAnimations();
      if (animations.length === 0) {
        close();
        return;
      }
      Promise.allSettled(animations.map((animation) => animation.finished)).then(close);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [status]);

  const isHidden = !open && status === "closed";

  return useRenderElement(
    "div",
    { className, render, style },
    {
      enabled: !(isHidden && !keepMounted),
      state: { open, transitionStatus: status },
      stateAttributesMapping: panelStateMapping,
      ref: panelRef,
      props: [
        {
          id: panelId,
          hidden: isHidden,
          style:
            panelHeight !== null
              ? ({ "--collapsible-panel-height": `${panelHeight}px` } as CSSProperties)
              : undefined,
        },
        elementProps,
      ],
    },
  );
};

export const Collapsible = Object.assign(CollapsibleRoot, {
  Trigger: CollapsibleTrigger,
  Panel: CollapsiblePanel,
});
