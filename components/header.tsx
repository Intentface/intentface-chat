"use client";

import { ThemeButton } from "@/components/theme-button";
// import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { Sidebar } from "@/components/ui/sidebar";

export const Header = () => {
  return (
    <header
      data-slot="header"
      className="absolute top-0 right-0 left-0 flex items-center p-2"
    >
      {/* <div className="absolute inset-0 mx-auto w-full max-w-(--thread-width) h-full">
        <ProgressiveBlur
          direction="top"
          className="w-full h-full bg-linear-to-b from-background to-transparent"
        />
      </div> */}
      <div className="z-2 flex w-full items-center justify-between">
        <Sidebar.Trigger />
        <ThemeButton />
      </div>
    </header>
  );
};
