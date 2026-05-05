import type { ReactNode } from "react";
import { BrainIcon } from "@/components/icons/brain";
import { BubbleWideSparkleIcon } from "@/components/icons/bubble-wide-sparkle";
import { CodeIcon } from "@/components/icons/code";
import { FileChartIcon } from "@/components/icons/file-chart";
import { FileTextIcon } from "@/components/icons/file-text";
import { GlobeIcon } from "@/components/icons/globe";
import { ImageAltIcon } from "@/components/icons/image-alt";
import { SpreadsheetIcon } from "@/components/icons/spreadsheet";

export const CHIP_ICONS = {
  brain: <BrainIcon />,
  bubbleWideSparkle: <BubbleWideSparkleIcon />,
  code: <CodeIcon />,
  fileChart: <FileChartIcon />,
  fileText: <FileTextIcon />,
  globe: <GlobeIcon />,
  imageAlt: <ImageAltIcon />,
  spreadsheet: <SpreadsheetIcon />,
} satisfies Record<string, ReactNode>;

export type ChipIconKey = keyof typeof CHIP_ICONS;
