"use client";

import { motion } from "motion/react";
import { ThemeButton } from "@/components/theme-button";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";

export const Header = () => {
  return (
    <header
      data-slot="header"
      className="fixed top-0 right-0 left-0 z-2 flex h-(--header-height) items-center p-4"
    >
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-(--conversation-width) h-14">
        <ProgressiveBlur
          direction="top"
          className="absolute inset-0 bg-linear-to-b from-background to-transparent"
        />
      </div>
      <motion.div
        initial={{ opacity: 0, y: -8, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="z-1 flex w-full items-center justify-end"
      >
        <ThemeButton />
      </motion.div>
    </header>
  );
};
