"use client";

import { ThemeProvider } from "next-themes";
import Tooltip from "@/components/ui/tooltip";
import { useThemeOverrides } from "@/hooks/use-theme-overrides";

const ThemeOverridesApplier = () => {
  useThemeOverrides();
  return null;
};

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeOverridesApplier />
      <Tooltip.Provider>{children}</Tooltip.Provider>
    </ThemeProvider>
  );
};
