"use client";

import { useRender } from "@base-ui/react/use-render";
import { SHELL_SIDEBAR_WIDTH_VAR, Shell, useShell } from "@intentface/chat/shell";
import { PanelLeft } from "@keyline-icons/react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Drawer from "@/components/ui/drawer";
import Input from "@/components/ui/input";
import Separator from "@/components/ui/separator";
import Tooltip from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { writeSidebarLayout } from "@/lib/sidebar-cookie";
import { cn } from "@/lib/utils";
import { IconButton } from "./icon-button";

/*
 * Open/collapsed state and the whole hotspot choreography live in `Shell`
 * from @intentface/chat/shell — this file is the styled layer over it. What
 * stays here is what the package deliberately has no opinion about: every
 * class, the off-canvas/card geometry, the mobile drawer, where the layout is
 * persisted, and the keyboard shortcut.
 *
 * Mobile is the one piece of state Shell does not own. It is a separate fact
 * from the desktop sidebar's: `open` is restored from a cookie and defaults
 * open, which is exactly what you do *not* want a drawer to do on load.
 */

type SidebarMobileContextType = {
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
};

const SidebarMobileContext = createContext<SidebarMobileContextType | null>(null);

/**
 * The styled layer's view of the shell: Shell's own state plus the mobile
 * drawer's. Kept as one hook so the parts below read one thing, the way they
 * did when this file owned all of it.
 */
const useSidebar = () => {
  const mobile = useContext(SidebarMobileContext);
  if (!mobile) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  const open = useShell((shell) => shell.open);
  const hotspot = useShell((shell) => shell.hotspot);
  const setOpen = useShell((shell) => shell.setOpen);
  const toggle = useShell((shell) => shell.toggle);

  return {
    state: open ? ("expanded" as const) : ("collapsed" as const),
    open,
    setOpen,
    hotspot,
    // On mobile the trigger drives the drawer; Shell's own toggle already
    // expands a floated-out sidebar in place rather than closing it.
    toggleSidebar: () => (mobile.isMobile ? mobile.setOpenMobile(!mobile.openMobile) : toggle()),
    ...mobile,
  };
};

