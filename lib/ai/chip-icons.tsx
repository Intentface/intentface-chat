import {
  Brain,
  Bug,
  ChartBar,
  Code,
  FileText,
  Globe,
  Image,
  MapPin,
  MessageSquareSparkles,
  Table,
} from "@keyline-icons/react";
import type { ReactNode } from "react";

// Outlined Keyline glyphs, matching the rest of the app. MapPin stands in for
// "map" because Keyline's Map would shadow the global Map.
export const CHIP_ICONS = {
  brain: <Brain />,
  bug: <Bug />,
  bubbleWideSparkle: <MessageSquareSparkles />,
  code: <Code />,
  fileChart: <ChartBar />,
  fileText: <FileText />,
  globe: <Globe />,
  imageAlt: <Image />,
  map: <MapPin />,
  spreadsheet: <Table />,
} satisfies Record<string, ReactNode>;

export type ChipIconKey = keyof typeof CHIP_ICONS;

/** Narrows a wire-format icon string to this app's concrete keys. */
export const isChipIconKey = (value: string): value is ChipIconKey => value in CHIP_ICONS;
