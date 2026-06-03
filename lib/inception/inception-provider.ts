import type { ProviderV3 } from "@ai-sdk/provider";
import { InceptionChatLanguageModel } from "./inception-chat-language-model";
import type { InceptionChatSettings } from "./inception-chat-settings";
import { InceptionEditModel } from "./inception-edit";

export type InceptionProviderSettings = {
  /**
   * Base URL for the Inception API.
   * @default "https://api.inceptionlabs.ai/v1"
   */
  baseURL?: string;

  /**
   * API key for authentication.
   * Falls back to INCEPTION_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Additional headers to include in API requests.
   */
  headers?: Record<string, string>;
};

export type InceptionProvider = ProviderV3 & {
  (modelId: string, settings?: InceptionChatSettings): InceptionChatLanguageModel;
  chat(modelId: string, settings?: InceptionChatSettings): InceptionChatLanguageModel;
  edit: InceptionEditModel;
};

export const createInception = (options: InceptionProviderSettings = {}): InceptionProvider => {
  const baseURL = options.baseURL?.replace(/\/+$/, "") ?? "https://api.inceptionlabs.ai/v1";

  const getHeaders = () => {
    const apiKey = options.apiKey ?? process.env.INCEPTION_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Inception API key is required. Pass it via `apiKey` or set the INCEPTION_API_KEY environment variable.",
      );
    }
    return {
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    };
  };

  const createChatModel = (modelId: string, settings: InceptionChatSettings = {}) =>
    new InceptionChatLanguageModel(modelId, settings, {
      provider: "inception",
      baseURL,
      headers: getHeaders,
    });

  const editModel = new InceptionEditModel({
    baseURL,
    headers: getHeaders,
  });

  const provider = ((modelId: string, settings?: InceptionChatSettings) => {
    return createChatModel(modelId, settings);
  }) as InceptionProvider;

  provider.chat = createChatModel;
  provider.languageModel = createChatModel;
  provider.edit = editModel;

  return provider;
};

export const inception = createInception();
