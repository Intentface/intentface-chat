"use client";

import { ThemeProvider } from "next-themes";
import Tooltip from "@/components/ui/tooltip";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Tooltip.Provider>{children}</Tooltip.Provider>
    </ThemeProvider>
  );
};
