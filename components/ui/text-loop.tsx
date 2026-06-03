"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps } from "react";
import { useLoop } from "@/hooks/use-loop";
import { cn } from "@/lib/utils";

const TextLoop = ({
  className,
  items = [],
  ...props
}: ComponentProps<"div"> & { items?: string[] }) => {
  const { currentItem, key } = useLoop(items);

  return (
    <div
      className={cn("pointer-events-none flex items-center justify-center", className)}
      {...props}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={key}
          initial={{ opacity: 0, y: "100%", filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: "-100%", filter: "blur(4px)" }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="whitespace-nowrap text-gray-11/60 text-md"
        >
          {currentItem}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

export { TextLoop };
