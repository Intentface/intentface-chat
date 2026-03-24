"use client";

import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeftIcon } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  useCallback,
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
import { cn } from "@/lib/utils";
import { IconButton } from "./icon-button";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
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
        className={cn(
          "group/sidebar-wrapper flex min-h-svh w-full bg-slate-3",
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
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: ComponentProps<"div"> & {
  side?: "left" | "right";
  collapsible?: "offcanvas" | "icon" | "none";
}) => {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (isMobile) {
    return (
      <Drawer side={side} open={openMobile} onOpenChange={setOpenMobile}>
        <Drawer.Content
          data-sidebar="sidebar"
          data-mobile="true"
          className="w-(--sidebar-width) [&>button]:hidden"
          side={side}
        >
          <div className="flex h-full w-full flex-col">{children}</div>
        </Drawer.Content>
      </Drawer>
    );
  }

  return (
    <div
      className="group peer text-sidebar-foreground hidden md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-side={side}
    >
      <div
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[state=collapsed]:w-0",
          "group-data-[side=right]:rotate-180",
        )}
      />
      <div
        data-slot="sidebar"
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left"
            ? "left-0 group-data-[state=collapsed]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[state=collapsed]:right-[calc(var(--sidebar-width)*-1)]",
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className={cn(
            "bg-sidebar flex h-full w-full flex-col py-2 pl-2 gap-2",
            "group-data-[state=collapsed]:border-sidebar-border group-data-[state=collapsed]:rounded-lg group-data-[state=collapsed]:border group-data-[state=collapsed]:shadow-sm",
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

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    toggleSidebar();
  };
  return (
    <IconButton
      data-slot="sidebar-trigger"
      data-sidebar="trigger"
      onClick={handleClick}
      variant="ghost"
      {...props}
    >
      <PanelLeftIcon className="size-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </IconButton>
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
        "hover:bg-sidebar translate-x-0 after:left-full",
        "[[data-side=left]:-right-2 [[data-side=right]:-left-2",
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
        "group/sidebar-inset bg-slate-3 relative flex w-full h-dvh flex-1 flex-col overflow-hidden",
        "data-expanded:p-2 transition-padding duration-200 ease-out",
        className,
      )}
      {...props}
    >
      {children}
    </main>
  );
};

const SidebarViewport = ({
  className,
  children,
  ...props
}: ComponentProps<"div">) => (
  <div
    data-slot="sidebar-viewport"
    className={cn(
      "flex h-full min-h-0 flex-1 bg-slate-2 overflow-hidden border border-transparent",
      "group-data-expanded/sidebar-inset:border-slate-7 group-data-expanded/sidebar-inset:rounded-xl",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

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
      className={cn("flex flex-col p-2 gap-2", className)}
      {...props}
    />
  );
};

const SidebarFooter = ({ className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("flex flex-col gap-2", className)}
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
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto",
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
      className={cn("relative flex w-full min-w-0 flex-col", className)}
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
        "text-slate-11 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opa] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
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
    "peer/menu-button cursor-pointer flex w-full items-center gap-2",
    "overflow-hidden rounded-md px-2 font-[450] text-left text-sm outline-hidden",
    "transition-[width,height,padding] focus-visible:ring-1",
    "hover:bg-slate-4 data-active:bg-slate-5",
    "disabled:pointer-events-none disabled:opacity-50",
    "group-has-data-[sidebar=menu-action]/menu-item:pr-1",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "data-[state=open]:bg-slate-5",
    "[&>span:last-child]:truncate [&_svg]:text-slate-11 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:pointer-events-none hover:[&>svg]:text-slate-12",
  ],
  {
    variants: {
      size: {
        sm: "h-7 text-xs",
        md: "h-8 text-sm",
        lg: "h-9 text-md",
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
  const { isMobile, state } = useSidebar();

  const button = useRender({
    render,
    defaultTagName: "button",
    props: {
      "data-slot": "sidebar-menu-button",
      "data-sidebar": "menu-button",
      "data-size": size,
      "data-active": isActive ? "" : undefined,
      ...props,
      className: cn(sidebarMenuButtonVariants({ size }), className),
    },
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
      "data-sidebar": "menu-action",
      onClick: handleClick,
      ...props,
      className: cn(
        "text-slate-11 cursor-pointer hover:text-slate-12 flex aspect-square size-6 items-center justify-center rounded-sm outline-hidden focus-visible:ring-1 [&>svg]:size-4 [&>svg]:shrink-0",
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
    data-sidebar="menu-badge"
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
  Rail: SidebarRail,
  Separator: SidebarSeparator,
  Trigger: SidebarTrigger,
});

export { useSidebar, Sidebar };
