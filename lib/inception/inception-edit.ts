type InceptionEditConfig = {
  baseURL: string;
  headers: () => Record<string, string>;
};

type FIMRequest = {
  /** The prefix text before the cursor. */
  prompt: string;
  /** The suffix text after the cursor. */
  suffix: string;
  maxTokens?: number;
  temperature?: number;
  presencePenalty?: number;
  topP?: number;
  stop?: string[];
  stream?: boolean;
};

type FIMResponse = {
  choices: Array<{ text: string; finish_reason: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
};

type ApplyEditRequest = {
  /** Original source code to be edited. */
  originalCode: string;
  /** Update snippet with `// ... existing code ...` markers. */
  updateSnippet: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
};

type ApplyEditResponse = {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
};

type NextEditRequest = {
  /** Recently viewed code snippets for context. */
  recentSnippets?: Array<{ filePath: string; code: string }>;
  /** Current file content with editable region marked. */
  currentFile: {
    filePath: string;
    codeAbove: string;
    editableRegion: string;
    codeBelow: string;
    cursorOffset?: number;
  };
  /** Recent edit diffs for intent context. */
  editHistory?: Array<{
    filePath: string;
    diff: string;
  }>;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  stream?: boolean;
};

type NextEditResponse = {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
};

export class InceptionEditModel {
  private readonly config: InceptionEditConfig;

  constructor(config: InceptionEditConfig) {
    this.config = config;
  }

  /**
   * Fill-in-the-Middle (FIM) autocomplete.
   * Endpoint: v1/fim/completions
   */
  async autocomplete(request: FIMRequest): Promise<FIMResponse> {
    const body = {
      model: "mercury-edit",
      prompt: request.prompt,
      suffix: request.suffix,
      ...(request.maxTokens != null && { max_tokens: request.maxTokens }),
      ...(request.temperature != null && { temperature: request.temperature }),
      ...(request.presencePenalty != null && {
        presence_penalty: request.presencePenalty,
      }),
      ...(request.topP != null && { top_p: request.topP }),
      ...(request.stop != null && { stop: request.stop }),
      ...(request.stream != null && { stream: request.stream }),
    };

    const response = await fetch(`${this.config.baseURL}/fim/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.config.headers(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Inception FIM API error (${response.status}): ${errorBody}`);
    }

    return response.json();
  }

  /**
   * Apply an update snippet to original code.
   * Endpoint: v1/apply/completions
   */
  async applyEdit(request: ApplyEditRequest): Promise<ApplyEditResponse> {
    const prompt = [
      "<|original_code|>",
      request.originalCode,
      "<|/original_code|>",
      "",
      "<|update_snippet|>",
      request.updateSnippet,
      "<|/update_snippet|>",
    ].join("\n");

    const body = {
      model: "mercury-edit",
      messages: [{ role: "user", content: prompt }],
      ...(request.maxTokens != null && { max_tokens: request.maxTokens }),
      ...(request.temperature != null && { temperature: request.temperature }),
      ...(request.stream != null && { stream: request.stream }),
    };

    const response = await fetch(`${this.config.baseURL}/apply/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.config.headers(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Inception Apply Edit API error (${response.status}): ${errorBody}`);
    }

    return response.json();
  }

  /**
   * Predict the next edit based on context and recent edits.
   * Endpoint: v1/edit/completions
   */
  async nextEdit(request: NextEditRequest): Promise<NextEditResponse> {
    // Build recently viewed snippets section
    let snippetsSection = "<|recently_viewed_code_snippets|>\n\n<|/recently_viewed_code_snippets|>";
    if (request.recentSnippets && request.recentSnippets.length > 0) {
      const snippets = request.recentSnippets
        .map(
          (s) =>
            `<|recently_viewed_code_snippet|>\ncode_snippet_file_path: ${s.filePath}\n${s.code}\n<|/recently_viewed_code_snippet|>`,
        )
        .join("\n\n");
      snippetsSection = `<|recently_viewed_code_snippets|>\n${snippets}\n<|/recently_viewed_code_snippets|>`;
    }

    // Build current file content section
    const { filePath, codeAbove, editableRegion, codeBelow } = request.currentFile;
    const currentFileSection = [
      "<|current_file_content|>",
      `current_file_path: ${filePath}`,
      codeAbove,
      "<|code_to_edit|>",
      editableRegion,
      "<|/code_to_edit|>",
      codeBelow,
      "<|/current_file_content|>",
    ].join("\n");

    // Build edit history section
    let historySection = "<|edit_diff_history|>\n\n<|/edit_diff_history|>";
    if (request.editHistory && request.editHistory.length > 0) {
      const diffs = request.editHistory
        .map((e) => `--- ${e.filePath}\n+++ ${e.filePath}\n${e.diff}`)
        .join("\n\n");
      historySection = `<|edit_diff_history|>\n${diffs}\n<|/edit_diff_history|>`;
    }

    const prompt = [snippetsSection, "", currentFileSection, "", historySection].join("\n");

    const body = {
      model: "mercury-edit",
      messages: [{ role: "user", content: prompt }],
      ...(request.maxTokens != null && { max_tokens: request.maxTokens }),
      ...(request.temperature != null && { temperature: request.temperature }),
      ...(request.topP != null && { top_p: request.topP }),
      ...(request.presencePenalty != null && {
        presence_penalty: request.presencePenalty,
      }),
      ...(request.stream != null && { stream: request.stream }),
    };

    const response = await fetch(`${this.config.baseURL}/edit/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.config.headers(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Inception Next Edit API error (${response.status}): ${errorBody}`);
    }

    return response.json();
  }
}
