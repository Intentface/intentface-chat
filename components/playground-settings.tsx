"use client";
import { Monitor, Moon, Settings as SettingsIcon, Sun, X } from "@keyline-icons/react";

// Playground settings — a Linear-style floating sidebar docked in the chat
// area's top-right corner, on every chat page. Opening it pushes the chat over
// rather than covering it. Three tabs: Theme / Chat / Key. Configuration
// persists via the settings store; demo triggers (ask-user questions, the
// context strip) are ephemeral playground-store state. The visitor's OpenAI key
// deliberately persists nowhere client-side — see KeyTab. Desktop-only.

import { Tabs } from "@base-ui/react/tabs";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { ComposerSubmitOn } from "@/components/ai/composer";
import type { ThreadAutoScrollMode } from "@/components/ai/thread";
import Button from "@/components/ui/button";
import { ColorPill } from "@/components/ui/color-pill";
import { IconButton } from "@/components/ui/icon-button";
import Input from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { PresetSwatch } from "@/components/ui/preset-swatch";
import Select from "@/components/ui/select";
import { Settings } from "@/components/ui/settings";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { useApiKey } from "@/hooks/use-api-key";
import { type InterfaceThemeMode, useInterfaceTheme } from "@/hooks/use-interface-theme";
import { useMeasure } from "@/hooks/use-measure";
import {
  CONTRAST_MAX,
  CONTRAST_MIN,
  CONTRAST_STEP,
  getPresetsForMode,
} from "@/lib/interface-theme";
import { multipleQuestions, singleQuestion } from "@/lib/playground-demo";
import { usePlaygroundStore } from "@/lib/store/playground";
import { type CommandSurface, useSettingsStore } from "@/lib/store/settings";
import { cn } from "@/lib/utils";

// Right-aligned compact selects share one footprint across the rows.
const COMPACT_CONTROL_CLASS = "h-7 w-[8.5rem] shrink-0";

const PLAYGROUND_ROW_CLASS = "min-h-14 border-0 px-3.5 py-2.5";

