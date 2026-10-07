"use client";

import { Sidebar } from "@/components/ui/sidebar";

// Mouse users bring a collapsed sidebar back from the edge hotspot or its own
// trigger; this one is for the mobile drawer and touch screens without hover.
export const DocsTopBarTrigger = () => (
  <Sidebar.Trigger className="-ml-1 size-7 md:pointer-fine:hidden" />
);
