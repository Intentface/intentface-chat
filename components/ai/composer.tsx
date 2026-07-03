"use client";

// Styled composer — thin wrappers over @intentface/chat/composer. Behavior
// (editor, store, machines, command plumbing) lives in the package; this file
// carries the Tailwind classes, icons, and motion, and re-exports the public
// surface so consumers keep importing from "@/components/ai/composer".

import {
  type CommandItemData as CommandItemDataPrimitive,
  Composer as ComposerPrimitive,
  composerController,
  useComposer,
  useComposerCommandsMap,
  useComposerController,
  useComposerPlaceholder,
  useComposerSubmit,
} from "@intentface/chat/composer";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ComponentProps, type ReactNode, useRef } from "react";
import { AskUser } from "@/components/ai/ask-user";
import { Attachments } from "@/components/ai/attachments";
import { CHIP_SURFACE_CLASS, type ChipVariant } from "@/components/ai/chip";
import { SendIcon } from "@/components/icons/send";
import { StopIcon } from "@/components/icons/stop";
import Button from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { useMeasure } from "@/hooks/use-measure";
import { CHIP_ICONS, type ChipIconKey } from "@/lib/ai/chip-icons";
import { cn } from "@/lib/utils";

export { composerController, useComposer, useComposerController };

// The wire format carries icon/variant as opaque strings; this app's command
// items narrow them to the concrete unions so CHIP_ICONS indexing and Chip
// variants stay typed.
export type CommandItemData = Omit<CommandItemDataPrimitive, "icon" | "variant"> & {
  icon?: ChipIconKey;
  variant?: ChipVariant;
};

export type {
  AttachmentsApi,
  ChipData,
  CommandItemKind,
  ComposerAnswerEntry,
  ComposerAnswersSubmit,
  ComposerCommandsConfig,
  ComposerCommandsItems,
  ComposerCommandsMap,
  ComposerEditorHandle,
  ComposerEditorState,
  ComposerMessageSubmit,
  ComposerSnapshot,
  ComposerSubmitData,
  PrefixOnSelectContext,
  TriggerRule,
} from "@intentface/chat/composer";

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export type ComposerRootProps = ComponentProps<typeof ComposerPrimitive>;

const ComposerRoot = ({ className, ...props }: ComposerRootProps) => (
  <ComposerPrimitive
    chipIcons={CHIP_ICONS}
    className={cn("relative w-full flex flex-col", className)}
    {...props}
  />
);

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

type ComposerContainerProps = ComponentProps<typeof ComposerPrimitive.Container>;

const ComposerContainer = ({ className, ...props }: ComposerContainerProps) => (
  <ComposerPrimitive.Container
    className={cn(
      // Positioned so it paints above the context window peeking out from
      // behind its top edge.
      "relative border border-primary-border bg-primary rounded-4xl shadow-xs [corner-shape:squircle] cursor-text transition-colors",
      className,
    )}
    {...props}
  />
);

// ---------------------------------------------------------------------------
// Attachments / AttachmentTrigger
// ---------------------------------------------------------------------------

type ComposerAttachmentsProps = {
  className?: string;
  accept?: string;
  maxFiles?: number;
  maxFileSize?: number;
  multiple?: boolean;
  globalDrop?: boolean;
};