// Label (with optional description) and control on one row.
const LabeledRow = ({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) => (
  <Settings.Row className={cn(PLAYGROUND_ROW_CLASS, "items-center gap-3")}>
    <Settings.LabelGroup>
      <Settings.Label>{label}</Settings.Label>
      {description && <Settings.Description>{description}</Settings.Description>}
    </Settings.LabelGroup>
    <Settings.Control className="w-auto shrink-0">{children}</Settings.Control>
  </Settings.Row>
);

// Divider-separated group inside a tab panel.
const SettingsSection = ({ children }: { children: ReactNode }) => (
  <div className="border-ink-primary/6 border-b py-1 last:border-0">{children}</div>
);

// Inline boolean row. The Settings.Label span carries no id, so the switch
// names itself. A command prefix character renders as a keycap badge before
// the label ("[@] mentions").
const ToggleRow = ({
  label,
  prefix,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  prefix?: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <Settings.Row className={cn(PLAYGROUND_ROW_CLASS, "items-center gap-3")}>
    <Settings.LabelGroup>
      <Settings.Label className="flex items-center gap-1.5">
        {prefix && <Kbd size="md">{prefix}</Kbd>}
        {label}
      </Settings.Label>
      {description && <Settings.Description>{description}</Settings.Description>}
    </Settings.LabelGroup>
    <Settings.Control className="w-auto shrink-0">
      <Switch
        aria-label={prefix ? `${prefix} ${label}` : label}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </Settings.Control>
  </Settings.Row>
);

// ---------------------------------------------------------------------------
// Theme tab — the full theme configuration (formerly the ThemeConfigurator
// dialog), driven by use-interface-theme.
// ---------------------------------------------------------------------------

const CUSTOM_PRESET_VALUE = "__custom__";

const MODE_OPTIONS: ReadonlyArray<{
  value: InterfaceThemeMode;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

const ThemeTab = () => {
  const { mode, resolvedMode, setMode, seeds, setSeed, preset, setPreset } = useInterfaceTheme();

  const presets = getPresetsForMode(resolvedMode);
  const selectedPresetValue = preset ? preset.label : CUSTOM_PRESET_VALUE;

  const handlePresetChange = (value: string | null) => {
    if (!value || value === CUSTOM_PRESET_VALUE) return;
    const next = presets.find((option) => option.label === value);
    if (next) setPreset(next);
  };

  const handleModeChange = (next: InterfaceThemeMode | null) => {
    if (next) setMode(next);
  };

  return (
    <div className="py-1">
      <LabeledRow label="Mode" description="Light, dark or system.">
        <ToggleGroup
          variant="segmented"
          value={mode}
          onValueChange={handleModeChange}
          className="w-fit"
        >
          {MODE_OPTIONS.map(({ value, label, Icon }) => (
            <ToggleGroup.Item key={value} value={value} size="xs" aria-label={label}>
              <Icon className="size-3.5" />
            </ToggleGroup.Item>
          ))}
        </ToggleGroup>
      </LabeledRow>

      <LabeledRow label="Preset" description="A starting palette.">
        <Select value={selectedPresetValue} onValueChange={handlePresetChange}>
          <Select.Trigger className={cn(COMPACT_CONTROL_CLASS, "pr-1.5 pl-[5px]")} size="sm">
            <Select.Value>
              <div className="flex items-center gap-1.5">
                <PresetSwatch seeds={seeds} />
                <span>{preset?.label ?? "Custom"}</span>
              </div>
            </Select.Value>
          </Select.Trigger>
          <Select.Content>
            {!preset && (
              <Select.Item value={CUSTOM_PRESET_VALUE}>
                <PresetSwatch seeds={seeds} />
                <span>Custom</span>
              </Select.Item>
            )}
            {presets.map((option) => (
              <Select.Item key={option.label} value={option.label}>
                <PresetSwatch seeds={option.seeds} />
                <span>{option.label}</span>
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </LabeledRow>

      <LabeledRow label="Accent" description="Buttons, links and focus.">
        <ColorPill
          size="compact"
          value={seeds.acc}
          onValueChange={(value) => setSeed("acc", value)}
        />
      </LabeledRow>

      <LabeledRow label="Background" description="Surfaces derive from it.">
        <ColorPill
          size="compact"
          value={seeds.bg}
          onValueChange={(value) => setSeed("bg", value)}
        />
      </LabeledRow>

      <LabeledRow label="Foreground" description="Text and icons.">
        <ColorPill
          size="compact"
          value={seeds.fg}
          onValueChange={(value) => setSeed("fg", value)}
        />
      </LabeledRow>

      <LabeledRow label="Contrast" description="Surface separation.">
        <Slider
          aria-label="Contrast"
          className="w-[6.5rem]"
          value={seeds.con}
          onValueChange={(value) => {
            if (typeof value === "number") setSeed("con", value);
          }}
          min={CONTRAST_MIN}
          max={CONTRAST_MAX}
          step={CONTRAST_STEP}
        >
          <Slider.Control>
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb aria-label="Contrast" />
            </Slider.Track>
          </Slider.Control>
        </Slider>
      </LabeledRow>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Thread tab — auto-scroll behavior and thread chrome.
// ---------------------------------------------------------------------------

const SCROLL_MODE_OPTIONS: ReadonlyArray<{ value: ThreadAutoScrollMode; label: string }> = [
  { value: "follow", label: "Follow" },
  { value: "jump", label: "Jump to top" },
  { value: "bottom", label: "Bottom" },
  { value: "off", label: "Off" },
];

const ThreadTab = () => {
  const scrollMode = useSettingsStore((state) => state.scrollMode);
  const setScrollMode = useSettingsStore((state) => state.setScrollMode);
  const showScrollButton = useSettingsStore((state) => state.showScrollButton);
  const setShowScrollButton = useSettingsStore((state) => state.setShowScrollButton);
  const showOverlays = useSettingsStore((state) => state.showOverlays);
  const setShowOverlays = useSettingsStore((state) => state.setShowOverlays);

  return (
    <div className="py-1">
      <LabeledRow label="Auto-scroll" description="How new turns land and follow">
        <Select
          value={scrollMode}
          onValueChange={(value: ThreadAutoScrollMode | null) => {
            if (value) setScrollMode(value);
          }}
        >
          <Select.Trigger className={COMPACT_CONTROL_CLASS} size="sm">
            <Select.Value>
              {SCROLL_MODE_OPTIONS.find((option) => option.value === scrollMode)?.label}
            </Select.Value>
          </Select.Trigger>
          <Select.Content>
            {SCROLL_MODE_OPTIONS.map((option) => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </LabeledRow>
      <ToggleRow
        label="Scroll button"
        description="Jump-to-bottom affordance"
        checked={showScrollButton}
        onCheckedChange={setShowScrollButton}
      />
      <ToggleRow
        label="Edge fades"
        description="Top and bottom fade overlays"
        checked={showOverlays}
        onCheckedChange={setShowOverlays}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Composer tab — command config, booleans, and demo triggers.
// ---------------------------------------------------------------------------

const SUBMIT_OPTIONS: ReadonlyArray<{ value: ComposerSubmitOn; label: string }> = [
  { value: "enter", label: "Enter" },
  { value: "shift-enter", label: "Shift+Enter" },
];

const COMMAND_SURFACE_OPTIONS: ReadonlyArray<{ value: CommandSurface; label: string }> = [
  { value: "panel", label: "Panel" },
  { value: "popover", label: "Popover" },
];

const ComposerTab = () => {
  const commands = useSettingsStore((state) => state.commands);
  const setCommandEnabled = useSettingsStore((state) => state.setCommandEnabled);
  const commandSurface = useSettingsStore((state) => state.commandSurface);
  const setCommandSurface = useSettingsStore((state) => state.setCommandSurface);
  const suggestions = useSettingsStore((state) => state.suggestions);
  const setSuggestions = useSettingsStore((state) => state.setSuggestions);
  const loopingPlaceholder = useSettingsStore((state) => state.loopingPlaceholder);
  const setLoopingPlaceholder = useSettingsStore((state) => state.setLoopingPlaceholder);
  const submitOn = useSettingsStore((state) => state.submitOn);
  const setSubmitOn = useSettingsStore((state) => state.setSubmitOn);
  const setDemoQuestions = usePlaygroundStore((state) => state.setDemoQuestions);
  const showContextStrip = usePlaygroundStore((state) => state.showContextStrip);
  const setShowContextStrip = usePlaygroundStore((state) => state.setShowContextStrip);

  return (
    <>
      <SettingsSection>
        <LabeledRow label="Command surface" description="In-flow panel or floating popover">
          <Select
            value={commandSurface}
            onValueChange={(value: CommandSurface | null) => {
              if (value) setCommandSurface(value);
            }}
          >
            <Select.Trigger className={COMPACT_CONTROL_CLASS} size="sm">
              <Select.Value>
                {COMMAND_SURFACE_OPTIONS.find((option) => option.value === commandSurface)?.label}
              </Select.Value>
            </Select.Trigger>
            <Select.Content>
              {COMMAND_SURFACE_OPTIONS.map((option) => (
                <Select.Item key={option.value} value={option.value}>
                  {option.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </LabeledRow>
        <LabeledRow label="Submit key" description="Which Enter chord sends">
          <Select
            value={submitOn}
            onValueChange={(value: ComposerSubmitOn | null) => {
              if (value) setSubmitOn(value);
            }}
          >
            <Select.Trigger className={COMPACT_CONTROL_CLASS} size="sm">
              <Select.Value>
                {SUBMIT_OPTIONS.find((option) => option.value === submitOn)?.label}
              </Select.Value>
            </Select.Trigger>
            <Select.Content>
              {SUBMIT_OPTIONS.map((option) => (
                <Select.Item key={option.value} value={option.value}>
                  {option.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </LabeledRow>
      </SettingsSection>
      <SettingsSection>
        <ToggleRow
          label="mentions"
          prefix="@"
          description="Insert mention chips"
          checked={commands.mentions}
          onCheckedChange={(checked) => setCommandEnabled("mentions", checked)}
        />
        <ToggleRow
          label="commands"
          prefix="/"
          description="Execute tool toggles"
          checked={commands.slash}
          onCheckedChange={(checked) => setCommandEnabled("slash", checked)}
        />
        <ToggleRow
          label="issues"
          prefix="#"
          description="Async grouped demo list"
          checked={commands.issues}
          onCheckedChange={(checked) => setCommandEnabled("issues", checked)}
        />
        <ToggleRow
          label="Suggestions"
          description="Inline ghost completion"
          checked={suggestions}
          onCheckedChange={setSuggestions}
        />
        <ToggleRow
          label="Looping placeholder"
          description="Rotate prompt ideas when empty"
          checked={loopingPlaceholder}
          onCheckedChange={setLoopingPlaceholder}
        />
        <ToggleRow
          label="Context strip"
          description="Demo workspace files"
          checked={showContextStrip}
          onCheckedChange={setShowContextStrip}
        />
      </SettingsSection>
      <SettingsSection>
        <Settings.Row className={cn(PLAYGROUND_ROW_CLASS, "items-center gap-3")}>
          <Settings.LabelGroup>
            <Settings.Label>Ask user</Settings.Label>
            <Settings.Description>Fire a demo question flow</Settings.Description>
          </Settings.LabelGroup>
          <Settings.Control className="w-auto gap-1.5">
            <Button size="xs" variant="primary" onClick={() => setDemoQuestions(singleQuestion)}>
              Single
            </Button>
            <Button size="xs" variant="primary" onClick={() => setDemoQuestions(multipleQuestions)}>
              Multi
            </Button>
          </Settings.Control>
        </Settings.Row>
      </SettingsSection>
    </>
  );
};

// ---------------------------------------------------------------------------
// The trigger + tabbed popover, floating in the chat area's top-right.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Key — the visitor's own OpenAI key. There is no server key, so this is what
// makes the chat work at all. The value goes into an HttpOnly cookie and never
// comes back out, so this tracks presence only and can never render the key.
// ---------------------------------------------------------------------------

const KeyTab = () => {
  const { isSet, isLoading, isSubmitting, error, save, clear } = useApiKey();

  // Ephemeral and deliberately local: the draft briefly holds the key itself, so
  // it must not reach a store that persists to localStorage.
  const [draft, setDraft] = useState("");

  const handleSave = async () => {
    if (await save(draft)) setDraft("");
  };

  return (
    <div>
      <SettingsSection>
        {isSet ? (
          <LabeledRow label="OpenAI API key" description="Set on this device.">
            <Button
              variant="primary"
              onClick={clear}
              disabled={isSubmitting}
              aria-label="Clear the stored OpenAI API key"
            >
              Clear
            </Button>
          </LabeledRow>
        ) : (
          <div className="flex flex-col gap-2 px-3.5 py-2.5">
            <Settings.LabelGroup>
              <Settings.Label>OpenAI API key</Settings.Label>
              <Settings.Description>
                {isLoading ? "Checking…" : "The playground runs on your own key."}
              </Settings.Description>
            </Settings.LabelGroup>
            <div className="flex items-center gap-2">
              <Input
                type="password"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="sk-…"
                autoComplete="off"
                spellCheck={false}
                aria-label="OpenAI API key"
                aria-invalid={error ? true : undefined}
                className="flex-1"
              />
              <Button
                size="md"
                onClick={handleSave}
                disabled={isSubmitting || draft.trim().length === 0}
              >
                Save
              </Button>
            </div>
          </div>
        )}
        {/* Outside the branches on purpose: clear() runs from the is-set side, so
            an error rendered only in the not-set branch could never be seen. */}
        {error && <p className="px-3.5 pb-2 text-red-600 text-xs dark:text-red-400">{error}</p>}
      </SettingsSection>
      <p className="px-3.5 py-2.5 text-ink-secondary text-xs leading-[18px]">
        Your key is sent to this site's server to forward each request to OpenAI, and is kept only
        for the length of that request — never written to disk or logged. It is stored in your
        browser in a cookie that scripts cannot read.{" "}
        <a
          href="https://github.com/Intentface/intentface-chat/blob/main/app/api/chat/route.ts"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-ink-secondary"
        >
          Read the code
        </a>
        .
      </p>
    </div>
  );
};

// Thread and composer options share one tab: both shape the chat itself.
const ChatTab = () => (
  <>
    <SettingsSection>
      <ThreadTab />
    </SettingsSection>
    <ComposerTab />
  </>
);

const PLAYGROUND_TABS = [
  { value: "theme", label: "Theme", content: <ThemeTab /> },
  { value: "chat", label: "Chat", content: <ChatTab /> },
  { value: "key", label: "Key", content: <KeyTab /> },
] as const;

type PlaygroundTabValue = (typeof PLAYGROUND_TABS)[number]["value"];

// One spring for the card's height and the panels' travel, so everything settles
// together. bounce: 0 keeps a settings panel from wobbling.
const PANEL_SPRING = { duration: 0.5, type: "spring", bounce: 0 } as const;

// Panels travel the way the tabs do: picking a tab to the right slides the old
// panel out to the left and the new one in from the right. Percentages of the
// panel's own width, so a panel is clear of the frame before it lands.
const panelVariants = {
  initial: (direction: number) => ({ x: `${110 * direction}%`, opacity: 0 }),
  active: { x: "0%", opacity: 1 },
  exit: (direction: number) => ({ x: `${-110 * direction}%`, opacity: 0 }),
};

/**
 * The gear trigger plus the docked card. Rendered as a flex sibling of the
 * thread: the slot animates its width so the chat column narrows and re-centres
 * instead of sitting under the card. The card stays mounted (inert while closed)
 * and slides in from the right edge, where the viewport clips it.
 */
export const PlaygroundSettings = () => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const panelId = useId();

  // The panels differ in height, so the card animates to the measured content.
  // Because it is a ResizeObserver, content that grows *inside* a tab (the key
  // form revealing a validation error) animates too, not just switches.
  const [panelRef, { height }] = useMeasure<HTMLDivElement>();

  // Controlled rather than defaultValue: the slide needs to know which way the
  // active tab moved, which means knowing the previous one.
  const [activeTab, setActiveTab] = useState<PlaygroundTabValue>("theme");
  const [direction, setDirection] = useState(1);

  const handleTabChange = (value: unknown) => {
    const next = value as PlaygroundTabValue;
    const from = PLAYGROUND_TABS.findIndex((tab) => tab.value === activeTab);
    const to = PLAYGROUND_TABS.findIndex((tab) => tab.value === next);
    setDirection(to > from ? 1 : -1);
    setActiveTab(next);
  };

  // Focus follows the toggle: into the card on open, back to the gear on close.
  // preventScroll: the card starts off-screen, and a plain focus() would scroll
  // the clipped viewport sideways to reveal it.
  const show = () => {
    flushSync(() => setOpen(true));
    cardRef.current?.focus({ preventScroll: true });
  };
  const hide = () => {
    flushSync(() => setOpen(false));
    triggerRef.current?.focus({ preventScroll: true });
  };

  const activePanel = PLAYGROUND_TABS.find((tab) => tab.value === activeTab);

  return (
    <>
      <IconButton
        ref={triggerRef}
        variant="primary"
        aria-label="Playground settings"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={show}
        className={cn(
          "absolute top-3 right-3 z-20 hidden transition-[opacity,visibility] duration-200 md:inline-flex",
          open && "invisible opacity-0",
        )}
      >
        <SettingsIcon />
      </IconButton>
      <div
        data-slot="playground-settings"
        data-open={open ? "" : undefined}
        className="relative hidden w-0 shrink-0 transition-[width] duration-200 ease-out data-open:w-[328px] motion-reduce:transition-none md:block"
      >
        <aside
          ref={cardRef}
          id={panelId}
          tabIndex={-1}
          aria-label="Playground settings"
          inert={!open}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !event.defaultPrevented) hide();
          }}
          className={cn(
            "absolute top-3 right-3 z-20 flex w-[304px] flex-col overflow-hidden rounded-2xl bg-primary-bg shadow-card outline-none",
            "transition-transform duration-200 ease-out motion-reduce:transition-none",
            open ? "translate-x-0" : "pointer-events-none translate-x-[calc(100%+1rem)]",
          )}
        >
          <Tabs.Root value={activeTab} onValueChange={handleTabChange}>
            <div className="flex items-center gap-1.5 p-2 shadow-[inset_0_-1px_0_color-mix(in_oklab,var(--color-ink-primary)_6%,transparent)]">
              <Tabs.List className="flex flex-1 gap-0.5 rounded-full bg-base-bg p-0.5">
                {PLAYGROUND_TABS.map((tab) => (
                  <Tabs.Tab
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      "flex h-7 flex-1 cursor-pointer items-center justify-center rounded-full font-medium text-ink-secondary text-sm transition-[color,background-color,box-shadow]",
                      "hover:text-ink-primary focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-1",
                      "data-active:bg-raised data-active:text-ink-primary data-active:shadow-raised",
                    )}
                  >
                    {tab.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
              <IconButton variant="ghost" aria-label="Close settings" onClick={hide}>
                <X />
              </IconButton>
            </div>
            <MotionConfig transition={PANEL_SPRING}>
              <motion.div
                initial={false}
                animate={{ height: height || "auto" }}
                className="overflow-hidden"
              >
                <div ref={panelRef} className="relative">
                  <Tabs.Panel value={activeTab}>
                    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                      <motion.div
                        key={activeTab}
                        variants={panelVariants}
                        initial="initial"
                        animate="active"
                        exit="exit"
                        custom={direction}
                        className="py-1"
                      >
                        {activePanel?.content}
                      </motion.div>
                    </AnimatePresence>
                  </Tabs.Panel>
                </div>
              </motion.div>
            </MotionConfig>
          </Tabs.Root>
        </aside>
      </div>
    </>
  );
};
