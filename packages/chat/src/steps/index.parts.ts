// Part names for the `Steps` namespace. Deliberately carries no
// "use client" directive: this module and index.ts must stay server-resolvable
// so a React Server Component can reach Steps.Root and its siblings
// through them. The directive lives one level down, on steps.tsx.
export {
  StepsIcon as Icon,
  StepsItem as Item,
  StepsLabel as Label,
  StepsPanel as Panel,
  StepsRoot as Root,
  StepsStatus as Status,
  StepsTrigger as Trigger,
} from "./steps";