const ComposerAttachments = ({ className, ...props }: ComposerAttachmentsProps) => {
  const attachments = useComposer((composer) => composer.attachments);

  return (
    <ComposerPrimitive.Attachments {...props}>
      <AnimatePresence initial={false}>
        {(attachments.isDragging || attachments.items.length > 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="relative">
              {attachments.items.length > 0 ? (
                <div className={cn("flex flex-wrap gap-2 p-2", className)}>
                  <AnimatePresence initial={false}>
                    {attachments.items.map((attachment) => (
                      <Attachments.Item key={attachment.id} item={attachment}>
                        <Attachments.Remove onRemove={() => attachments.remove(attachment.id)} />
                      </Attachments.Item>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="h-14" />
              )}
              <Attachments.Dropzone visible={attachments.isDragging} variant="inline" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Attachments.Error />
    </ComposerPrimitive.Attachments>
  );
};

type ComposerAttachmentTriggerProps = ComponentProps<typeof IconButton>;

const ComposerAttachmentTrigger = (props: ComposerAttachmentTriggerProps) => {
  const attachments = useComposer((composer) => composer.attachments);

  return (
    <Attachments.Trigger
      data-slot="composer-attachment-trigger"
      onClick={() => attachments.openFileDialog()}
      {...props}
    />
  );
};

// ---------------------------------------------------------------------------
// Textarea / Placeholder
// ---------------------------------------------------------------------------

// Same surface as a committed chip (primary variant) so the active-prefix badge
// and the chip it becomes share one inline text-flow model — no baseline jump.
const BADGE_CLASSES = `${CHIP_SURFACE_CLASS} bg-primary-hover text-ink-primary`;
const PLACEHOLDER_CLASSES =
  "after:content-['Type_to_filter'] after:text-ink-tertiary after:whitespace-nowrap after:pointer-events-none";

type ComposerTextareaProps = {
  value?: string;
  onValueChange?: (text: string) => void;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  children?: ReactNode;
};

const ComposerTextarea = ({ className, disabled = false, ...props }: ComposerTextareaProps) => (
  <ComposerPrimitive.Textarea
    disabled={disabled}
    editorClassName="max-w-none focus:outline-none w-full font-[450] leading-[1.7]"
    commandBadgeClassName={BADGE_CLASSES}
    commandPlaceholderClassName={PLACEHOLDER_CLASSES}
    className={cn(
      "max-h-32 min-h-8 overflow-y-auto py-2 px-3 text-md",
      "mask-[linear-gradient(to_bottom,transparent,black_16px,black_calc(100%-16px),transparent)]",
      disabled && "opacity-50 cursor-not-allowed",
      className,
    )}
    {...props}
  />
);

type ComposerPlaceholderProps =
  | { placeholder: string | string[]; children?: never; className?: string }
  | { placeholder?: never; children: ReactNode; className?: string };

const ComposerPlaceholder = ({ placeholder, children, className }: ComposerPlaceholderProps) => {
  const { items, isLooping, currentItem, key } = useComposerPlaceholder(placeholder, children);

  if (!isLooping && items.length === 1) {
    return (
      <div className={cn("min-h-lh text-ink-tertiary font-[450] leading-[1.7]", className)}>
        {items[0]}
      </div>
    );
  }

  if (!isLooping && items.length === 0) return null;

  return (
    <div className="pointer-events-none flex min-h-lh">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={key}
          initial={{ opacity: 0, y: "100%", filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: "-100%", filter: "blur(4px)" }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn("text-ink-tertiary font-[450] leading-[1.7]", className)}
        >
          {typeof items[0] === "string" ? currentItem : items[key % items.length]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ContextWindow / Actions / Submit
// ---------------------------------------------------------------------------

type ComposerContextWindowProps = ComponentProps<typeof ComposerPrimitive.ContextWindow>;

const ComposerContextWindow = ({ className, ...props }: ComposerContextWindowProps) => (
  <ComposerPrimitive.ContextWindow
    className={cn(
      "relative z-0 overflow-hidden flex items-center transition-all duration-200 px-3 text-xs",
      // Background drawn by ::before so only the top corners round — the
      // bottom edge stays square and hides behind the container below.
      'before:content-[""] before:absolute before:inset-0 before:-z-10 before:rounded-t-2xl before:bg-base before:pointer-events-none',
      // Visible: 32px band peeking above the container plus 16px submerged
      // beneath it (negative margin pulls the container up over the
      // bottom-padded zone).
      "h-0 opacity-0 data-visible:h-12 data-visible:pb-4 data-visible:-mb-4 data-visible:opacity-100",
      className,
    )}
    {...props}
  />
);

const ComposerActions = ({
  className,
  ...props
}: ComponentProps<typeof ComposerPrimitive.Actions>) => (
  <ComposerPrimitive.Actions className={cn("flex justify-end gap-2 p-2", className)} {...props} />
);

type ComposerSubmitProps = ComponentProps<typeof IconButton> & {
  // While generating, the button morphs into a stop control: the send glyph
  // cross-fades to a stop square, the type flips to "button", and clicking it
  // (or pressing Escape) calls onStop instead of submitting the form.
  isGenerating?: boolean;
  onStop?: () => void;
};

const ComposerSubmit = ({
  children,
  className,
  disabled,
  isGenerating = false,
  onStop,
  onClick,
  ...props
}: ComposerSubmitProps) => {
  const submit = useComposerSubmit({ isGenerating, onStop, disabled });

  return (
    <IconButton
      type={submit.type}
      variant="accent"
      data-slot="composer-submit"
      data-generating={isGenerating ? "" : undefined}
      aria-label={isGenerating ? "Stop generating" : undefined}
      className={cn("rounded-full", className)}
      disabled={submit.disabled}
      onClick={isGenerating ? () => onStop?.() : onClick}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isGenerating ? "stop" : "send"}
          initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
          transition={{ duration: 0.15 }}
          className="flex items-center justify-center"
        >
          {isGenerating ? <StopIcon /> : (children ?? <SendIcon />)}
        </motion.span>
      </AnimatePresence>
    </IconButton>
  );
};

// ---------------------------------------------------------------------------
// Panel / PanelItem
// ---------------------------------------------------------------------------

type ComposerPanelProps = ComponentProps<"div"> & {
  value?: string;
};

const ComposerPanel = ({ children, className, value, ...props }: ComposerPanelProps) => {
  const [contentRef, bounds] = useMeasure();

  return (
    <ComposerPrimitive.Panel
      value={value}
      className={cn("overflow-hidden transition-transform data-open:pb-2", className)}
      renderContent={(matchedChild, hasMatch) => (
        <MotionConfig transition={{ duration: 0.3, type: "spring", bounce: 0 }}>
          <AnimatePresence initial={false}>
            {hasMatch && (
              <motion.div
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1, height: bounds.height }}
                exit={{ y: "100%", opacity: 0 }}
                className="overflow-hidden box-content border border-primary-border bg-primary rounded-4xl shadow-xs [corner-shape:squircle]"
              >
                <div ref={contentRef} className="relative">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {matchedChild}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </MotionConfig>
      )}
      {...props}
    >
      {children}
    </ComposerPrimitive.Panel>
  );
};

type ComposerPanelItemProps = Omit<ComponentProps<typeof motion.div>, "value"> & {
  value: string;
  children: ReactNode;
};

const ComposerPanelItem = ({ value, children, ...props }: ComposerPanelItemProps) => (
  <motion.div
    key={value}
    data-slot="composer-panel-item"
    initial={{ opacity: 0, filter: "blur(8px)" }}
    animate={{ opacity: 1, filter: "blur(0px)" }}
    exit={{ opacity: 0, filter: "blur(8px)" }}
    {...props}
  >
    {children}
  </motion.div>
);

// ---------------------------------------------------------------------------
// CommandList family
// ---------------------------------------------------------------------------

type ComposerCommandListProps = ComponentProps<typeof ComposerPrimitive.CommandList>;

const ComposerCommandList = ({ className, ...props }: ComposerCommandListProps) => (
  <ComposerPrimitive.CommandList
    className={cn(
      "group/composer-command-list flex max-h-64 flex-col overflow-y-auto p-1 scroll-py-1",
      className,
    )}
    {...props}
  />
);

type ComposerCommandItemsProps<Item extends CommandItemDataPrimitive> = {
  className?: string;
  children: (item: Item) => ReactNode;
};

const ComposerCommandItems = <Item extends CommandItemDataPrimitive = CommandItemData>({
  className,
  children,
}: ComposerCommandItemsProps<Item>): ReactNode => (
  <ComposerPrimitive.CommandItems
    className={cn(
      "flex flex-col",
      "group-data-[state=empty]/composer-command-list:hidden",
      className,
    )}
  >
    {children}
  </ComposerPrimitive.CommandItems>
);

const ComposerCommandLoading = ({
  className,
  ...props
}: ComponentProps<typeof ComposerPrimitive.CommandLoading>) => (
  <ComposerPrimitive.CommandLoading
    className={cn(
      "hidden group-data-[state=loading]/composer-command-list:flex",
      "items-center px-3 h-8 text-sm text-ink-tertiary",
      className,
    )}
    {...props}
  />
);

const ComposerCommandEmpty = ({
  className,
  ...props
}: ComponentProps<typeof ComposerPrimitive.CommandEmpty>) => (
  <ComposerPrimitive.CommandEmpty
    className={cn(
      "hidden group-data-[state=empty]/composer-command-list:flex",
      // Shown only when nothing matches, where it acts as the single highlighted
      // option whose selection dismisses — so it carries the highlight styling.
      "items-center gap-2 rounded-lg bg-primary-hover px-3 h-8 text-sm text-ink-primary",
      className,
    )}
    {...props}
  />
);

const ComposerCommandDismiss = ({
  className,
  ...props
}: ComponentProps<typeof ComposerPrimitive.CommandDismiss>) => (
  <ComposerPrimitive.CommandDismiss
    className={cn("cursor-pointer text-ink-tertiary hover:text-ink-primary", className)}
    {...props}
  />
);

type ComposerCommandItemProps = ComponentProps<typeof ComposerPrimitive.CommandItem>;

const ComposerCommandItem = ({ className, ...props }: ComposerCommandItemProps) => (
  <ComposerPrimitive.CommandItem
    className={cn(
      "flex w-full items-center rounded-lg gap-2.5 px-3 h-8 text-sm text-ink-primary cursor-pointer data-highlighted:bg-primary-hover",
      className,
    )}
    {...props}
  />
);

const ComposerCommandItemIcon = ({
  className,
  ...props
}: ComponentProps<typeof ComposerPrimitive.CommandItemIcon>) => (
  <ComposerPrimitive.CommandItemIcon
    className={cn(
      "inline-flex size-4 items-center justify-center text-ink-tertiary [&>svg]:size-4",
      className,
    )}
    {...props}
  />
);

const ComposerCommandItemLabel = ({
  className,
  ...props
}: ComponentProps<typeof ComposerPrimitive.CommandItemLabel>) => (
  <ComposerPrimitive.CommandItemLabel className={cn("text-sm", className)} {...props} />
);

const ComposerCommandItemDescription = ({
  className,
  ...props
}: ComponentProps<typeof ComposerPrimitive.CommandItemDescription>) => (
  <ComposerPrimitive.CommandItemDescription
    className={cn("text-xs text-ink-tertiary truncate", className)}
    {...props}
  />
);

const ComposerCommandGroup = ComposerPrimitive.CommandGroup;

const ComposerCommandGroupLabel = ({
  className,
  ...props
}: ComponentProps<typeof ComposerPrimitive.CommandGroupLabel>) => (
  <ComposerPrimitive.CommandGroupLabel
    className={cn("px-2 pt-2 pb-1 text-xs font-medium text-ink-tertiary", className)}
    {...props}
  />
);

const ComposerCommandCollection = ComposerPrimitive.CommandCollection;

// Default render for all registered command lists — one styled CommandList per
// registered prefix with the icon + label + description row.
type ComposerCommandsProps = {
  className?: string;
};

const ComposerCommands = ({ className }: ComposerCommandsProps) => {
  const commands = useComposerCommandsMap();
  const prefixes = Object.keys(commands);

  return (
    <>
      {prefixes.map((prefix) => (
        <ComposerCommandList key={prefix} prefix={prefix} className={className}>
          <ComposerCommandLoading />
          <ComposerCommandEmpty>
            <span>No results found</span>
            <ComposerCommandDismiss />
          </ComposerCommandEmpty>
          <ComposerCommandItems>
            {(item) => (
              <ComposerCommandItem value={item.value}>
                {item.icon && (
                  <ComposerCommandItemIcon>{CHIP_ICONS[item.icon]}</ComposerCommandItemIcon>
                )}
                <ComposerCommandItemLabel>{item.label}</ComposerCommandItemLabel>
                {item.description && (
                  <ComposerCommandItemDescription>
                    {item.description}
                  </ComposerCommandItemDescription>
                )}
              </ComposerCommandItem>
            )}
          </ComposerCommandItems>
        </ComposerCommandList>
      ))}
    </>
  );
};

// ---------------------------------------------------------------------------
// AskUser (with sub-Parts) — default render for the ask-user flow registered
// via the `questions` prop on Composer Root.
// ---------------------------------------------------------------------------

const ComposerAskUser = () => {
  const askUser = useComposer((composer) => composer.askUser);

  const question = askUser.questions?.[askUser.step] ?? null;
  const lastQuestionRef = useRef(question);
  if (question) lastQuestionRef.current = question;
  const display = question ?? lastQuestionRef.current;

  if (!display) return null;

  const entry = askUser.answers.get(askUser.step) ?? {
    selected: new Set<string>(),
    freeText: "",
  };

  const totalQuestions = askUser.questions?.length ?? 0;

  return (
    <AskUser>
      <AskUser.Header>
        <AskUser.Label>{display.question}</AskUser.Label>
        {!askUser.isSingle && totalQuestions > 1 && (
          <AskUser.Navigation>
            <AskUser.Previous onClick={askUser.goBack} disabled={askUser.step === 0} />
            <AskUser.StepLabel current={askUser.step + 1} total={totalQuestions} />
            <AskUser.Next onClick={askUser.goNext} disabled={askUser.step === totalQuestions - 1} />
          </AskUser.Navigation>
        )}
      </AskUser.Header>
      {display.options && (
        <AskUser.Options
          ref={askUser.optionsRef}
          multiSelect={!!display.multiSelect}
          groupName={`q-${askUser.step}`}
          value={[...entry.selected][0] ?? ""}
          onValueChange={askUser.toggleOption}
        >
          {display.options.map((option) => (
            <AskUser.Option
              key={option.label}
              value={option.label}
              selected={entry.selected.has(option.label)}
              onSelect={() => askUser.toggleOption(option.label)}
            >
              <AskUser.OptionInput />
              <AskUser.OptionContent>
                <AskUser.OptionLabel>{option.label}</AskUser.OptionLabel>
                {option.description && (
                  <AskUser.OptionDescription>{option.description}</AskUser.OptionDescription>
                )}
              </AskUser.OptionContent>
            </AskUser.Option>
          ))}
        </AskUser.Options>
      )}
    </AskUser>
  );
};

const ComposerAskUserHints = ({ className, ...props }: ComponentProps<typeof AskUser.Hints>) => {
  const askUser = useComposer((composer) => composer.askUser);
  const totalQuestions = askUser.questions?.length ?? 0;

  return (
    <AskUser.Hints className={cn("flex-1", className)} {...props}>
      <span className="inline-flex items-center gap-1">
        <Kbd size="sm">↑</Kbd>
        <Kbd size="sm">↓</Kbd> navigate
      </span>
      <span className="inline-flex items-center gap-1">
        <Kbd size="sm">↵</Kbd> select
      </span>
      {!askUser.isSingle && totalQuestions > 1 && (
        <span className="inline-flex items-center gap-1">
          <Kbd size="sm">←</Kbd>
          <Kbd size="sm">→</Kbd> between questions
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <Kbd size="sm">esc</Kbd> skip
      </span>
    </AskUser.Hints>
  );
};

type ComposerAskUserDismissProps = ComponentProps<typeof Button>;

const ComposerAskUserDismiss = ({ className, ...props }: ComposerAskUserDismissProps) => {
  const askUser = useComposer((composer) => composer.askUser);
  return (
    <Button
      type="button"
      variant="ghost"
      data-slot="composer-ask-user-dismiss"
      className={cn("gap-2", className)}
      onClick={askUser.dismissStep}
      {...props}
    >
      Dismiss
      <Kbd size="sm">ESC</Kbd>
    </Button>
  );
};

type ComposerAskUserContinueProps = ComponentProps<typeof Button>;

const ComposerAskUserContinue = ({ className, ...props }: ComposerAskUserContinueProps) => {
  const askUser = useComposer((composer) => composer.askUser);
  return (
    <Button
      type="submit"
      variant="tertiary"
      data-slot="composer-ask-user-continue"
      className={cn("gap-2", className)}
      {...props}
    >
      {askUser.isLastStep ? "Submit" : "Continue"}
      <Kbd size="sm">↵</Kbd>
    </Button>
  );
};

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Composer = Object.assign(ComposerRoot, {
  Provider: ComposerPrimitive.Provider,
  Container: ComposerContainer,
  Attachments: ComposerAttachments,
  AttachmentTrigger: ComposerAttachmentTrigger,
  ContextWindow: ComposerContextWindow,
  Actions: ComposerActions,
  Placeholder: ComposerPlaceholder,
  Submit: ComposerSubmit,
  Panel: ComposerPanel,
  PanelItem: ComposerPanelItem,
  Textarea: ComposerTextarea,
  AskUser: ComposerAskUser,
  AskUserHints: ComposerAskUserHints,
  AskUserDismiss: ComposerAskUserDismiss,
  AskUserContinue: ComposerAskUserContinue,
  Commands: ComposerCommands,
  CommandList: ComposerCommandList,
  CommandItems: ComposerCommandItems,
  CommandLoading: ComposerCommandLoading,
  CommandEmpty: ComposerCommandEmpty,
  CommandDismiss: ComposerCommandDismiss,
  CommandItem: ComposerCommandItem,
  CommandItemIcon: ComposerCommandItemIcon,
  CommandItemLabel: ComposerCommandItemLabel,
  CommandItemDescription: ComposerCommandItemDescription,
  CommandGroup: ComposerCommandGroup,
  CommandGroupLabel: ComposerCommandGroupLabel,
  CommandCollection: ComposerCommandCollection,
});
