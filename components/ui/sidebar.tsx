"use client";

import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeftIcon } from "lucide-react";
import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Input from "@/components/ui/input";
import Separator from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import Tooltip from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextType = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
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
  const setOpen = useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }

      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp, open],
  );

  const toggleSidebar = useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
  }, [isMobile, setOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
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
    }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            ...style,
          } as CSSProperties
        }
        className={cn(
          "group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full",
          className,
        )}
        data-state={state}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
};

const SidebarRoot = ({
  side = "left",
  // variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: ComponentProps<"div"> & {
  side?: "left" | "right";
  // variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
}) => {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet side={side} open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          data-sidebar="sidebar"
          data-mobile="true"
          className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"
          side={side}
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as CSSProperties
          }
        >
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="group peer text-sidebar-foreground hidden md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      // data-variant={variant}
      data-side={side}
    >
      <div
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          // variant === "floating" || variant === "inset"
          //   ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+theme(spacing.4))]"
          //   : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
        )}
      />
      <div
        data-slot="sidebar"
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          // variant === "floating" || variant === "inset"
          //   ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+theme(spacing.4)+2px)]"
          //   : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className={cn(
            "bg-sidebar flex h-full w-full flex-col",
            "group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

const SidebarTrigger = ({
  className,
  onClick,
  ...props
}: ComponentProps<"button">) => {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-slot="sidebar-trigger"
      data-sidebar="trigger"
      className={cn(
        "inline-flex size-7 items-center justify-center cursor-pointer rounded-md text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeftIcon className="size-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </button>
  );
};

const SidebarRail = ({ className, ...props }: ComponentProps<"button">) => {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-slot="sidebar-rail"
      data-sidebar="rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        "hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "group-data-[collapsible=offcanvas]:hover:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className,
      )}
      {...props}
    />
  );
};

const SidebarInset = ({
  className,
  children,
  ...props
}: ComponentProps<"main">) => {
  const { state } = useSidebar();

  return (
    <main
      data-slot="sidebar-inset"
      data-expanded={state === "expanded" ? "" : undefined}
      className={cn(
        "group/sidebar-inset bg-accent background relative flex w-full h-dvh flex-1 flex-col overflow-hidden",
        "data-expanded:p-2 transition-padding duration-200 ease-out",
        className,
      )}
      {...props}
    >
      {children}
    </main>
  );
};

const SidebarInput = ({
  className,
  ...props
}: ComponentProps<typeof Input>) => {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
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
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
};

const SidebarFooter = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
};

const SidebarSeparator = ({
  className,
  ...props
}: ComponentProps<typeof Separator>) => {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("bg-sidebar-border mx-2 w-auto", className)}
      {...props}
    />
  );
};

const SidebarContent = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
};

const SidebarGroup = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  );
};

const SidebarGroupLabel = ({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) => {
  return useRender({
    render,
    defaultTagName: "div",
    props: {
      "data-slot": "sidebar-group-label",
      "data-sidebar": "group-label",
      ...props,
      className: cn(
        "text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opa] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
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
      "data-sidebar": "group-action",
      ...props,
      className: cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "after:absolute after:-inset-2 after:md:hidden",
        "group-data-[collapsible=icon]:hidden",
        className,
      ),
    },
    state: {},
  });
};

const SidebarGroupContent = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    data-slot="sidebar-group-content"
    data-sidebar="group-content"
    className={cn("w-full text-sm", className)}
    {...props}
  />
);

const SidebarMenu = ({ className, ...props }: ComponentProps<"ul">) => (
  <ul
    data-slot="sidebar-menu"
    data-sidebar="menu"
    className={cn("flex w-full min-w-0 flex-col gap-1", className)}
    {...props}
  />
);

const SidebarMenuItem = ({ className, ...props }: ComponentProps<"li">) => (
  <li
    data-slot="sidebar-menu-item"
    data-sidebar="menu-item"
    className={cn("group/menu-item relative", className)}
    {...props}
  />
);

const sidebarMenuButtonVariants = cva(
  [
    "peer/menu-button flex w-full items-center gap-2",
    "overflow-hidden rounded-md p-2 text-left text-sm outline-hidden",
    "ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2",
    "active:bg-sidebar-accent active:text-sidebar-accent-foreground",
    "disabled:pointer-events-none disabled:opacity-50",
    "group-has-data-[sidebar=menu-action]/menu-item:pr-8",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground",
    "data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground",
    "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2!",
    "[&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        sm: "h-7 text-xs",
        md: "h-8 text-sm",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

const SidebarMenuButton = ({
  isActive = false,
  variant = "default",
  size = "md",
  tooltip,
  className,
  render,
  ...props
}: useRender.ComponentProps<"button"> & {
  isActive?: boolean;
  tooltip?: string | ComponentProps<typeof Tooltip.Content>;
} & VariantProps<typeof sidebarMenuButtonVariants>) => {
  const { isMobile, state } = useSidebar();

  const button = useRender({
    render,
    defaultTagName: "button",
    props: {
      "data-slot": "sidebar-menu-button",
      "data-sidebar": "menu-button",
      "data-size": size,
      "data-active": isActive,
      ...props,
      className: cn(sidebarMenuButtonVariants({ variant, size }), className),
    },
    state: {},
  });

  if (!tooltip) {
    return button;
  }

  const tooltipProps =
    typeof tooltip === "string" ? { children: tooltip } : tooltip;

  return (
    <Tooltip>
      <Tooltip.Trigger render={button} />
      <Tooltip.Content
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltipProps}
      />
    </Tooltip>
  );
};

const SidebarMenuAction = ({
  className,
  showOnHover = false,
  render,
  ...props
}: useRender.ComponentProps<"button"> & {
  showOnHover?: boolean;
}) => {
  return useRender({
    render,
    defaultTagName: "button",
    props: {
      "data-slot": "sidebar-menu-action",
      "data-sidebar": "menu-action",
      ...props,
      className: cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "after:absolute after:-inset-2 after:md:hidden",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
        className,
      ),
    },
    state: {},
  });
};

const SidebarMenuBadge = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="sidebar-menu-badge"
    data-sidebar="menu-badge"
    className={cn(
      "text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums",
      "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
      "group-data-[collapsible=icon]:hidden",
      className,
    )}
    {...props}
  />
);

const SidebarMenuSkeleton = ({
  className,
  showIcon = false,
  ...props
}: ComponentProps<"div"> & {
  showIcon?: boolean;
}) => {
  const width = useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`;
  }, []);

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as CSSProperties
        }
      />
    </div>
  );
};

const SidebarMenuSub = ({ className, ...props }: ComponentProps<"ul">) => (
  <ul
    data-slot="sidebar-menu-sub"
    data-sidebar="menu-sub"
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
      "data-sidebar": "menu-sub-button",
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
    state: {},
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
  Input: SidebarInput,
  Menu: SidebarMenu,
  MenuAction: SidebarMenuAction,
  MenuBadge: SidebarMenuBadge,
  MenuButton: SidebarMenuButton,
  MenuItem: SidebarMenuItem,
  MenuSkeleton: SidebarMenuSkeleton,
  MenuSub: SidebarMenuSub,
  MenuSubButton: SidebarMenuSubButton,
  MenuSubItem: SidebarMenuSubItem,
  Provider: SidebarProvider,
  Rail: SidebarRail,
  Separator: SidebarSeparator,
  Trigger: SidebarTrigger,
});

export { useSidebar, Sidebar };
