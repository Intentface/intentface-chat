"use client";

import { Sidebar } from "@/components/ui/sidebar";

// Mouse users expand via the edge-hover peek (trigger lives inside the
// sidebar); this header trigger stays for the mobile drawer and iPad-class
// touch screens, where there's no hover to summon the peek.
export const Header = () => {
  return (
    <header
      data-slot="header"
      className="absolute top-0 right-0 left-0 flex items-center p-2 md:pointer-fine:hidden"
    >
      <div className="z-2 flex w-full items-center justify-between">
        <Sidebar.Trigger />
      </div>
    </header>
  );
};
