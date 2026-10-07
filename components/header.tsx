"use client";

import { Sidebar } from "@/components/ui/sidebar";

// The sidebar's collapse button, at the same spot as in the docs top bar: 12px
// from the top and left, like the settings gear on the right.
export const Header = () => (
  <header data-slot="header" className="absolute top-0 left-0 z-20 flex h-13 items-center pl-3">
    <Sidebar.Trigger className="size-7" />
  </header>
);
