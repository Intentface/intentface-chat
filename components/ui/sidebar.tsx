"use client";

import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import {
  type ComponentProps,
  createContext,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Drawer from "@/components/ui/drawer";
import Input from "@/components/ui/input";
import Separator from "@/components/ui/separator";
import Tooltip from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { IconButton } from "./icon-button";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_KEYBOARD_SHORTCUT = "b";
// Hover-peek: pointer resting in the left-edge strip floats the collapsed
// sidebar out as a card; leaving panel + strip slides it back after a grace.
const SIDEBAR_PEEK_EDGE_WIDTH_PX = 20; // matches w-5 on the peek zone
const SIDEBAR_PEEK_OPEN_DELAY_MS = 200;
const SIDEBAR_PEEK_CLOSE_DELAY_MS = 250;

type SidebarContextType = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
  /** Collapsed sidebar floating over the content as a card (ephemeral, never persisted). */
  peek: boolean;
  setPeek: (peek: boolean) => void;
  // Set on collapse so the panel sliding out from under a parked pointer
  // doesn't bounce straight back as a peek; cleared once the pointer leaves
  // the edge strip.
  peekSuppressionRef: RefObject<boolean>;
};

const SidebarContext = createContext<SidebarContextType | null>(null);

const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
};

const SidebarProvider = ({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = useState(false);

  const [_open, _setOpen] = useState(defaultOpen);
  const open = openProp ?? _open;

  const [peek, _setPeek] = useState(false);
  // Guarded so a stale peek timer can never float an expanded sidebar.
  const setPeek = useCallback((value: boolean) => _setPeek(value && !open), [open]);
  const peekSuppressionRef = useRef(false);

  const setOpen = useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value;
      // Collapsing arms the bounce-back suppression; both directions kill the
      // peek in the same render — that's what makes expand-from-peek a single
      // CSS morph instead of a close-then-open.
      if (!openState) peekSuppressionRef.current = true;
      _setPeek(false);
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }

      // biome-ignore lint/suspicious/noDocumentCookie: The sidebar open state is mirrored for SSR layout defaults.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp, open],
  );

  const toggleSidebar = useCallback(() => {
    if (isMobile) return setOpenMobile((open) => !open);
    // A peeking sidebar expands in place (the trigger inside the peek, Cmd+B).
    if (peek) return setOpen(true);
    setOpen(!open);
  }, [isMobile, peek, open, setOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const state = open ? "expanded" : "collapsed";

  const contextValue = useMemo<SidebarContextType>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      peek,
      setPeek,
      peekSuppressionRef,
    }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar, peek, setPeek],
  );

  // Suppression is armed on every collapse but any movement outside the edge
  // strip clears it — so it only survives when the pointer was parked in the
  // strip at collapse time. Ref write only; no re-render.
  const handleWrapperPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.clientX > SIDEBAR_PEEK_EDGE_WIDTH_PX) peekSuppressionRef.current = false;
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        className={cn("group/sidebar-wrapper flex min-h-svh w-full bg-base", className)}
        data-state={state}
        onPointerMove={handleWrapperPointerMove}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
};

