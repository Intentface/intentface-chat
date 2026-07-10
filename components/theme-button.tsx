"use client";

import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MoonIcon } from "@/components/icons/moon";
import { SunIcon } from "@/components/icons/sun";
import { IconButton } from "@/components/ui/icon-button";

export const ThemeButton = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <IconButton variant="ghost" size="md" disabled />;
  }

  const isDark = theme === "dark";

  return (
    <IconButton
      variant="ghost"
      size="md"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.2 }}
        key={isDark ? "moon" : "sun"}
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </motion.div>
    </IconButton>
  );
};
