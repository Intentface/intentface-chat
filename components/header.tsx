"use client";

import { Sidebar } from "@/components/ui/sidebar";

export const Header = () => {
  return (
    <header
      data-slot="header"
      className="absolute top-0 right-0 left-0 flex items-center p-2"
    >
      <div className="z-2 flex w-full items-center justify-between">
        <Sidebar.Trigger />
      </div>
    </header>
  );
};
