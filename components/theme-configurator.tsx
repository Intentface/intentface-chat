"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { ColorPill } from "@/components/ui/color-pill";
import { Dialog } from "@/components/ui/dialog";
import { PresetSwatch } from "@/components/ui/preset-swatch";
import { Scaler } from "@/components/ui/scaler";
import Select from "@/components/ui/select";
import { Settings } from "@/components/ui/settings";
import { ToggleGroup } from "@/components/ui/toggle-group";
import {
  type InterfaceThemeMode,
  useInterfaceTheme,
} from "@/hooks/use-interface-theme";
import {
  CONTRAST_MAX,
  CONTRAST_MIN,
  CONTRAST_STEP,
  getPresetsForMode,
} from "@/lib/interface-theme";

const CUSTOM_VALUE = "__custom__";

const MODE_OPTIONS: ReadonlyArray<{
  value: InterfaceThemeMode;
  label: string;
  Icon: typeof SunIcon;
}> = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

type ThemeConfiguratorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ThemeConfigurator = ({
  open,
  onOpenChange,
}: ThemeConfiguratorProps) => {
  const { mode, resolvedMode, setMode, seeds, setSeed, preset, setPreset } =
    useInterfaceTheme();

  const presets = getPresetsForMode(resolvedMode);
  const selectedValue = preset ? preset.label : CUSTOM_VALUE;

  const handlePresetChange = (value: string | null) => {
    if (!value || value === CUSTOM_VALUE) return;
    const next = presets.find((option) => option.label === value);
    if (next) setPreset(next);
  };

  const handleModeChange = (next: InterfaceThemeMode | null) => {
    if (next) setMode(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-2xl p-4">
        <Settings>
          <Settings.Header>
            <Settings.Title>Theme</Settings.Title>
            <Settings.Subtitle>
              Customize the appearance of the workspace
            </Settings.Subtitle>
          </Settings.Header>

          <Settings.Card>
            <Settings.Row>
              <Settings.LabelGroup>
                <Settings.Label>Mode</Settings.Label>
                <Settings.Description>
                  Light, dark, or follow the system setting
                </Settings.Description>
              </Settings.LabelGroup>
              <Settings.Control>
                <ToggleGroup<InterfaceThemeMode>
                  value={mode}
                  onValueChange={handleModeChange}
                  className="w-full justify-end gap-1"
                >
                  {MODE_OPTIONS.map(({ value, label, Icon }) => (
                    <ToggleGroup.Item key={value} value={value} size="sm">
                      <Icon size={14} />
                      {label}
                    </ToggleGroup.Item>
                  ))}
                </ToggleGroup>
              </Settings.Control>
            </Settings.Row>

            <Settings.Row>
              <Settings.LabelGroup>
                <Settings.Label>Preset</Settings.Label>
                <Settings.Description>
                  Pick a starter palette
                </Settings.Description>
              </Settings.LabelGroup>
              <Settings.Control>
                <Select
                  value={selectedValue}
                  onValueChange={handlePresetChange}
                >
                  <Select.Trigger className="w-full" size="md">
                    <Select.Value>
                      <div className="flex items-center gap-2">
                        <PresetSwatch seeds={seeds} />
                        <span>{preset?.label ?? "Custom"}</span>
                      </div>
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    {!preset && (
                      <Select.Item value={CUSTOM_VALUE}>
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
              </Settings.Control>
            </Settings.Row>

            <Settings.Row>
              <Settings.LabelGroup>
                <Settings.Label>Accent</Settings.Label>
                <Settings.Description>
                  Buttons, links, and focus rings
                </Settings.Description>
              </Settings.LabelGroup>
              <Settings.Control>
                <ColorPill
                  value={seeds.acc}
                  onValueChange={(value) => setSeed("acc", value)}
                />
              </Settings.Control>
            </Settings.Row>

            <Settings.Row>
              <Settings.LabelGroup>
                <Settings.Label>Background</Settings.Label>
                <Settings.Description>
                  Workspace base color
                </Settings.Description>
              </Settings.LabelGroup>
              <Settings.Control>
                <ColorPill
                  value={seeds.bg}
                  onValueChange={(value) => setSeed("bg", value)}
                />
              </Settings.Control>
            </Settings.Row>

            <Settings.Row>
              <Settings.LabelGroup>
                <Settings.Label>Foreground</Settings.Label>
                <Settings.Description>
                  Workspace text color
                </Settings.Description>
              </Settings.LabelGroup>
              <Settings.Control>
                <ColorPill
                  value={seeds.fg}
                  onValueChange={(value) => setSeed("fg", value)}
                />
              </Settings.Control>
            </Settings.Row>

            <Settings.Row>
              <Settings.LabelGroup>
                <Settings.Label>Contrast</Settings.Label>
                <Settings.Description>
                  Surface elevation strength
                </Settings.Description>
              </Settings.LabelGroup>
              <Settings.Control>
                <Scaler
                  value={seeds.con}
                  onValueChange={(value) => setSeed("con", value)}
                  min={CONTRAST_MIN}
                  max={CONTRAST_MAX}
                  step={CONTRAST_STEP}
                  tickStep={0.05}
                />
              </Settings.Control>
            </Settings.Row>
          </Settings.Card>
        </Settings>
      </Dialog.Content>
    </Dialog>
  );
};
