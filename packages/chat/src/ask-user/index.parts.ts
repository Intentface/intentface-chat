// Part names for the `AskUser` namespace. Deliberately carries no
// "use client" directive: this module and index.ts must stay server-resolvable
// so a React Server Component can reach AskUser.Root and its siblings
// through them. The directive lives one level down, on ask-user.tsx.
export {
  AskUserContinue as Continue,
  AskUserDismiss as Dismiss,
  AskUserHeader as Header,
  AskUserHints as Hints,
  AskUserLabel as Label,
  AskUserNavigation as Navigation,
  AskUserNext as Next,
  AskUserOption as Option,
  AskUserOptionContent as OptionContent,
  AskUserOptionDescription as OptionDescription,
  AskUserOptionLabel as OptionLabel,
  AskUserOptions as Options,
  AskUserPrevious as Previous,
  AskUserRoot as Root,
  AskUserStepLabel as StepLabel,
} from "./ask-user";
