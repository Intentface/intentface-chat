export const OPENAI_MODELS = [
  {
    id: "gpt-5.5",
    label: "GPT-5.5",
    provider: "openai",
  },
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    provider: "openai",
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    provider: "openai",
  },
  {
    id: "gpt-5.4-nano",
    label: "GPT-5.4 Nano",
    provider: "openai",
  },
] as const;

export const INCEPTION_MODELS = [
  {
    id: "mercury-2",
    label: "Mercury 2",
    provider: "inception",
  },
  {
    id: "mercury-2-diffusing",
    label: "Mercury 2 (Diffusing)",
    provider: "inception",
  },
  {
    id: "mercury-2-instant",
    label: "Mercury 2 (Instant)",
    provider: "inception",
  },
] as const;

export const BALSAM_MODELS = [
  {
    id: "mock",
    label: "Balsam Mock",
    provider: "balsam",
  },
] as const;

export const ALL_MODELS = [
  ...OPENAI_MODELS,
  ...INCEPTION_MODELS,
  ...BALSAM_MODELS,
] as const;

export type ModelId = (typeof ALL_MODELS)[number]["id"];
export type Provider = (typeof ALL_MODELS)[number]["provider"];

export const DEFAULT_MODEL: ModelId = "gpt-5.4-mini";

export const getModelConfig = (id: ModelId) =>
  ALL_MODELS.find((model) => model.id === id);

export const isValidModelId = (id: unknown): id is ModelId => {
  return typeof id === "string" && ALL_MODELS.some((model) => model.id === id);
};
