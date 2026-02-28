export const GEMINI_MODELS = [
  {
    id: "gemini-3-pro-preview",
    label: "Gemini 3 Pro",
    provider: "google",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    provider: "google",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "google",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    provider: "google",
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
  ...GEMINI_MODELS,
  ...INCEPTION_MODELS,
  ...BALSAM_MODELS,
] as const;

export type ModelId = (typeof ALL_MODELS)[number]["id"];
export type Provider = (typeof ALL_MODELS)[number]["provider"];

export const DEFAULT_MODEL: ModelId = "gemini-2.5-flash";

export const getModelConfig = (id: ModelId) =>
  ALL_MODELS.find((model) => model.id === id);

export const isValidModelId = (id: unknown): id is ModelId => {
  return typeof id === "string" && ALL_MODELS.some((model) => model.id === id);
};
