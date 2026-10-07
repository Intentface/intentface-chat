"use client";

import { Moon, Sun } from "@keyline-icons/react";
import { IconButton } from "@/components/ui/icon-button";
import { useInterfaceTheme } from "@/hooks/use-interface-theme";

/**
 * A single button rather than a three-way control: the sidebar footer has room
 * for one affordance, and "system" is the starting mode, not a destination
 * anyone picks from here. It flips whichever mode is resolved, so the first
 * press always changes what you see.
 */
export const DocsThemeToggle = () => {
  const { resolvedMode, setMode } = useInterfaceTheme();
  const next = resolvedMode === "dark" ? "light" : "dark";

  return (
    <IconButton
      variant="ghost"
      size="sm"
      aria-label={`Switch to ${next} theme`}
      onClick={() => setMode(next)}
      className="rounded-md"
    >
      {resolvedMode === "dark" ? <Moon /> : <Sun />}
    </IconButton>
  );
};
