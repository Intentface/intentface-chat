"use client";

// Styled composer — thin wrappers over @intentface/chat/composer. Behavior
// (editor, store, machines, command plumbing) lives in the package; this file
// carries the Tailwind classes, icons, and motion, and re-exports the public
// surface so consumers keep importing from "@/components/ai/composer".

import {
  type CommandItemData as CommandItemDataPrimitive,
  Composer as ComposerPrimitive,
  type ComposerStore,
  useComposer,
  useComposerController,
  useComposerStore,
  useComposerSubmit,
} from "@intentface/chat/composer";
import { AnimatePresence, motion } from "motion/react";
import { Children, type ComponentProps, type ReactNode, useMemo, useRef } from "react";
import { AskUser } from "@/components/ai/ask-user";
import { Attachments } from "@/components/ai/attachments";
import { Chip } from "@/components/ai/chip";
import { SendIcon } from "@/components/icons/send";
import { StopIcon } from "@/components/icons/stop";
import Button from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { useLoop } from "@/hooks/use-loop";
import { useMeasure } from "@/hooks/use-measure";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_FILE_SIZE,
  ATTACHMENT_MAX_FILES,
} from "@/lib/ai/attachments";
import { CHIP_ICONS, type ChipIconKey, isChipIconKey } from "@/lib/ai/chip-icons";
import { cn } from "@/lib/utils";

export { useComposer, useComposerController, useComposerStore };
export type { ComposerStore };

