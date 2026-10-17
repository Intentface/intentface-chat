// Part names for the `GenUi` namespace. Deliberately carries no "use client"
// directive: this module and index.ts must stay server-resolvable so a React
// Server Component can reach GenUi.Root and its siblings through them. The
// directive lives one level down, on genui-render.tsx.
export {
  GenUiPart as Part,
  GenUiRoot as Root,
  GenUiSpec as Spec,
  GenUiView as View,
} from "./genui-render";