const SidebarRoot = ({
  side = "left",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: ComponentProps<"div"> & {
  side?: "left" | "right";
  collapsible?: "offcanvas" | "icon" | "none";
}) => {
  const { isMobile, state, openMobile, setOpenMobile, peek, setPeek, peekSuppressionRef } =
    useSidebar();

  // Peek choreography timers — set only from pointer handlers, cleared
  // wherever a newer intent supersedes them. Refs, not state: firing is the
  // only render-relevant event.
  const peekOpenTimerRef = useRef<number | undefined>(undefined);
  const peekCloseTimerRef = useRef<number | undefined>(undefined);

  const handlePeekZoneEnter = () => {
    if (peekSuppressionRef.current) return;
    // Re-entering during the close grace keeps the peek up.
    window.clearTimeout(peekCloseTimerRef.current);
    if (!peek) {
      peekOpenTimerRef.current = window.setTimeout(() => setPeek(true), SIDEBAR_PEEK_OPEN_DELAY_MS);
    }
  };

  const handlePeekZoneLeave = () => {
    // First zone exit ends the post-collapse suppression (covers leaving via
    // the window's left edge, where the wrapper's pointermove never clears it).
    peekSuppressionRef.current = false;
    // Darting through the strip never opens.
    window.clearTimeout(peekOpenTimerRef.current);
    if (peek) {
      peekCloseTimerRef.current = window.setTimeout(
        () => setPeek(false),
        SIDEBAR_PEEK_CLOSE_DELAY_MS,
      );
    }
  };

  const handlePanelEnter = () => {
    window.clearTimeout(peekCloseTimerRef.current);
  };

  const handlePanelLeave = () => {
    if (peek) {
      peekCloseTimerRef.current = window.setTimeout(
        () => setPeek(false),
        SIDEBAR_PEEK_CLOSE_DELAY_MS,
      );
    }
  };

  // Cmd-Tab away mid-peek fires no pointerleave — without this the peek sticks
  // open and a pending open timer would fire in a backgrounded window.
  // External subscription, same shape as the provider's Cmd+B listener.
  useEffect(() => {
    const handleWindowBlur = () => {
      window.clearTimeout(peekOpenTimerRef.current);
      window.clearTimeout(peekCloseTimerRef.current);
      setPeek(false);
    };
    window.addEventListener("blur", handleWindowBlur);
    return () => window.removeEventListener("blur", handleWindowBlur);
  }, [setPeek]);

  if (isMobile) {
    return (
      <Drawer side={side} open={openMobile} onOpenChange={setOpenMobile}>
        <Drawer.Content className="w-(--sidebar-width) [&>button]:hidden" side={side}>
          <div className="flex h-full w-full flex-col">{children}</div>
        </Drawer.Content>
      </Drawer>
    );
  }

  return (
    <div
      className="group hidden md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-side={side}
      data-peek={peek ? "" : undefined}
    >
      {/* Layout spacer — reserves the sidebar's width in flow and animates to
          zero on collapse while the fixed panel slides off-canvas. */}
      <div
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-150 ease-linear motion-reduce:transition-none",
          "group-data-[state=collapsed]:w-0",
          "group-data-[side=right]:rotate-180",
        )}
      />
      {/* Three positions on one element, morphed by CSS transitions:
          expanded (left-0 inset-y-0, flat), collapsed (off-canvas), peek
          (left-2 floating). The card geometry (inset-y-2, radius, border) is
          baked into the WHOLE collapsed state — hidden off-canvas it's
          invisible, so the peek slide animates left only: no vertical
          movement, the gap never grows mid-slide. Only expand/collapse morphs
          card ↔ flat. Shadow is peek-only (an off-canvas panel resting at the
          screen edge would bleed its shadow onto the viewport). Border stays
          1px transparent in the flat state so only border-color animates —
          no width jump. The stacked collapsed+peek variant outranks the
          off-canvas left on specificity, not stylesheet order. */}
      <div
        data-slot="sidebar"
        className={cn(
          "fixed z-10 hidden w-(--sidebar-width) border border-transparent bg-base overflow-hidden transition-[left,right,top,bottom,border-color,border-radius,box-shadow] duration-150 ease-linear motion-reduce:transition-none md:flex",
          side === "left"
            ? cn(
                "left-0 inset-y-0",
                "group-data-[state=collapsed]:left-[calc(var(--sidebar-width)*-1)]",
                "group-data-[state=collapsed]:group-data-peek:left-2",
                "group-data-[state=collapsed]:inset-y-2 group-data-[state=collapsed]:rounded-xl group-data-[state=collapsed]:border-secondary-border",
                "group-data-peek:shadow-lg",
              )
            : "right-0 inset-y-0 group-data-[state=collapsed]:right-[calc(var(--sidebar-width)*-1)]",
          className,
        )}
        onPointerEnter={handlePanelEnter}
        onPointerLeave={handlePanelLeave}
        {...props}
      >
        <div
          className={cn(
            "flex h-full w-full flex-col py-2 pl-2",
            "group-data-[state=collapsed]:p-2 group-data-[state=collapsed]:gap-2",
          )}
        >
          {children}
        </div>
      </div>
      {/* Invisible hover strip that summons the peek. Keyed on collapsed state,
          so it stays live during peek (state remains "collapsed") and vanishes
          the instant the sidebar expands. Its overlap with the peeked card
          covers only border/padding. */}
      {side === "left" && (
        <div
          data-slot="sidebar-peek-zone"
          aria-hidden
          className="fixed inset-y-0 left-0 z-20 hidden w-5 group-data-[state=collapsed]:block"
          onPointerEnter={handlePeekZoneEnter}
          onPointerLeave={handlePeekZoneLeave}
        />
      )}
    </div>
  );
};

