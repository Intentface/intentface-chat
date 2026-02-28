# Inception AI SDK Provider

Custom Vercel AI SDK provider for [Inception Labs](https://platform.inceptionlabs.ai) Mercury models — the world's first diffusion-based LLMs.

## Setup

Add your API key to `.env.local`:

```
INCEPTION_API_KEY=your_api_key_here
```

Get one at [platform.inceptionlabs.ai/dashboard/api-keys](https://platform.inceptionlabs.ai/dashboard/api-keys). New accounts include 10M free tokens.

## Provider Overview

```
lib/inception/
  index.ts                          # Barrel exports
  inception-provider.ts             # Provider factory (createInception, inception)
  inception-chat-language-model.ts  # LanguageModelV3 for Mercury 2 chat
  inception-chat-settings.ts        # Chat model settings type
  inception-edit.ts                 # Mercury Edit client (FIM, Apply-Edit, Next-Edit)
```

## Chat — Mercury 2

Mercury 2 is an OpenAI-compatible chat model with 128K context, tool calling, structured outputs, and a unique **diffusion streaming** mode.

### Basic usage

```ts
import { inception } from "@/lib/inception";
import { streamText } from "ai";

const result = streamText({
  model: inception("mercury-2"),
  messages: [{ role: "user", content: "What is a diffusion model?" }],
});
```

### Settings

```ts
inception("mercury-2", {
  // Control reasoning depth: "instant" | "low" | "medium" | "high"
  reasoningEffort: "high",

  // Return a summary of the model's reasoning (default: true)
  reasoningSummary: true,

  // Wait for reasoning summary before responding (default: false)
  reasoningSummaryWait: false,

  // Enable diffusion denoising streaming effect (default: false)
  diffusing: true,
});
```

### Diffusion mode

When `diffusing: true`, the API streams the full text being iteratively denoised rather than incremental deltas. The provider handles this transparently — when text only grows, it emits incremental deltas; when earlier text changes (denoising refinement), it restarts the text segment.

Select "Mercury 2 (Diffusing)" in the model picker, or use directly:

```ts
inception("mercury-2", { diffusing: true });
```

### Instant mode

Near-realtime responses for voice assistants, chatbots, and low-latency workflows:

```ts
inception("mercury-2", { reasoningEffort: "instant" });
```

### Tool calling

Works with standard AI SDK tool definitions:

```ts
import { inception } from "@/lib/inception";
import { streamText, tool } from "ai";
import { z } from "zod";

const result = streamText({
  model: inception("mercury-2"),
  messages: [{ role: "user", content: "What's the weather in SF?" }],
  tools: {
    getWeather: tool({
      description: "Get current weather",
      parameters: z.object({
        location: z.string(),
        unit: z.enum(["celsius", "fahrenheit"]),
      }),
      execute: async ({ location, unit }) => {
        return { temperature: 72, unit, location };
      },
    }),
  },
});
```

### Custom configuration

```ts
import { createInception } from "@/lib/inception";

const inception = createInception({
  apiKey: "your-key",                              // or set INCEPTION_API_KEY
  baseURL: "https://api.inceptionlabs.ai/v1",     // default
  headers: { "X-Custom-Header": "value" },
});
```

## Edit — Mercury Edit

Mercury Edit is a code editing model exposing three specialized endpoints. Access via `inception.edit`.

### FIM Autocomplete

Fill-in-the-middle completion for code autocompletion. Endpoint: `v1/fim/completions`

```ts
import { inception } from "@/lib/inception";

const result = await inception.edit.autocomplete({
  prompt: "def fibonacci(",
  suffix: "return a + b",
  maxTokens: 1000,
  temperature: 0.0,       // default for autocomplete
  presencePenalty: 1.5,   // default for autocomplete
});

console.log(result.choices[0].text);
```

### Apply Edit

Merge an update snippet into original code. Endpoint: `v1/apply/completions`

```ts
const result = await inception.edit.applyEdit({
  originalCode: `class Calculator:
    """A simple calculator class."""
    def __init__(self):
        self.history = []

    def add(self, a, b):
        """Adds two numbers."""
        result = a + b
        return result`,
  updateSnippet: `// ... existing code ...
def multiply(self, a, b):
    """Multiplies two numbers."""
    result = a * b
    return result
// ... existing code ...`,
  maxTokens: 8192,
});

console.log(result.choices[0].message.content);
```

### Next Edit

Predict the next edit based on recent context and edit history. Endpoint: `v1/edit/completions`

```ts
const result = await inception.edit.nextEdit({
  // 3-5 recent code snippets (~20 lines each) for context
  recentSnippets: [
    { filePath: "src/utils.ts", code: "export const add = ..." },
  ],

  // Current file with editable region marked
  currentFile: {
    filePath: "src/calculator.ts",
    codeAbove: "class Calculator {\n  constructor() {}",
    editableRegion: "\n  add(a, b) {\n    return a + b;\n  }\n",
    codeBelow: "}",
  },

  // Recent edits (chronological, most recent last)
  editHistory: [
    {
      filePath: "src/calculator.ts",
      diff: "@@ -2,1 +2,1 @@\n-  add(a, b) {\n+  add(a: number, b: number): number {",
    },
  ],

  maxTokens: 1000,
  temperature: 0.3,   // default for next-edit
  topP: 0.8,          // default for next-edit
});

console.log(result.choices[0].message.content);
```

## Models in the App

Two models are registered in the model picker:

| Model ID               | Label                   | Behavior              |
|------------------------|-------------------------|-----------------------|
| `mercury-2`           | Mercury 2               | Standard streaming    |
| `mercury-2-diffusing` | Mercury 2 (Diffusing)   | Diffusion streaming   |

The API route in `app/api/chat/route.ts` maps these to the provider automatically.

## API Reference

### Mercury 2 Parameters

| Parameter                | Default    | Range / Values                       |
|--------------------------|-----------|--------------------------------------|
| `max_tokens`             | 8192      | 1–50,000                             |
| `temperature`            | 0.75      | 0.5–1.0                              |
| `reasoning_effort`       | "medium"  | "instant", "low", "medium", "high"   |
| `reasoning_summary`      | true      | boolean                              |
| `reasoning_summary_wait` | false     | boolean                              |
| `diffusing`              | false     | boolean (requires `stream: true`)    |
| `stream`                 | false     | boolean                              |
| `stop`                   | null      | up to 4 sequences                    |
| `tools`                  | null      | OpenAI function tool format          |

### Mercury Edit Parameters

| Parameter          | Autocomplete | Next-Edit | Apply-Edit |
|--------------------|-------------|-----------|------------|
| `max_tokens`       | 512         | 8192      | 8192       |
| `temperature`      | 0.0         | 0.3       | 0.0        |
| `presence_penalty` | 1.5         | 1.0       | 0.0        |
| `top_p`            | 1.0         | 0.8       | 1.0        |

### Pricing

| Model          | Input (1M tokens) | Cached Input (1M tokens) | Output (1M tokens) |
|----------------|-------------------|--------------------------|---------------------|
| Mercury 2      | $0.25             | $0.025                   | $0.75               |
| Mercury Edit   | $0.25             | $0.025                   | $0.75               |
