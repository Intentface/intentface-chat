"use client";

import { MoonIcon } from "@/components/icons/moon";
import { SunIcon } from "@/components/icons/sun";
import { IconButton } from "@/components/ui/icon-button";
import { useInterfaceTheme } from "@/hooks/use-interface-theme";

/**
 * A single button rather than a three-way control: the sidebar header has room
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
      size="md"
      aria-label={`Switch to ${next} theme`}
      onClick={() => setMode(next)}
      className="rounded-full"
    >
      {resolvedMode === "dark" ? <MoonIcon /> : <SunIcon />}
    </IconButton>
  );
};