const SidebarProvider = ({
  defaultOpen = true,
  width,
  open,
  onOpenChange,
  className,
  children,
  ...props
}: ComponentProps<"div"> & {
  /** Read it from the request with `readSidebarLayout` so the first paint is already right. */
  defaultOpen?: boolean;
  /** A restored width, applied as the custom property the sidebar's `width` reads. */
  width?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = useState(false);

  const mobile = useMemo<SidebarMobileContextType>(
    () => ({ isMobile, openMobile, setOpenMobile }),
    [isMobile, openMobile],
  );

  return (
    <SidebarMobileContext.Provider value={mobile}>
      <Shell.Root
        defaultOpen={defaultOpen}
        open={open}
        // Where the layout is kept is this app's business, not the package's —
        // see lib/sidebar-cookie.
        onOpenChange={(next) => {
          onOpenChange?.(next);
          writeSidebarLayout({ open: next });
        }}
        data-slot="sidebar-wrapper"
        // A restored width goes back the way the grip writes it: the
        // custom property. There is no prop for it, because the width is CSS's.
        style={
          width === undefined
            ? undefined
            : ({ [SHELL_SIDEBAR_WIDTH_VAR]: `${width}px` } as CSSProperties)
        }
        className={cn("group/sidebar-wrapper flex min-h-svh w-full bg-base-bg", className)}
        {...props}
      >
        <SidebarShortcut />
        {children}
      </Shell.Root>
    </SidebarMobileContext.Provider>
  );
};

/**
 * Cmd/Ctrl+B. The package claims no window-level key — it cannot know which
 * ones this app has spent — so the binding is ours.
 *
 * It goes through `toggleSidebar` rather than Shell's own `toggle`, for the
 * same reason the trigger button does: below the mobile breakpoint the desktop
 * panel is not rendered, so toggling Shell would change nothing on screen while
 * still persisting a collapsed sidebar that reappears when the window widens.
 *
 * A component rather than a hook in the provider, so it can read the store
 * through context like every other part.
 */
const SidebarShortcut = () => {
  const { toggleSidebar } = useSidebar();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "b" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      toggleSidebar();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return null;
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
  const { isMobile, state, openMobile, setOpenMobile, hotspot } = useSidebar();

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
      data-hotspot={hotspot ? "" : undefined}
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
          expanded (left-0 inset-y-0, flat), collapsed (off-canvas), hotspot
          (left-2 floating). The card geometry (inset-y-2, radius, border) is
          baked into the WHOLE collapsed state — hidden off-canvas it's
          invisible, so the hotspot slide animates left only: no vertical
          movement, the gap never grows mid-slide. Only expand/collapse morphs
          card ↔ flat. Shadow is hotspot-only (an off-canvas panel resting at the
          screen edge would bleed its shadow onto the viewport). Border stays
          1px transparent in the flat state so only border-color animates —
          no width jump. The stacked collapsed+hotspot variant outranks the
          off-canvas left on specificity, not stylesheet order. */}
      {/* Shell.Sidebar brings the hotspot hold/release pointer handlers with it. */}
      <Shell.Sidebar
        side={side}
        onResize={(next) => writeSidebarLayout({ width: next })}
        data-slot="sidebar"
        className={cn(
          "fixed z-30 hidden w-(--sidebar-width) border border-transparent bg-base-bg overflow-hidden transition-[left,right,top,bottom,border-color,border-radius,box-shadow] duration-150 ease-linear motion-reduce:transition-none md:flex",
          side === "left"
            ? cn(
                "left-0 inset-y-0",
                "group-data-[state=collapsed]:-left-(--sidebar-width)",
                "group-data-[state=collapsed]:group-data-hotspot:left-2",
                "group-data-[state=collapsed]:inset-y-2 group-data-[state=collapsed]:rounded-xl",
                "group-data-hotspot:shadow-overlay",
              )
            : "right-0 inset-y-0 group-data-[state=collapsed]:-right-(--sidebar-width)",
          className,
        )}
        {...props}
      >
        {/* Only a sliver of right padding while flush: the viewport's own p-2
            supplies most of the seam, so the two add up to the 12px left edge.
            The floating card pads all four sides, because then it has edges of
            its own. */}
        <div className="flex h-full w-full flex-col gap-4 pt-2 pr-1 pb-3 pl-3 group-data-[state=collapsed]:p-2">
          {children}
        </div>
      </Shell.Sidebar>
      {/* Invisible hover strip that summons the hotspot. Keyed on collapsed state,
          so it stays live during hotspot (state remains "collapsed") and vanishes
          the instant the sidebar expands. Its overlap with the hotspoted card
          covers only border/padding. */}
      {/* Not rendering it is how you opt out of hotspot — there is no prop for that. */}
      {side === "left" && (
        <Shell.Hotspot
          data-slot="sidebar-hotspot"
          className="fixed inset-y-0 left-0 z-40 hidden w-5 group-data-[state=collapsed]:block"
        />
      )}
    </div>
  );
};

const SidebarTrigger = ({ className, onClick, ...props }: ComponentProps<"button">) => {
  const { isMobile, toggleSidebar } = useSidebar();

  const button = (
    <IconButton
      data-slot="sidebar-trigger"
      variant="ghost"
      className={cn("rounded-md", className)}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </IconButton>
  );

  // The drawer is the app's own state, so mobile drives it directly. On desktop
  // Shell.Trigger supplies the toggle plus aria-expanded/aria-controls pointing
  // at the sidebar it actually governs.
  return isMobile ? (
    <IconButton
      data-slot="sidebar-trigger"
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      variant="ghost"
      className={cn("rounded-md", className)}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </IconButton>
  ) : (
    <Shell.Trigger onClick={onClick} render={button} />
  );
};

