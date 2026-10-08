import { Nav } from "@intentface/chat/nav";
import { ChevronDown, Home, Inbox, Package } from "@keyline-icons/react";

export const SidebarNav = () => (
  <Nav.Root
    aria-label="Main"
    guide="none"
    defaultExpanded={["workspace"]}
    render={<nav />}
    className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto px-2 pb-2"
  >
    <Nav.List className="flex flex-col gap-0.5">
      <Nav.Item value="overview" active className={rowClass}>
        <Nav.Icon>
          <Home className="size-4" />
        </Nav.Icon>
        <Nav.Label className="min-w-0 truncate">Overview</Nav.Label>
      </Nav.Item>
      <Nav.Item value="inbox" className={rowClass}>
        <Nav.Icon>
          <Inbox className="size-4" />
        </Nav.Icon>
        <Nav.Label className="min-w-0 truncate">Inbox</Nav.Label>
      </Nav.Item>

      <Nav.Group value="workspace" className="mt-3">
        <Nav.Trigger className={rowClass}>
          <Nav.Label className="min-w-0 truncate">Workspace</Nav.Label>
          <ChevronDown className="ml-auto !size-3 text-zinc-400 transition-transform group-data-[closed]/row:-rotate-90 dark:text-zinc-500" />
        </Nav.Trigger>
        <Nav.List className="flex flex-col gap-0.5">
          {["Initiatives", "Projects", "Views", "Loops"].map((label) => (
            <Nav.Item key={label} value={label.toLowerCase()} className={rowClass}>
              <Nav.Icon>
                <Package className="size-4" />
              </Nav.Icon>
              <Nav.Label className="min-w-0 truncate">{label}</Nav.Label>
            </Nav.Item>
          ))}
        </Nav.List>
      </Nav.Group>
    </Nav.List>
  </Nav.Root>
);

// An explicit height is load-bearing: 13px text has a fractional line-height,
// so padded rows land on a fraction of a pixel and nothing lines up.
const rowClass = [
  "group/row flex h-[30px] shrink-0 cursor-pointer select-none items-center gap-2 rounded-md px-2 font-medium text-[13px]",
  "text-zinc-700 transition-colors hover:bg-zinc-950/5 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/8 dark:hover:text-zinc-100",
  // Inset ring: the nav scrolls, so an outset one would clip at its edges.
  "focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#0169cc]/60",
  // The selected row is raised off the sidebar.
  "data-[active]:bg-white data-[active]:bg-linear-to-b data-[active]:from-white data-[active]:to-[#fdfdfd] data-[active]:text-zinc-900 data-[active]:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.07),0_2px_6px_-2px_rgb(0_0_0/0.05)]",
  "dark:data-[active]:bg-[#2d2d30] dark:data-[active]:from-[#29292c] dark:data-[active]:to-[#242427] dark:data-[active]:text-zinc-100 dark:data-[active]:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)]",
  "[&_svg]:size-4 [&_svg]:shrink-0",
].join(" ");
