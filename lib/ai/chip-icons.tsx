import {
  IconBrain,
  IconBugFilled,
  IconChartBar,
  IconCode,
  IconFileTextFilled,
  IconMessageChatbotFilled,
  IconPhotoFilled,
  IconTableFilled,
  IconWorldFilled,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

export const CHIP_ICONS = {
  brain: <IconBrain />,
  bug: <IconBugFilled />,
  bubbleWideSparkle: <IconMessageChatbotFilled />,
  code: <IconCode />,
  fileChart: <IconChartBar />,
  fileText: <IconFileTextFilled />,
  globe: <IconWorldFilled />,
  imageAlt: <IconPhotoFilled />,
  spreadsheet: <IconTableFilled />,
} satisfies Record<string, ReactNode>;

export type ChipIconKey = keyof typeof CHIP_ICONS;

/** Narrows a wire-format icon string to this app's concrete keys. */
export const isChipIconKey = (value: string): value is ChipIconKey => value in CHIP_ICONS;
