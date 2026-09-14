import {
  IconBrain,
  IconBug,
  IconChartBar,
  IconCode,
  IconFileText,
  IconMap2,
  IconMessageChatbot,
  IconPhoto,
  IconTable,
  IconWorld,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

/*
 * Outlined throughout. Brain, code and chart have no filled variant in Tabler,
 * and a set where three of ten are hollow reads as a mistake rather than a
 * choice — so the whole set stays outlined.
 */
export const CHIP_ICONS = {
  brain: <IconBrain />,
  bug: <IconBug />,
  bubbleWideSparkle: <IconMessageChatbot />,
  code: <IconCode />,
  fileChart: <IconChartBar />,
  fileText: <IconFileText />,
  globe: <IconWorld />,
  imageAlt: <IconPhoto />,
  map: <IconMap2 />,
  spreadsheet: <IconTable />,
} satisfies Record<string, ReactNode>;

export type ChipIconKey = keyof typeof CHIP_ICONS;

/** Narrows a wire-format icon string to this app's concrete keys. */
export const isChipIconKey = (value: string): value is ChipIconKey => value in CHIP_ICONS;
