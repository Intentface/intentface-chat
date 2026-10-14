"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import Tooltip from "@/components/ui/tooltip";
import { useThemeOverrides } from "@/hooks/use-theme-overrides";

const loadMotionFeatures = () => import("@/lib/motion-features").then((module) => module.default);

const ThemeOverridesApplier = () => {
  useThemeOverrides();
  return null;
};

// `strict` throws if a full `motion.*` component renders inside, which would
// pull the whole engine back into the first load — use `m.*` from
// "motion/react-m". reducedMotion="user" snaps size and transform animations
// when the OS asks for reduced motion.
export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeOverridesApplier />
      <LazyMotion features={loadMotionFeatures} strict>
        <MotionConfig reducedMotion="user">
          <Tooltip.Provider>{children}</Tooltip.Provider>
        </MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  );
};