const SidebarInset = ({ className, children, ...props }: ComponentProps<"main">) => {
  const { state } = useSidebar();

  return (
    <main
      data-slot="sidebar-inset"
      data-expanded={state === "expanded" ? "" : undefined}
      className={cn(
        "group/sidebar-inset bg-base-bg relative flex w-full h-dvh flex-1 flex-col overflow-hidden",
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
      // clip, not hidden: a clipping box can't be scrolled by focus() or scrollIntoView.
      "relative flex h-full min-h-0 flex-1 bg-secondary-bg overflow-clip",
      "group-data-expanded/sidebar-inset:rounded-xl group-data-expanded/sidebar-inset:border group-data-expanded/sidebar-inset:border-transparent group-data-expanded/sidebar-inset:shadow-card",
      // Dark: the card's inset edge is a real border, so content (sticky bars,
      // thread fades) is clipped inside it instead of painting over it.
      "dark:group-data-expanded/sidebar-inset:border-white/6 dark:group-data-expanded/sidebar-inset:border-t-white/11 dark:group-data-expanded/sidebar-inset:shadow-[0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

const SidebarInput = ({ className, ...props }: ComponentProps<typeof Input>) => {
  return <Input data-slot="sidebar-input" className={cn("h-8 w-full", className)} {...props} />;
};

const SidebarHeader = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      data-slot="sidebar-header"
      // No padding of its own; the panel wrapper supplies it, as for the footer.
      className={cn("flex flex-col gap-2", className)}
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
    <Separator data-slot="sidebar-separator" className={cn("mx-2 w-auto", className)} {...props} />
  );
};

const SidebarContent = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      data-slot="sidebar-content"
      // The scroller clips, so it bleeds 4px each side: raised rows keep their
      // ring and shadow, and stay aligned with the header.
      className={cn("-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-1 pb-1", className)}
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
        "text-ink-secondary flex h-7 shrink-0 items-center rounded-md px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-accent-bg/60 [&>svg]:size-4 [&>svg]:shrink-0",
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
        "text-ink-secondary hover:bg-ink-primary/5 hover:text-ink-primary absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 transition-transform focus-visible:outline-2 focus-visible:outline-accent-bg/60 [&>svg]:size-4 [&>svg]:shrink-0",
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
    className={cn("flex w-full min-w-0 flex-col gap-px", className)}
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
    "overflow-hidden rounded-md px-2 h-[30px] font-medium text-left text-sm/none text-ink-body",
    "focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:-outline-offset-2",
    // Hover is a faint wash; the active row rises like a button.
    "hover:bg-ink-primary/5 hover:text-ink-primary",
    "data-active:bg-raised-selected data-active:text-ink-primary data-active:shadow-raised",
    "disabled:pointer-events-none disabled:opacity-50",
    "group-has-data-[slot=sidebar-menu-action]/menu-item:pr-1",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "data-popup-open:bg-ink-primary/5 data-popup-open:text-ink-primary",
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
  const { isMobile, state, hotspot } = useSidebar();

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
        // During hotspot the state is still "collapsed" but the buttons are fully
        // visible — without the hotspot guard every item sprouts a tooltip.
        hidden={state !== "collapsed" || isMobile || hotspot}
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
        "hover:bg-ink-primary/6 text-ink-secondary cursor-pointer hover:text-ink-primary flex aspect-square size-5 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-accent-bg/60 [&>svg]:size-3.5 [&>svg]:shrink-0",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-popup-open:opacity-100 data-pressed:opacity-100 md:opacity-0",
        className,
      ),
    },
  });
};

const SidebarMenuBadge = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="sidebar-menu-badge"
    className={cn(
      "text-ink-secondary pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums",
      "peer-hover/menu-button:text-ink-primary peer-data-[active=true]/menu-button:text-ink-primary",
      className,
    )}
    {...props}
  />
);

const SidebarMenuSub = ({ className, ...props }: ComponentProps<"ul">) => (
  <ul
    data-slot="sidebar-menu-sub"
    className={cn(
      "border-ink-primary/8 mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5",
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
        "text-ink-body hover:bg-ink-primary/5 hover:text-ink-primary active:bg-ink-primary/8 [&>svg]:text-ink-secondary flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 focus-visible:outline-2 focus-visible:outline-accent-bg/60 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        "data-[active=true]:bg-raised-selected data-[active=true]:text-ink-primary data-[active=true]:shadow-raised",
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
