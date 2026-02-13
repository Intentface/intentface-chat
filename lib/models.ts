export const GEMINI_MODELS = [
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
  },
] as const;

export type GeminiModelId = (typeof GEMINI_MODELS)[number]["id"];

export const DEFAULT_MODEL: GeminiModelId = "gemini-2.5-flash";

export const isValidModelId = (id: unknown): id is GeminiModelId => {
  return (
    typeof id === "string" && GEMINI_MODELS.some((model) => model.id === id)
  );
};
