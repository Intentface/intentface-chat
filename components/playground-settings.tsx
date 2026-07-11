"use client";

// Playground settings — a Linear-style display-options popover behind a single
// icon trigger in the chat area's top-right corner, on every chat page. The
// panel is split into three tabs (Theme / Thread / Composer), mirroring
// Linear's List/Board/Timeline switcher. Configuration persists via the
// settings store; demo triggers (ask-user questions, the context strip) are
// ephemeral playground-store state. Desktop-only — hidden below md.

import { Tabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";
import type { ComposerSubmitOn } from "@/components/ai/composer";
import type { ThreadAutoScrollMode } from "@/components/ai/thread";
import { AppearanceIcon } from "@/components/icons/appearance";
import { InputFormIcon } from "@/components/icons/input-form";
import { MoonIcon } from "@/components/icons/moon";
import { SettingsIcon } from "@/components/icons/settings";
import { SettingsSliderThreeIcon } from "@/components/icons/settings-slider-three";
import { SquareLinesIcon } from "@/components/icons/square-lines";
import { SunIcon } from "@/components/icons/sun";
import Button from "@/components/ui/button";
import { ColorPill } from "@/components/ui/color-pill";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { Popover } from "@/components/ui/popover";
import { PresetSwatch } from "@/components/ui/preset-swatch";
import { Scaler } from "@/components/ui/scaler";
import Select from "@/components/ui/select";
import { Settings } from "@/components/ui/settings";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { type InterfaceThemeMode, useInterfaceTheme } from "@/hooks/use-interface-theme";
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

// Right-aligned compact controls share one footprint across the rows.
const COMPACT_CONTROL_CLASS = "h-8 w-28 shrink-0";

const PLAYGROUND_ROW_CLASS = "min-h-11 border-0 px-3 py-2";

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
  <div className="border-b border-primary-border py-1 last:border-0">{children}</div>
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
  Icon: typeof SunIcon;
}> = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: AppearanceIcon },
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
      <LabeledRow label="Mode" description="Light, dark, or follow the system">
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

      <LabeledRow label="Preset" description="Pick a starter palette">
        <Select value={selectedPresetValue} onValueChange={handlePresetChange}>
          <Select.Trigger className={cn(COMPACT_CONTROL_CLASS, "rounded-md px-1")} size="sm">
            <Select.Value>
              <div className="flex items-center gap-2">
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

      <LabeledRow label="Accent" description="Buttons, links, and focus rings">
        <ColorPill
          size="compact"
          className={COMPACT_CONTROL_CLASS}
          value={seeds.acc}
          onValueChange={(value) => setSeed("acc", value)}
        />
      </LabeledRow>

      <LabeledRow label="Background" description="Workspace base color">
        <ColorPill
          size="compact"
          className={COMPACT_CONTROL_CLASS}
          value={seeds.bg}
          onValueChange={(value) => setSeed("bg", value)}
        />
      </LabeledRow>

      <LabeledRow label="Foreground" description="Workspace text color">
        <ColorPill
          size="compact"
          className={COMPACT_CONTROL_CLASS}
          value={seeds.fg}
          onValueChange={(value) => setSeed("fg", value)}
        />
      </LabeledRow>

      <LabeledRow label="Contrast" description="Surface elevation strength">
        <Scaler
          size="compact"
          className={COMPACT_CONTROL_CLASS}
          value={seeds.con}
          onValueChange={(value) => setSeed("con", value)}
          min={CONTRAST_MIN}
          max={CONTRAST_MAX}
          step={CONTRAST_STEP}
          tickStep={0.05}
        />
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
          <Select.Trigger className={cn(COMPACT_CONTROL_CLASS, "rounded-md")} size="sm">
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
            <Select.Trigger className={cn(COMPACT_CONTROL_CLASS, "rounded-md")} size="sm">
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
            <Select.Trigger className={cn(COMPACT_CONTROL_CLASS, "rounded-md")} size="sm">
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
            <Button size="xs" variant="secondary" onClick={() => setDemoQuestions(singleQuestion)}>
              Single
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => setDemoQuestions(multipleQuestions)}
            >
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

const PLAYGROUND_TABS = [
  { value: "theme", label: "Theme", Icon: SettingsSliderThreeIcon, content: <ThemeTab /> },
  { value: "thread", label: "Thread", Icon: SquareLinesIcon, content: <ThreadTab /> },
  { value: "composer", label: "Composer", Icon: InputFormIcon, content: <ComposerTab /> },
] as const;

export const PlaygroundSettings = () => (
  <div data-slot="playground-settings" className="absolute top-2 right-2 z-20 hidden md:block">
    <Popover>
      <Popover.Trigger
        render={
          <IconButton variant="primary" className="rounded-full" aria-label="Playground settings" />
        }
      >
        <SettingsIcon className="size-4" />
      </Popover.Trigger>
      <Popover.Content align="end" sideOffset={4} className="w-80 p-0">
        <Tabs.Root defaultValue="theme">
          <Tabs.List className="flex gap-2 border-b border-primary-border p-2">
            {PLAYGROUND_TABS.map((tab) => (
              <Tabs.Tab
                key={tab.value}
                value={tab.value}
                className={cn(
                  "flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full text-sm font-medium text-ink-secondary outline-none transition-colors border border-transparent",
                  "hover:bg-primary-bg-hover hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent-bg/50",
                  "data-active:bg-primary-bg-active data-active:text-ink-primary data-active:border-primary-border-active",
                  "[&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-ink-tertiary data-active:[&>svg]:text-ink-primary",
                )}
              >
                <tab.Icon />
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {PLAYGROUND_TABS.map((tab) => (
            <Tabs.Panel key={tab.value} value={tab.value}>
              {tab.content}
            </Tabs.Panel>
          ))}
        </Tabs.Root>
      </Popover.Content>
    </Popover>
  </div>
);
