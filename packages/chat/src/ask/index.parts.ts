// Part names for the `Ask` namespace. Deliberately carries no
// "use client" directive: this module and index.ts must stay server-resolvable
// so a React Server Component can reach Ask.Root and its siblings
// through them. The directive lives one level down, on ask.tsx.
export {
  AskContinue as Continue,
  AskDismiss as Dismiss,
  AskHeader as Header,
  AskHints as Hints,
  AskLabel as Label,
  AskNavigation as Navigation,
  AskNext as Next,
  AskOption as Option,
  AskOptionContent as OptionContent,
  AskOptionDescription as OptionDescription,
  AskOptionLabel as OptionLabel,
  AskOptions as Options,
  AskPrevious as Previous,
  AskRoot as Root,
  AskStepLabel as StepLabel,
} from "./ask";
