// Part names for the `Message` namespace. Deliberately carries no
// "use client" directive: this module and index.ts must stay server-resolvable
// so a React Server Component can reach Message.Root and its siblings
// through them. The directive lives one level down, on message.tsx.
export {
  MessageRoot as Root,
  MessageText as Text,
  MessageTurn as Turn,
} from "./message";