// The wire format carries the icon as an opaque string; this app's command
// items narrow it to the concrete union so CHIP_ICONS indexing stays typed.
export type CommandItemData = Omit<CommandItemDataPrimitive, "icon"> & {
  icon?: ChipIconKey;
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
  <ComposerPrimitive className={cn("relative w-full flex flex-col", className)} {...props} />
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

// The primitive imposes no policy; this app's accept/limits are applied here.
const ComposerAttachments = ({
  className,
  accept = ATTACHMENT_ACCEPT,
  maxFiles = ATTACHMENT_MAX_FILES,
  maxFileSize = ATTACHMENT_MAX_FILE_SIZE,
  ...props
}: ComposerAttachmentsProps) => {
  const attachments = useComposer((composer) => composer.attachments);

  return (
    <ComposerPrimitive.Attachments
      accept={accept}
      maxFiles={maxFiles}
      maxFileSize={maxFileSize}
      {...props}
    >
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
      <Attachments.Error code={attachments.error} />
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
    // The wire format carries the icon as an opaque string; narrow it to this
    // app's concrete keys here — unknown values fall back to no icon.
    renderChip={(chip) => {
      const icon = chip.icon && isChipIconKey(chip.icon) ? CHIP_ICONS[chip.icon] : undefined;
      return (
        <Chip>
          {icon && <Chip.Icon>{icon}</Chip.Icon>}
          <Chip.Label>{chip.label}</Chip.Label>
        </Chip>
      );
    }}
    className={cn(
      "max-h-32 min-h-8 overflow-y-auto py-2 px-3 text-md",
      "mask-[linear-gradient(to_bottom,transparent,black_16px,black_calc(100%-16px),transparent)]",
      // The editor element — ProseMirror-owned DOM, out of JSX reach.
      "**:data-[slot=composer-editor]:w-full **:data-[slot=composer-editor]:max-w-none **:data-[slot=composer-editor]:font-book **:data-[slot=composer-editor]:leading-[1.7] [&_[data-slot=composer-editor]:focus]:outline-none",
      // Active-prefix badge: same inline text-flow surface as a committed chip
      // (CHIP_SURFACE_CLASS in chip.tsx) so the badge and the chip it becomes
      // share one baseline — no jump on commit.
      "**:data-command-badge:box-decoration-clone **:data-command-badge:inline **:data-command-badge:rounded-sm **:data-command-badge:px-0.75 **:data-command-badge:py-0.5 **:data-command-badge:align-baseline **:data-command-badge:font-book **:data-command-badge:leading-[inherit] **:data-command-badge:whitespace-nowrap **:data-command-badge:bg-primary-hover **:data-command-badge:text-ink-primary",
      // Type-to-filter hint while the command query is empty.
      "[&_[data-command-placeholder]::after]:content-['Type_to_filter'] [&_[data-command-placeholder]::after]:pointer-events-none [&_[data-command-placeholder]::after]:whitespace-nowrap [&_[data-command-placeholder]::after]:text-ink-tertiary",
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
  // Rotation lives here, in the styled layer — the headless Composer.Placeholder
  // just renders content. Resolve the items and loop over the string ones.
  const items = useMemo<ReactNode[]>(() => {
    if (placeholder !== undefined) return Array.isArray(placeholder) ? placeholder : [placeholder];
    if (children) return Children.toArray(children);
    return [];
  }, [placeholder, children]);

  const isLooping = items.length > 1;
  const loopItems = useMemo(
    () => items.map((item) => (typeof item === "string" ? item : "")),
    [items],
  );
  const { currentItem, key } = useLoop(loopItems);

  if (!isLooping && items.length === 1) {
    return (
      <div className={cn("min-h-lh text-ink-tertiary font-book leading-[1.7]", className)}>
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
          className={cn("text-ink-tertiary font-book leading-[1.7]", className)}
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
// Panel — an in-flow surface card. The primitive always renders the outer host
// and hands us `open` (non-empty content) as the render's second arg. Because
// that host is always mounted, the AnimatePresence inside it stays put and can
// watch the card mount/unmount as `open` flips — so open and close both animate.
// The measured inner div drives the card's height between content changes.
// ---------------------------------------------------------------------------

type ComposerPanelProps = Omit<ComponentProps<typeof ComposerPrimitive.Panel>, "render">;

const ComposerPanel = ({ className, ...props }: ComposerPanelProps) => {
  const [contentRef, bounds] = useMeasure();

  return (
    <ComposerPrimitive.Panel
      {...props}
      className="relative"
      render={({ children: content, ...elementProps }, state) => (
        <div {...elementProps}>
          <AnimatePresence mode="popLayout" initial={false}>
            {state.open && (
              <motion.div
                // justify-end pins the content to the bottom of the clipping box,
                // so height changes reveal/hide at the top and the bottom stays put.
                className={cn("absolute inset-x-0 bottom-2 overflow-hidden", className)}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: bounds.height, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.15 }}
              >
                <div
                  ref={contentRef}
                  className="rounded-4xl border border-primary-border bg-primary [corner-shape:squircle]"
                >
                  {content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    />
  );
};

// ---------------------------------------------------------------------------
// Popover — the floating alternative to a Panel. Takes the same CommandList
// children but lifts them into a portal above the field, anchored to the active
// command badge. Content-driven like Panel (no `open` prop): the primitive opens
// while it has children, and exposes data-open/data-closed for the enter/exit
// animation below — same approach as ContextWindow's data-visible.
// ---------------------------------------------------------------------------

type ComposerPopoverProps = ComponentProps<typeof ComposerPrimitive.Popover>;

const ComposerPopover = ({ className, ...props }: ComposerPopoverProps) => {
  return (
    <ComposerPrimitive.Popover
      className={cn(
        // Floating shell — same material as the in-flow panel, scaled down and
        // lifted above the anchor token with a stronger shadow. `fixed` is the
        // positioning context the primitive anchors within (it sets left/bottom);
        // z-50 keeps the portaled popover above the thread.
        "fixed z-50 mb-2 w-72 overflow-hidden border border-primary-border bg-primary rounded-4xl shadow-lg [corner-shape:squircle]",
        "transition-[opacity,transform,filter] duration-150 ease-out",
        "data-closed:opacity-0 data-closed:translate-y-1.5 data-closed:blur-[3px]",
        className,
      )}
      {...props}
    />
  );
};

// ---------------------------------------------------------------------------
// CommandList family
// ---------------------------------------------------------------------------

type ComposerCommandListProps = ComponentProps<typeof ComposerPrimitive.CommandList>;

const ComposerCommandList = ({ className, ...props }: ComposerCommandListProps) => (
  <ComposerPrimitive.CommandList
    className={cn(
      // Pure content — the host (a PanelItem card or the Popover) supplies the
      // surface material and positioning; this is just the scrollable list.
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
    className={cn("flex flex-col", "group-data-empty/composer-command-list:hidden", className)}
  >
    {children}
  </ComposerPrimitive.CommandItems>
);

const ComposerCommandLoading = ({
  className,
  children = "Loading…",
  ...props
}: ComponentProps<typeof ComposerPrimitive.CommandLoading>) => (
  <ComposerPrimitive.CommandLoading
    className={cn(
      "hidden group-data-loading/composer-command-list:flex",
      "items-center px-3 h-8 text-sm text-ink-tertiary",
      className,
    )}
    {...props}
  >
    {children}
  </ComposerPrimitive.CommandLoading>
);

const ComposerCommandEmpty = ({
  className,
  children = "No results found",
  ...props
}: ComponentProps<typeof ComposerPrimitive.CommandEmpty>) => (
  <ComposerPrimitive.CommandEmpty
    className={cn(
      "hidden group-data-empty/composer-command-list:flex",
      // Shown only when nothing matches, where it acts as the single highlighted
      // option whose selection dismisses — so it carries the highlight styling.
      "items-center gap-2 rounded-lg bg-primary-hover px-3 h-8 text-sm text-ink-primary",
      className,
    )}
    {...props}
  >
    {children}
  </ComposerPrimitive.CommandEmpty>
);

const ComposerCommandDismiss = ({
  className,
  children = "Dismiss",
  ...props
}: ComponentProps<typeof ComposerPrimitive.CommandDismiss>) => (
  <ComposerPrimitive.CommandDismiss
    className={cn("cursor-pointer text-ink-tertiary hover:text-ink-primary", className)}
    {...props}
  >
    {children}
  </ComposerPrimitive.CommandDismiss>
);

type ComposerCommandItemProps = ComponentProps<typeof ComposerPrimitive.CommandItem>;

const ComposerCommandItem = ({ className, ...props }: ComposerCommandItemProps) => (
  <ComposerPrimitive.CommandItem
    className={cn(
      // Radius is the popover's 16px (rounded-2xl) minus the 5px gap to its edge
      // (1px border + p-1) so the highlight corner stays concentric with it.
      "flex w-full items-center rounded-lg gap-2.5 px-3 h-8 text-sm font-book text-ink-primary cursor-pointer data-highlighted:bg-primary-hover",
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
  <ComposerPrimitive.CommandItemLabel className={cn("text-sm font-book", className)} {...props} />
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

// ---------------------------------------------------------------------------
// AskUser (with sub-Parts) — default render for the ask-user flow registered
// via the `questions` prop on Composer Root.
// ---------------------------------------------------------------------------

const ComposerAskUser = () => {
  const askUser = useComposer((composer) => composer.askUser);

  // Content only. The consumer gates the enclosing Panel on `askUser.active`;
  // this renders the question compound, or null when there are none. `display`
  // keeps the last question on screen through an exit animation.
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
            <AskUser.StepLabel>
              {({ current, total }) => `${current} of ${total} questions`}
            </AskUser.StepLabel>
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
    </Button>
  );
};

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Composer = Object.assign(ComposerRoot, {
  createStore: ComposerPrimitive.createStore,
  Container: ComposerContainer,
  Attachments: ComposerAttachments,
  AttachmentTrigger: ComposerAttachmentTrigger,
  ContextWindow: ComposerContextWindow,
  Actions: ComposerActions,
  Placeholder: ComposerPlaceholder,
  Submit: ComposerSubmit,
  Panel: ComposerPanel,
  Popover: ComposerPopover,
  Textarea: ComposerTextarea,
  AskUser: ComposerAskUser,
  AskUserHints: ComposerAskUserHints,
  AskUserDismiss: ComposerAskUserDismiss,
  AskUserContinue: ComposerAskUserContinue,
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