// Inlined so the registry-distributed sidebar stays self-contained — it must
// not depend on the app's icon set.
const SidebarIcon = (props: ComponentProps<"svg">) => (
  <svg
    aria-hidden="true"
    width="24px"
    height="24px"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.75 4C3.23122 4 2 5.23122 2 6.75V17.25C2 18.7688 3.23122 20 4.75 20H19.25C20.7688 20 22 18.7688 22 17.25V6.75C22 5.23122 20.7688 4 19.25 4H4.75ZM3.5 6.75C3.5 6.05964 4.05964 5.5 4.75 5.5H10.5V18.5H4.75C4.05964 18.5 3.5 17.9404 3.5 17.25V6.75Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 9.5C6.44772 9.5 6 9.05228 6 8.5C6 7.94772 6.44772 7.5 7 7.5C7.55228 7.5 8 7.94772 8 8.5C8 9.05228 7.55228 9.5 7 9.5ZM7 13C6.44772 13 6 12.5523 6 12C6 11.4477 6.44772 11 7 11C7.55228 11 8 11.4477 8 12C8 12.5523 7.55228 13 7 13ZM7 16.5C6.44772 16.5 6 16.0523 6 15.5C6 14.9477 6.44772 14.5 7 14.5C7.55228 14.5 8 14.9477 8 15.5C8 16.0523 7.55228 16.5 7 16.5Z"
        fill="currentColor"
      />
    </g>
  </svg>
);

const SidebarTrigger = ({ className, onClick, ...props }: ComponentProps<"button">) => {
  const { toggleSidebar } = useSidebar();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    toggleSidebar();
  };
  return (
    <IconButton
      data-slot="sidebar-trigger"
      onClick={handleClick}
      variant="ghost"
      className={cn("hover:bg-base-hover", className)}
      {...props}
    >
      <SidebarIcon className="size-4 text-ink-tertiary" />
      <span className="sr-only">Toggle Sidebar</span>
    </IconButton>
  );
};

const SidebarInset = ({ className, children, ...props }: ComponentProps<"main">) => {
  const { state } = useSidebar();

  return (
    <main
      data-slot="sidebar-inset"
      data-expanded={state === "expanded" ? "" : undefined}
      className={cn(
        "group/sidebar-inset bg-base relative flex w-full h-dvh flex-1 flex-col overflow-hidden",
        "data-expanded:p-2 transition-padding duration-150 ease-out motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      {children}
    </main>
  );
};

const SidebarViewport = ({ className, children, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="sidebar-viewport"
    className={cn(
      "flex h-full min-h-0 flex-1 bg-secondary overflow-hidden border border-transparent",
      "group-data-expanded/sidebar-inset:border-secondary-border group-data-expanded/sidebar-inset:rounded-xl",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

const SidebarInput = ({ className, ...props }: ComponentProps<typeof Input>) => {
  return (
    <Input
      data-slot="sidebar-input"
      className={cn(
        "bg-background focus-visible:ring-sidebar-ring h-8 w-full shadow-none",
        className,
      )}
      {...props}
    />
  );
};

const SidebarHeader = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex flex-col p-2 gap-2", className)}
      {...props}
    />
  );
};

const SidebarFooter = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div data-slot="sidebar-footer" className={cn("flex flex-col gap-2", className)} {...props} />
  );
};

const SidebarSeparator = ({ className, ...props }: ComponentProps<typeof Separator>) => {
  return (
    <Separator
      data-slot="sidebar-separator"
      className={cn("bg-sidebar-border mx-2 w-auto", className)}
      {...props}
    />
  );
};

const SidebarContent = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      data-slot="sidebar-content"
      className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto", className)}
      {...props}
    />
  );
};

const SidebarGroup = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("relative flex w-full min-w-0 flex-col", className)}
      {...props}
    />
  );
};

const SidebarGroupLabel = ({ className, render, ...props }: useRender.ComponentProps<"div">) => {
  return useRender({
    render,
    defaultTagName: "div",
    props: {
      "data-slot": "sidebar-group-label",
      ...props,
      className: cn(
        "text-ink-tertiary flex shrink-0 items-center rounded-md px-3 py-1.5 text-md font-medium outline-hidden focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        className,
      ),
    },
  });
};

const SidebarGroupAction = ({
  className,
  render,
  ...props
}: useRender.ComponentProps<"button">) => {
  return useRender({
    render,
    defaultTagName: "button",
    props: {
      "data-slot": "sidebar-group-action",
      ...props,
      className: cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "after:absolute after:-inset-2 after:md:hidden",
        className,
      ),
    },
  });
};

const SidebarGroupContent = ({ className, ...props }: ComponentProps<"div">) => (
  <div data-slot="sidebar-group-content" className={cn("w-full text-sm", className)} {...props} />
);

const SidebarMenu = ({ className, ...props }: ComponentProps<"ul">) => (
  <ul
    data-slot="sidebar-menu"
    className={cn("flex w-full min-w-0 flex-col gap-0.5", className)}
    {...props}
  />
);

const SidebarMenuItem = ({ className, ...props }: ComponentProps<"li">) => (
  <li
    data-slot="sidebar-menu-item"
    className={cn("group/menu-item relative", className)}
    {...props}
  />
);

