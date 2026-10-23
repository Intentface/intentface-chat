// Part names for the `Chip` namespace. Deliberately carries no "use client":
// this module and index.ts must stay server-resolvable so a React Server
// Component can reach Chip.Root / Chip.Label through them. The directive lives
// one level down, on chip.tsx.
export {
  ChipIcon as Icon,
  ChipLabel as Label,
  ChipPreview as Preview,
  ChipRoot as Root,
} from "./chip";
