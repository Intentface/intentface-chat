// Part names for the `Reasoning` namespace. Deliberately carries no
// "use client" directive: this module and index.ts must stay server-resolvable
// so a React Server Component can reach Reasoning.Root and its siblings
// through them. The directive lives one level down, on reasoning.tsx.
export {
  ReasoningContent as Content,
  ReasoningRoot as Root,
  ReasoningTrigger as Trigger,
} from "./reasoning";
