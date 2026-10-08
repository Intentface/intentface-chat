"use client";

import { Sidebar } from "@/components/ui/sidebar";

// The sidebar's collapse button; the playground's header puts it at this same
// spot. A client wrapper because the page is a server component.
export const DocsTopBarTrigger = () => <Sidebar.Trigger className="size-7" />;