const sidebarMenuButtonVariants = cva(
  [
    "peer/menu-button cursor-pointer flex w-full items-center gap-2",
    "overflow-hidden rounded-md px-3 h-8 font-medium text-left text-md text-ink-secondary outline-hidden",
    "focus-visible:ring-1",
    "hover:bg-base-hover hover:text-ink-primary data-active:bg-base-hover data-active:text-ink-primary",
    "disabled:pointer-events-none disabled:opacity-50",
    "group-has-data-[slot=sidebar-menu-action]/menu-item:pr-1",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "data-[state=open]:bg-base-hover data-[state=open]:text-ink-primary",
    "[&>span:last-child]:truncate [&_svg]:text-ink-secondary [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:pointer-events-none hover:[&>svg]:text-ink-primary data-active:[&>svg]:text-ink-primary",
  ],
  {
    variants: {
      size: {
        sm: "px-2 py-1 text-xs",
        md: "",
        lg: "text-lg",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const SidebarMenuButton = ({
  isActive = false,
  size = "md",
  tooltip,
  className,
  render,
  ...props
}: useRender.ComponentProps<"button"> & {
  isActive?: boolean;
  tooltip?: string | ComponentProps<typeof Tooltip.Content>;
} & VariantProps<typeof sidebarMenuButtonVariants>) => {
  const { isMobile, state, peek } = useSidebar();

  const button = useRender({
    render,
    defaultTagName: "button",
    props: {
      "data-slot": "sidebar-menu-button",
      "data-size": size,
      "data-active": isActive ? "" : undefined,
      ...props,
      className: cn(sidebarMenuButtonVariants({ size }), className),
    },
  });

  if (!tooltip) {
    return button;
  }

  const tooltipProps = typeof tooltip === "string" ? { children: tooltip } : tooltip;

  return (
    <Tooltip>
      <Tooltip.Trigger render={button} />
      <Tooltip.Content
        side="right"
        align="center"
        // During peek the state is still "collapsed" but the buttons are fully
        // visible — without the peek guard every item sprouts a tooltip.
        hidden={state !== "collapsed" || isMobile || peek}
        {...tooltipProps}
      />
    </Tooltip>
  );
};

const SidebarMenuAction = ({
  className,
  showOnHover = false,
  render,
  onClick,
  ...props
}: useRender.ComponentProps<"button"> & {
  showOnHover?: boolean;
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.(e);
  };

  return useRender({
    render,
    defaultTagName: "button",
    props: {
      "data-slot": "sidebar-menu-action",
      onClick: handleClick,
      ...props,
      className: cn(
        "text-ink-secondary cursor-pointer hover:text-ink-primary flex aspect-square size-5 items-center justify-center rounded-sm outline-hidden focus-visible:ring-1 [&>svg]:size-3.5 [&>svg]:shrink-0",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
        className,
      ),
    },
  });
};

const SidebarMenuBadge = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="sidebar-menu-badge"
    className={cn(
      "text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums",
      "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
      className,
    )}
    {...props}
  />
);

const SidebarMenuSub = ({ className, ...props }: ComponentProps<"ul">) => (
  <ul
    data-slot="sidebar-menu-sub"
    className={cn(
      "border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5",
      "group-data-[collapsible=icon]:hidden",
      className,
    )}
    {...props}
  />
);

const SidebarMenuSubItem = ({ ...props }: ComponentProps<"li">) => (
  <li data-slot="sidebar-menu-sub-item" {...props} />
);

const SidebarMenuSubButton = ({
  size = "md",
  isActive = false,
  className,
  render,
  ...props
}: useRender.ComponentProps<"a"> & {
  size?: "sm" | "md";
  isActive?: boolean;
}) => {
  return useRender({
    render,
    defaultTagName: "a",
    props: {
      "data-slot": "sidebar-menu-sub-button",
      "data-size": size,
      "data-active": isActive,
      ...props,
      className: cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className,
      ),
    },
  });
};

const Sidebar = Object.assign(SidebarRoot, {
  Content: SidebarContent,
  Footer: SidebarFooter,
  Group: SidebarGroup,
  GroupAction: SidebarGroupAction,
  GroupContent: SidebarGroupContent,
  GroupLabel: SidebarGroupLabel,
  Header: SidebarHeader,
  Inset: SidebarInset,
  Viewport: SidebarViewport,
  Input: SidebarInput,
  Menu: SidebarMenu,
  MenuAction: SidebarMenuAction,
  MenuBadge: SidebarMenuBadge,
  MenuButton: SidebarMenuButton,
  MenuItem: SidebarMenuItem,
  MenuSub: SidebarMenuSub,
  MenuSubButton: SidebarMenuSubButton,
  MenuSubItem: SidebarMenuSubItem,
  Provider: SidebarProvider,
  Separator: SidebarSeparator,
  Trigger: SidebarTrigger,
});

export { useSidebar, Sidebar };
