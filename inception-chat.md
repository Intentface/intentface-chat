> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.inceptionlabs.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Welcome to the Inception Platform

> Inception Platform provides powerful AI capabilities through an OpenAI-compatible API interface. This means you can use existing OpenAI client libraries or direct REST calls to access our services.

## Account Setup

1. Create an Inception Platform account or [sign in](https://platform.inceptionlabs.ai/auth/login) directly if you already have one. Each new user is initially assigned **10 million free tokens** to help get started with the API.
2. Go to [API Keys](https://platform.inceptionlabs.ai/dashboard/api-keys) and create a new API key. You can start using the API immediately with your free tokens!
3. When your free tokens are running low, navigate to [Billing](https://platform.inceptionlabs.ai/dashboard/billing) to add your payment information for continued usage beyond the free tier.

## Quick Start

Export your api key as an [environment variable](https://en.wikipedia.org/wiki/Environment_variable) in your terminal.

<CodeGroup>
  ```bash macOS / Linux theme={null}
  export INCEPTION_API_KEY="your_api_key_here"
  ```

```bash Windows theme={null}
set INCEPTION_API_KEY="your_api_key_here"
```

</CodeGroup>

<CodeGroup>
  ```bash cURL theme={null}
  curl https://api.inceptionlabs.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $INCEPTION_API_KEY" \
    -d '{
      "model": "mercury-2",
      "messages": [
        {"role": "user", "content": "What is a diffusion model?"}
      ],
      "max_tokens": 1000
    }'
  ```

```python Python theme={null}
import os
import requests

response = requests.post(
    'https://api.inceptionlabs.ai/v1/chat/completions',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {os.environ["INCEPTION_API_KEY"]}'
    },
    json={
        'model': 'mercury-2',
        'messages': [
            {'role': 'user', 'content': 'What is a diffusion model?'}
        ],
        'max_tokens': 1000
    }
)
data = response.json()
```

```javascript JavaScript theme={null}
// Using fetch API
const response = await fetch(
  "https://api.inceptionlabs.ai/v1/chat/completions",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INCEPTION_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mercury-2",
      messages: [{ role: "user", content: "What is a diffusion model?" }],
      max_tokens: 1000,
    }),
  },
);
const data = await response.json();
```

</CodeGroup>

All API requests should be made to:

```bash theme={null}
https://api.inceptionlabs.ai/v1
```

All API requests should be sent with the API key in the Authorization header:

```bash theme={null}
Authorization: Bearer $INCEPTION_API_KEY
```

#### Using Third-Party Libraries

Inception API is also fully compatible with popular Python libraries:

<CodeGroup>
  ```python AISuite theme={null}
  import os
  import aisuite as ai

client = ai.Client(
{
"inception": {"api_key": os.environ["INCEPTION_API_KEY"], "base_url": "https://api.inceptionlabs.ai/v1"},
}
)

response = client.chat.completions.create(
model="inception:mercury-2",
messages=[{"role": "user", "content": "What is a diffusion model?"}],
max_tokens=1000
)
print(response.choices[0].message.content)

````

```python LiteLLM theme={null}
import os
from litellm import completion

response = completion(
    model="openai/mercury-2",
    messages=[{"role": "user", "content": "What is a diffusion model?"}],
    api_key=os.environ["INCEPTION_API_KEY"],
    api_base="https://api.inceptionlabs.ai/v1",
    max_tokens=1000
)
print(response.choices[0].message.content)
````

```python LangChain theme={null}
import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOpenAI(
    model="mercury-2",
    temperature=0.75,
    api_key=os.environ["INCEPTION_API_KEY"],
    base_url="https://api.inceptionlabs.ai/v1"
)
llm.invoke([("user", "What is a diffusion model?")])
```

```python OpenAI Client theme={null}
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["INCEPTION_API_KEY"],
    base_url="https://api.inceptionlabs.ai/v1"
)

response = client.chat.completions.create(
    model="mercury-2",
    messages=[{"role": "user", "content": "What is a diffusion model?"}],
    max_tokens=1000
)
print(response.choices[0].message.content)
```

```javascript VercelAI theme={null}
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

const provider = createOpenAICompatible({
  name: "inception",
  apiKey: process.env.INCEPTION_API_KEY,
  baseURL: "https://api.inceptionlabs.ai/v1",
});

const { text } = await generateText({
  model: provider("mercury-2"),
  prompt: "What is a diffusion model?",
});
```

</CodeGroup>

--

> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.inceptionlabs.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Authentication

All API requests require authentication using API keys. Your API keys carry many privileges, so be sure to keep them secure.

#### **Obtaining API Keys**

You can generate API keys from your [Inception Platform Dashboard](https://platform.inceptionlabs.ai/dashboard/api-keys).

#### **Using API Keys**

Export your api key as an [environment variable](https://en.wikipedia.org/wiki/Environment_variable) in your terminal.

<CodeGroup>
  ```bash macOS / Linux theme={null}
  export INCEPTION_API_KEY="your_api_key_here"
  ```

```bash Windows theme={null}
set INCEPTION_API_KEY="your_api_key_here"
```

</CodeGroup>

Include your API key in the Authorization header:

```
Authorization: Bearer $INCEPTION_API_KEY
```

<Warning>
  **Security Note:** Never expose your API keys in client-side code or commit them to version control. Use environment variables or a secure secrets management system.
</Warning>

> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.inceptionlabs.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Models, Endpoints, and Pricing

<Card icon="sparkles" title="Start Free with 10M Tokens">
  <Info>
    Every new account includes 10 million free tokens.
  </Info>
</Card>

## Production Models

| Model            | Input Price (1M Tokens) | Cached Input Price (1M Tokens) | Output Price (1M Tokens) | Supported Endpoints                                               | Context Window                                  | Features                            | Supported Formats |
| ---------------- | ----------------------- | ------------------------------ | :----------------------- | ----------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------- | ----------------- |
| **Mercury 2**    | \$0.25                  | \$0.025                        | \$0.75                   | `v1/chat/completions`                                             | Chat: 128K                                      | `Tool Calling` `Structured Outputs` | `Text`            |
| **Mercury Edit** | \$0.25                  | \$0.025                        | \$0.75                   | `v1/fim/completions` `v1/apply/completions` `v1/edit/completions` | FIM: 32K<br />ApplyEdit: 32K<br />NextEdit: 32K |                                     | `Text`            |

## API Specs

<Tabs>
  <Tab title="Mercury 2">
    The fastest reasoning LLM and our most powerful model.

    <ParamField path="reasoning_effort" default="medium" type="string">
      Control the amount of reasoning (`instant`, `low`, `medium`, `high`).
    </ParamField>

    <ParamField path="reasoning_summary" default="true" type="boolean">
      Whether to return a best-effort summary of the model's reasoning.
    </ParamField>

    <ParamField path="reasoning_summary_wait" default="false" type="boolean">
      Whether to delay the final response until the reasoning summary is ready.
    </ParamField>

    <ParamField path="max_tokens" default="8192" type="number">
      Maximum number of tokens to generate. Range: 1-50,000
    </ParamField>

    <ParamField path="temperature" default="0.75" type="number">
      Controls randomness. Range: 0.5-1.0
    </ParamField>

    <ParamField path="stop" default="null" type="string[]">
      Up to 4 sequences where the model will stop generating further tokens. The returned text will not contain these sequences.
    </ParamField>

    <ParamField path="stream" default="false" type="boolean">
      Whether to stream the response.
    </ParamField>

    <ParamField path="stream_options" default="null" type="object">
      Include include\_usage=true to get usage information.
    </ParamField>

    <ParamField path="diffusing" default="false" type="boolean">
      Streaming should be set to true for diffusing effect.
    </ParamField>

    <ParamField path="tools" default="null" type="object[]">
      A list of tools the model may call.
    </ParamField>

    ## Example Usage

    ### Chat Completions

    `v1/chat/completions`

    <CodeGroup>
      ```bash cURL theme={null}
      curl https://api.inceptionlabs.ai/v1/chat/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $INCEPTION_API_KEY" \
        -d '{
          "model": "mercury-2",
          "messages": [
            {"role": "user", "content": "What is a diffusion model?"}
          ],
          "max_tokens": 10000
        }'
      ```

      ```python Python theme={null}
      import os
      import requests

      response = requests.post('https://api.inceptionlabs.ai/v1/chat/completions', headers={
          'Content-Type': 'application/json',
          'Authorization': f'Bearer {os.environ["INCEPTION_API_KEY"]}',
      }, json={
          "model": "mercury-2",
          "messages": [
              {"role": "user", "content": "What is a diffusion model?"}
          ],
          "max_tokens": 10000
      })

      print(response.json()['choices'][0]['message']['content'])
      ```

      ```javascript JavaScript theme={null}
      // Using fetch API
      const response = await fetch('https://api.inceptionlabs.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INCEPTION_API_KEY}`
        },
        body: JSON.stringify({
          model: "mercury-2",
          messages: [
            { role: 'user', content: 'What is a diffusion model?' }
          ],
          max_tokens: 10000
        })
      });

      const data = await response.json();
      console.log(data.choices[0].message.content);
      ```
    </CodeGroup>

  </Tab>

  <Tab title="Mercury Edit">
    A code editing LLM for autocomplete (FIM), apply edit, and next edit suggestions.

    <ParamField path="max_tokens" type="number">
      Maximum number of tokens to generate. Range: 1–8192. Default: `512` for autocomplete, `8192` for next-edit, `8192` for apply-edit.
    </ParamField>

    <ParamField path="presence_penalty" type="number">
      Penalizes new tokens based on whether they appear in the generated text so far. Range: -2.0-2.0. Default: `1.5` for autocomplete, `1.0` for next-edit, `0.0` for apply-edit.
    </ParamField>

    <ParamField path="temperature" type="number">
      Controls randomness. Range: 0.0-1.0. Default: `0.0` for autocomplete, `0.3` for next-edit, `0.0` for apply-edit.
    </ParamField>

    <ParamField path="top_p" type="number">
      Controls the cumulative probability of the top tokens to consider. Range: 0.0–1.0. Default: `1.0` for autocomplete, `0.8` for next-edit, `1.0` for apply-edit.
    </ParamField>

    <ParamField path="stop" type="string[]">
      Up to 4 sequences where the model will stop generating further tokens. The returned text will not contain these sequences.
    </ParamField>

    <ParamField path="stream" default="false" type="boolean">
      Whether to stream the response.
    </ParamField>

    <ParamField path="stream_options" default="null" type="object">
      Include include\_usage=true to get usage information.
    </ParamField>

    ## Example Usage

    ### Autocomplete

    `v1/fim/completions`

    <CodeGroup>
      ```bash cURL theme={null}
      curl https://api.inceptionlabs.ai/v1/fim/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $INCEPTION_API_KEY" \
        -d '{
          "model": "mercury-edit",
          "prompt": "def fibonacci(",
          "suffix": "return a + b",
          "max_tokens": 1000
        }'
      ```

      ```python Python theme={null}
      import os
      import requests

      response = requests.post('https://api.inceptionlabs.ai/v1/fim/completions', headers={
          'Content-Type': 'application/json',
          'Authorization': f'Bearer {os.environ["INCEPTION_API_KEY"]}',
      }, json={
          "model": "mercury-edit",
          "prompt": "def fibonacci(",
          "suffix": "return a + b",
          "max_tokens": 1000
      })

      print(response.json()['choices'][0]['text'])
      ```

      ```javascript JavaScript theme={null}
      // Using fetch API
      const response = await fetch('https://api.inceptionlabs.ai/v1/fim/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INCEPTION_API_KEY}`
        },
        body: JSON.stringify({
          model: "mercury-edit",
          prompt: "def fibonacci(",
          suffix: "return a + b",
          max_tokens: 1000
        })
      });

      const data = await response.json();
      console.log(data.choices[0].text);
      ```
    </CodeGroup>

    ### Apply-Edit

    `v1/apply/completions`

    <CodeGroup>
      ```bash cURL theme={null}
      curl https://api.inceptionlabs.ai/v1/apply/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $INCEPTION_API_KEY" \
        --data-binary @- <<'JSON'
      {
        "model": "mercury-edit",
        "messages": [
          {"role": "user", "content": "<|original_code|>\nclass Calculator:\n    \"\"\"A simple calculator class.\"\"\"\n    def __init__(self):\n        self.history = []\n\n    def add(self, a, b):\n        \"\"\"Adds two numbers.\"\"\"\n        result = a + b\n        return result\n<|/original_code|>\n\n<|update_snippet|>\n// ... existing code ...\ndef multiply(self, a, b):\n    \"\"\"Multiplies two numbers.\"\"\"\n    result = a * b\n    return result\n// ... existing code ...\n<|/update_snippet|>"}
        ],
        "max_tokens": 1000
      }
      JSON
      ```

      ```python Python theme={null}
      import os
      import requests

      response = requests.post('https://api.inceptionlabs.ai/v1/apply/completions', headers={
          'Content-Type': 'application/json',
          'Authorization': f'Bearer {os.environ["INCEPTION_API_KEY"]}',
      }, json={
          "model": "mercury-edit",
          "messages": [
              {"role": "user", "content": "<|original_code|>\nclass Calculator:\n    \"\"\"A simple calculator class.\"\"\"\n    def __init__(self):\n        self.history = []\n\n    def add(self, a, b):\n        \"\"\"Adds two numbers.\"\"\"\n        result = a + b\n        return result\n<|/original_code|>\n\n<|update_snippet|>\n// ... existing code ...\ndef multiply(self, a, b):\n    \"\"\"Multiplies two numbers.\"\"\"\n    result = a * b\n    return result\n// ... existing code ...\n<|/update_snippet|>"}
          ],
          "max_tokens": 1000
      })

      print(response.json()['choices'][0]['message']['content'])
      ```

      ```javascript JavaScript theme={null}
      // Using fetch API
      const response = await fetch('https://api.inceptionlabs.ai/v1/apply/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INCEPTION_API_KEY}`
        },
        body: JSON.stringify({
          model: "mercury-edit",
          messages: [
            { role: 'user', content: '<|original_code|>\nclass Calculator:\n    \"\"\"A simple calculator class.\"\"\"\n    def __init__(self):\n        self.history = []\n\n    def add(self, a, b):\n        \"\"\"Adds two numbers.\"\"\"\n        result = a + b\n        return result\n<|/original_code|>\n\n<|update_snippet|>\n// ... existing code ...\ndef multiply(self, a, b):\n    \"\"\"Multiplies two numbers.\"\"\"\n    result = a * b\n    return result\n// ... existing code ...\n<|/update_snippet|>' }
          ],
          max_tokens: 1000
        })
      });

      const data = await response.json();
      console.log(data.choices[0].message.content);
      ```
    </CodeGroup>

    ### Next-Edit

    `v1/edit/completions`

    <CodeGroup>
      ```bash cURL theme={null}
      curl https://api.inceptionlabs.ai/v1/edit/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $INCEPTION_API_KEY" \
        --data-binary @- <<'JSON'
      {
        "model": "mercury-edit",
        "messages": [
          {"role": "user", "content": "<|recently_viewed_code_snippets|>\n\n<|/recently_viewed_code_snippets|>\n\n<|current_file_content|>\ncurrent_file_path: solver.py\n'''\nfunction: flagAllNeighbors\n----------\nThis function marks each of the covered neighbors of the cell at the given row\n<|code_to_edit|>\nand col as flagged.\n'''\ndef flagAllNeighbors(board<|cursor|>, row, col): \n for r, c in b.getNeighbors(row, col):\n if b.isValid(r, c):\n b.flag(r, c)\n\n<|/code_to_edit|>\n<|/current_file_content|>\n\n<|edit_diff_history|>\n--- /c:/Users/test/testing/solver.py\n+++ /c:/Users/test/testing/solver.py\n@@ -6,1 +6,1 @@\n-def flagAllNeighbors(b, row, col): \n+def flagAllNeighbors(board, row, col): \n\n<|/edit_diff_history|>"}
        ],
        "max_tokens": 1000
      }
      JSON
      ```

      ```python Python theme={null}
      import os
      import requests

      response = requests.post('https://api.inceptionlabs.ai/v1/edit/completions', headers={
          'Content-Type': 'application/json',
          'Authorization': f'Bearer {os.environ["INCEPTION_API_KEY"]}',
      }, json={
          "model": "mercury-edit",
          "messages": [
              {"role": "user", "content": "<|recently_viewed_code_snippets|>\n\n<|/recently_viewed_code_snippets|>\n\n<|current_file_content|>\ncurrent_file_path: solver.py\n'''\nfunction: flagAllNeighbors\n----------\nThis function marks each of the covered neighbors of the cell at the given row\n<|code_to_edit|>\nand col as flagged.\n'''\ndef flagAllNeighbors(board<|cursor|>, row, col): \n for r, c in b.getNeighbors(row, col):\n if b.isValid(r, c):\n b.flag(r, c)\n\n<|/code_to_edit|>\n<|/current_file_content|>\n\n<|edit_diff_history|>\n--- /c:/Users/test/testing/solver.py\n+++ /c:/Users/test/testing/solver.py\n@@ -6,1 +6,1 @@\n-def flagAllNeighbors(b, row, col): \n+def flagAllNeighbors(board, row, col): \n\n<|/edit_diff_history|>"}
          ],
          "max_tokens": 1000
      })

      print(response.json()['choices'][0]['message']['content'])
      ```

      ```javascript JavaScript theme={null}
      // Using fetch API
      const response = await fetch('https://api.inceptionlabs.ai/v1/edit/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INCEPTION_API_KEY}`
        },
        body: JSON.stringify({
          model: "mercury-edit",
          messages: [
            { role: 'user', content: '<|recently_viewed_code_snippets|>\n\n<|/recently_viewed_code_snippets|>\n\n<|current_file_content|>\ncurrent_file_path: solver.py\n\'\'\'\nfunction: flagAllNeighbors\n----------\nThis function marks each of the covered neighbors of the cell at the given row\n<|code_to_edit|>\nand col as flagged.\n\'\'\'\ndef flagAllNeighbors(board<|cursor|>, row, col): \n for r, c in b.getNeighbors(row, col):\n if b.isValid(r, c):\n b.flag(r, c)\n\n<|/code_to_edit|>\n<|/current_file_content|>\n\n<|edit_diff_history|>\n--- /c:/Users/test/testing/solver.py\n+++ /c:/Users/test/testing/solver.py\n@@ -6,1 +6,1 @@\n-def flagAllNeighbors(b, row, col): \n+def flagAllNeighbors(board, row, col): \n\n<|/edit_diff_history|>' }
          ],
          max_tokens: 1000
        })
      });

      const data = await response.json();
      console.log(data.choices[0].message.content);
      ```
    </CodeGroup>

  </Tab>
</Tabs>

> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.inceptionlabs.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Models, Endpoints, and Pricing

<Card icon="sparkles" title="Start Free with 10M Tokens">
  <Info>
    Every new account includes 10 million free tokens.
  </Info>
</Card>

## Production Models

| Model            | Input Price (1M Tokens) | Cached Input Price (1M Tokens) | Output Price (1M Tokens) | Supported Endpoints                                               | Context Window                                  | Features                            | Supported Formats |
| ---------------- | ----------------------- | ------------------------------ | :----------------------- | ----------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------- | ----------------- |
| **Mercury 2**    | \$0.25                  | \$0.025                        | \$0.75                   | `v1/chat/completions`                                             | Chat: 128K                                      | `Tool Calling` `Structured Outputs` | `Text`            |
| **Mercury Edit** | \$0.25                  | \$0.025                        | \$0.75                   | `v1/fim/completions` `v1/apply/completions` `v1/edit/completions` | FIM: 32K<br />ApplyEdit: 32K<br />NextEdit: 32K |                                     | `Text`            |

## API Specs

<Tabs>
  <Tab title="Mercury 2">
    The fastest reasoning LLM and our most powerful model.

    <ParamField path="reasoning_effort" default="medium" type="string">
      Control the amount of reasoning (`instant`, `low`, `medium`, `high`).
    </ParamField>

    <ParamField path="reasoning_summary" default="true" type="boolean">
      Whether to return a best-effort summary of the model's reasoning.
    </ParamField>

    <ParamField path="reasoning_summary_wait" default="false" type="boolean">
      Whether to delay the final response until the reasoning summary is ready.
    </ParamField>

    <ParamField path="max_tokens" default="8192" type="number">
      Maximum number of tokens to generate. Range: 1-50,000
    </ParamField>

    <ParamField path="temperature" default="0.75" type="number">
      Controls randomness. Range: 0.5-1.0
    </ParamField>

    <ParamField path="stop" default="null" type="string[]">
      Up to 4 sequences where the model will stop generating further tokens. The returned text will not contain these sequences.
    </ParamField>

    <ParamField path="stream" default="false" type="boolean">
      Whether to stream the response.
    </ParamField>

    <ParamField path="stream_options" default="null" type="object">
      Include include\_usage=true to get usage information.
    </ParamField>

    <ParamField path="diffusing" default="false" type="boolean">
      Streaming should be set to true for diffusing effect.
    </ParamField>

    <ParamField path="tools" default="null" type="object[]">
      A list of tools the model may call.
    </ParamField>

    ## Example Usage

    ### Chat Completions

    `v1/chat/completions`

    <CodeGroup>
      ```bash cURL theme={null}
      curl https://api.inceptionlabs.ai/v1/chat/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $INCEPTION_API_KEY" \
        -d '{
          "model": "mercury-2",
          "messages": [
            {"role": "user", "content": "What is a diffusion model?"}
          ],
          "max_tokens": 10000
        }'
      ```

      ```python Python theme={null}
      import os
      import requests

      response = requests.post('https://api.inceptionlabs.ai/v1/chat/completions', headers={
          'Content-Type': 'application/json',
          'Authorization': f'Bearer {os.environ["INCEPTION_API_KEY"]}',
      }, json={
          "model": "mercury-2",
          "messages": [
              {"role": "user", "content": "What is a diffusion model?"}
          ],
          "max_tokens": 10000
      })

      print(response.json()['choices'][0]['message']['content'])
      ```

      ```javascript JavaScript theme={null}
      // Using fetch API
      const response = await fetch('https://api.inceptionlabs.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INCEPTION_API_KEY}`
        },
        body: JSON.stringify({
          model: "mercury-2",
          messages: [
            { role: 'user', content: 'What is a diffusion model?' }
          ],
          max_tokens: 10000
        })
      });

      const data = await response.json();
      console.log(data.choices[0].message.content);
      ```
    </CodeGroup>

  </Tab>

  <Tab title="Mercury Edit">
    A code editing LLM for autocomplete (FIM), apply edit, and next edit suggestions.

    <ParamField path="max_tokens" type="number">
      Maximum number of tokens to generate. Range: 1–8192. Default: `512` for autocomplete, `8192` for next-edit, `8192` for apply-edit.
    </ParamField>

    <ParamField path="presence_penalty" type="number">
      Penalizes new tokens based on whether they appear in the generated text so far. Range: -2.0-2.0. Default: `1.5` for autocomplete, `1.0` for next-edit, `0.0` for apply-edit.
    </ParamField>

    <ParamField path="temperature" type="number">
      Controls randomness. Range: 0.0-1.0. Default: `0.0` for autocomplete, `0.3` for next-edit, `0.0` for apply-edit.
    </ParamField>

    <ParamField path="top_p" type="number">
      Controls the cumulative probability of the top tokens to consider. Range: 0.0–1.0. Default: `1.0` for autocomplete, `0.8` for next-edit, `1.0` for apply-edit.
    </ParamField>

    <ParamField path="stop" type="string[]">
      Up to 4 sequences where the model will stop generating further tokens. The returned text will not contain these sequences.
    </ParamField>

    <ParamField path="stream" default="false" type="boolean">
      Whether to stream the response.
    </ParamField>

    <ParamField path="stream_options" default="null" type="object">
      Include include\_usage=true to get usage information.
    </ParamField>

    ## Example Usage

    ### Autocomplete

    `v1/fim/completions`

    <CodeGroup>
      ```bash cURL theme={null}
      curl https://api.inceptionlabs.ai/v1/fim/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $INCEPTION_API_KEY" \
        -d '{
          "model": "mercury-edit",
          "prompt": "def fibonacci(",
          "suffix": "return a + b",
          "max_tokens": 1000
        }'
      ```

      ```python Python theme={null}
      import os
      import requests

      response = requests.post('https://api.inceptionlabs.ai/v1/fim/completions', headers={
          'Content-Type': 'application/json',
          'Authorization': f'Bearer {os.environ["INCEPTION_API_KEY"]}',
      }, json={
          "model": "mercury-edit",
          "prompt": "def fibonacci(",
          "suffix": "return a + b",
          "max_tokens": 1000
      })

      print(response.json()['choices'][0]['text'])
      ```

      ```javascript JavaScript theme={null}
      // Using fetch API
      const response = await fetch('https://api.inceptionlabs.ai/v1/fim/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INCEPTION_API_KEY}`
        },
        body: JSON.stringify({
          model: "mercury-edit",
          prompt: "def fibonacci(",
          suffix: "return a + b",
          max_tokens: 1000
        })
      });

      const data = await response.json();
      console.log(data.choices[0].text);
      ```
    </CodeGroup>

    ### Apply-Edit

    `v1/apply/completions`

    <CodeGroup>
      ```bash cURL theme={null}
      curl https://api.inceptionlabs.ai/v1/apply/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $INCEPTION_API_KEY" \
        --data-binary @- <<'JSON'
      {
        "model": "mercury-edit",
        "messages": [
          {"role": "user", "content": "<|original_code|>\nclass Calculator:\n    \"\"\"A simple calculator class.\"\"\"\n    def __init__(self):\n        self.history = []\n\n    def add(self, a, b):\n        \"\"\"Adds two numbers.\"\"\"\n        result = a + b\n        return result\n<|/original_code|>\n\n<|update_snippet|>\n// ... existing code ...\ndef multiply(self, a, b):\n    \"\"\"Multiplies two numbers.\"\"\"\n    result = a * b\n    return result\n// ... existing code ...\n<|/update_snippet|>"}
        ],
        "max_tokens": 1000
      }
      JSON
      ```

      ```python Python theme={null}
      import os
      import requests

      response = requests.post('https://api.inceptionlabs.ai/v1/apply/completions', headers={
          'Content-Type': 'application/json',
          'Authorization': f'Bearer {os.environ["INCEPTION_API_KEY"]}',
      }, json={
          "model": "mercury-edit",
          "messages": [
              {"role": "user", "content": "<|original_code|>\nclass Calculator:\n    \"\"\"A simple calculator class.\"\"\"\n    def __init__(self):\n        self.history = []\n\n    def add(self, a, b):\n        \"\"\"Adds two numbers.\"\"\"\n        result = a + b\n        return result\n<|/original_code|>\n\n<|update_snippet|>\n// ... existing code ...\ndef multiply(self, a, b):\n    \"\"\"Multiplies two numbers.\"\"\"\n    result = a * b\n    return result\n// ... existing code ...\n<|/update_snippet|>"}
          ],
          "max_tokens": 1000
      })

      print(response.json()['choices'][0]['message']['content'])
      ```

      ```javascript JavaScript theme={null}
      // Using fetch API
      const response = await fetch('https://api.inceptionlabs.ai/v1/apply/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INCEPTION_API_KEY}`
        },
        body: JSON.stringify({
          model: "mercury-edit",
          messages: [
            { role: 'user', content: '<|original_code|>\nclass Calculator:\n    \"\"\"A simple calculator class.\"\"\"\n    def __init__(self):\n        self.history = []\n\n    def add(self, a, b):\n        \"\"\"Adds two numbers.\"\"\"\n        result = a + b\n        return result\n<|/original_code|>\n\n<|update_snippet|>\n// ... existing code ...\ndef multiply(self, a, b):\n    \"\"\"Multiplies two numbers.\"\"\"\n    result = a * b\n    return result\n// ... existing code ...\n<|/update_snippet|>' }
          ],
          max_tokens: 1000
        })
      });

      const data = await response.json();
      console.log(data.choices[0].message.content);
      ```
    </CodeGroup>

    ### Next-Edit

    `v1/edit/completions`

    <CodeGroup>
      ```bash cURL theme={null}
      curl https://api.inceptionlabs.ai/v1/edit/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $INCEPTION_API_KEY" \
        --data-binary @- <<'JSON'
      {
        "model": "mercury-edit",
        "messages": [
          {"role": "user", "content": "<|recently_viewed_code_snippets|>\n\n<|/recently_viewed_code_snippets|>\n\n<|current_file_content|>\ncurrent_file_path: solver.py\n'''\nfunction: flagAllNeighbors\n----------\nThis function marks each of the covered neighbors of the cell at the given row\n<|code_to_edit|>\nand col as flagged.\n'''\ndef flagAllNeighbors(board<|cursor|>, row, col): \n for r, c in b.getNeighbors(row, col):\n if b.isValid(r, c):\n b.flag(r, c)\n\n<|/code_to_edit|>\n<|/current_file_content|>\n\n<|edit_diff_history|>\n--- /c:/Users/test/testing/solver.py\n+++ /c:/Users/test/testing/solver.py\n@@ -6,1 +6,1 @@\n-def flagAllNeighbors(b, row, col): \n+def flagAllNeighbors(board, row, col): \n\n<|/edit_diff_history|>"}
        ],
        "max_tokens": 1000
      }
      JSON
      ```

      ```python Python theme={null}
      import os
      import requests

      response = requests.post('https://api.inceptionlabs.ai/v1/edit/completions', headers={
          'Content-Type': 'application/json',
          'Authorization': f'Bearer {os.environ["INCEPTION_API_KEY"]}',
      }, json={
          "model": "mercury-edit",
          "messages": [
              {"role": "user", "content": "<|recently_viewed_code_snippets|>\n\n<|/recently_viewed_code_snippets|>\n\n<|current_file_content|>\ncurrent_file_path: solver.py\n'''\nfunction: flagAllNeighbors\n----------\nThis function marks each of the covered neighbors of the cell at the given row\n<|code_to_edit|>\nand col as flagged.\n'''\ndef flagAllNeighbors(board<|cursor|>, row, col): \n for r, c in b.getNeighbors(row, col):\n if b.isValid(r, c):\n b.flag(r, c)\n\n<|/code_to_edit|>\n<|/current_file_content|>\n\n<|edit_diff_history|>\n--- /c:/Users/test/testing/solver.py\n+++ /c:/Users/test/testing/solver.py\n@@ -6,1 +6,1 @@\n-def flagAllNeighbors(b, row, col): \n+def flagAllNeighbors(board, row, col): \n\n<|/edit_diff_history|>"}
          ],
          "max_tokens": 1000
      })

      print(response.json()['choices'][0]['message']['content'])
      ```

      ```javascript JavaScript theme={null}
      // Using fetch API
      const response = await fetch('https://api.inceptionlabs.ai/v1/edit/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INCEPTION_API_KEY}`
        },
        body: JSON.stringify({
          model: "mercury-edit",
          messages: [
            { role: 'user', content: '<|recently_viewed_code_snippets|>\n\n<|/recently_viewed_code_snippets|>\n\n<|current_file_content|>\ncurrent_file_path: solver.py\n\'\'\'\nfunction: flagAllNeighbors\n----------\nThis function marks each of the covered neighbors of the cell at the given row\n<|code_to_edit|>\nand col as flagged.\n\'\'\'\ndef flagAllNeighbors(board<|cursor|>, row, col): \n for r, c in b.getNeighbors(row, col):\n if b.isValid(r, c):\n b.flag(r, c)\n\n<|/code_to_edit|>\n<|/current_file_content|>\n\n<|edit_diff_history|>\n--- /c:/Users/test/testing/solver.py\n+++ /c:/Users/test/testing/solver.py\n@@ -6,1 +6,1 @@\n-def flagAllNeighbors(b, row, col): \n+def flagAllNeighbors(board, row, col): \n\n<|/edit_diff_history|>' }
          ],
          max_tokens: 1000
        })
      });

      const data = await response.json();
      console.log(data.choices[0].message.content);
      ```
    </CodeGroup>

  </Tab>
</Tabs>

> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.inceptionlabs.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Streaming & Diffusion

Inception API supports streaming output and diffusion effect modes:

- **Streaming:** Get responses block-by-block for instant feedback—ideal for chat and live applications.
- **Diffusing:** Optionally visualize how noisy outputs are refined into final text, showcasing the model's iterative denoising process.

Export your api key as an environment variable in your terminal.

<CodeGroup>
  ```bash macOS / Linux theme={null}
  export INCEPTION_API_KEY="your_api_key_here"
  ```

```bash Windows theme={null}
set INCEPTION_API_KEY="your_api_key_here"
```

</CodeGroup>

<CodeGroup>
  ```bash Streaming theme={null}
  curl https://api.inceptionlabs.ai/v1/chat/completions \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $INCEPTION_API_KEY" \
      -d '{
        "model": "mercury-2",
        "messages": [
          {"role": "user", "content": "What is a diffusion model?"}
        ],
        "max_tokens": 1000,
        "stream": true
      }'
  ```

```bash Diffusing theme={null}
curl https://api.inceptionlabs.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INCEPTION_API_KEY" \
  -d '{
    "model": "mercury-2",
    "messages": [
      {"role": "user", "content": "What is a diffusion model?"}
    ],
    "max_tokens": 1000,
    "stream": true,
    "diffusing": true
  }'
```

</CodeGroup>

Here is an example of how to show the diffusing effect in your web app using JavaScript:

```javascript theme={null}
const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullContent = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("data: ")) continue;
    if (trimmed === "data: [DONE]") continue;
    const jsonStr = trimmed.substring(6);
    if (!jsonStr.startsWith("{")) continue;
    try {
      const data = JSON.parse(jsonStr);

      for (const choice of data.choices || []) {
        if (
          choice.delta &&
          choice.delta.content !== null &&
          choice.delta.content !== undefined
        ) {
          fullContent = choice.delta.content || "";
          contentElement.textContent = fullContent;
        }
      }
    } catch (error) {
      console.error("Parsing error:", error);
    }
  }
}
```

> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.inceptionlabs.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Instant

Inception API supports a near-instant mode that enables realtime responses from Mercury 2 by using `reasoning_effort=instant` .

This is ideal for:

- Voice assistants
- Customer support chatbots
- Real-time decision systems
- Low-latency workflows and automations

Export your api key as an environment variable in your terminal.

<CodeGroup>
  ```bash macOS / Linux theme={null}
  export INCEPTION_API_KEY="your_api_key_here"
  ```

```bash Windows theme={null}
set INCEPTION_API_KEY="your_api_key_here"
```

</CodeGroup>

```bash theme={null}
curl https://api.inceptionlabs.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INCEPTION_API_KEY" \
  -d '{
    "model": "mercury-2",
    "messages": [
      { "role": "system", "content": "You are a helpful assistant." },
      { "role": "user", "content": "What is a diffusion model?" }
    ],
    "reasoning_effort": "instant"
  }'
```

> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.inceptionlabs.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Tool Use

> Inception API supports tool calling for more complex responses on the chat completion endpoint.

Export your api key as an environment variable in your terminal.

<CodeGroup>
  ```bash macOS / Linux theme={null}
  export INCEPTION_API_KEY="your_api_key_here"
  ```

```bash Windows theme={null}
set INCEPTION_API_KEY="your_api_key_here"
```

</CodeGroup>

<CodeGroup>
  ```bash cURL theme={null}
  curl https://api.inceptionlabs.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $INCEPTION_API_KEY" \
    -d '{
      "model": "mercury-2",
      "messages": [{"role": "user", "content": "What'"'"'s the weather like in San Francisco?"}],
      "tools": [{"type": "function", "function": {"name": "get_weather", "description": "Get the current weather in a given location", "parameters": {"type": "object", "properties": {"location": {"type": "string", "description": "City and state, e.g., '"'"'San Francisco, CA'"'"'"}, "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}}, "required": ["location", "unit"]}}}]
    }'
  ```

```python Python theme={null}
import os
import json
import requests

def get_weather(location: str, unit: str):
    return f"Getting the weather for {location} in {unit}..."

tool_functions = {"get_weather": get_weather}

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a given location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City and state, e.g., 'San Francisco, CA'"
                },
                "unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"]
                }
            },
            "required": ["location", "unit"]
        }
    }
}]

payload = {
    "model": "mercury-2",
    "messages": [
        {
            "role": "user",
            "content": "What's the weather like in San Francisco?"
        }
    ],
    "tools": tools
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.environ["INCEPTION_API_KEY"]}",
}

response = requests.post("https://api.inceptionlabs.ai/v1/chat/completions", headers=headers, json=payload)
data = response.json()
tool_call = data["choices"][0]["message"]["tool_calls"][0]["function"]

print(f"Function called: {tool_call['name']}")
print(f"Arguments: {tool_call['arguments']}")
```

</CodeGroup>

> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.inceptionlabs.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Tool Use

> Inception API supports tool calling for more complex responses on the chat completion endpoint.

Export your api key as an environment variable in your terminal.

<CodeGroup>
  ```bash macOS / Linux theme={null}
  export INCEPTION_API_KEY="your_api_key_here"
  ```

```bash Windows theme={null}
set INCEPTION_API_KEY="your_api_key_here"
```

</CodeGroup>

<CodeGroup>
  ```bash cURL theme={null}
  curl https://api.inceptionlabs.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $INCEPTION_API_KEY" \
    -d '{
      "model": "mercury-2",
      "messages": [{"role": "user", "content": "What'"'"'s the weather like in San Francisco?"}],
      "tools": [{"type": "function", "function": {"name": "get_weather", "description": "Get the current weather in a given location", "parameters": {"type": "object", "properties": {"location": {"type": "string", "description": "City and state, e.g., '"'"'San Francisco, CA'"'"'"}, "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}}, "required": ["location", "unit"]}}}]
    }'
  ```

```python Python theme={null}
import os
import json
import requests

def get_weather(location: str, unit: str):
    return f"Getting the weather for {location} in {unit}..."

tool_functions = {"get_weather": get_weather}

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a given location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City and state, e.g., 'San Francisco, CA'"
                },
                "unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"]
                }
            },
            "required": ["location", "unit"]
        }
    }
}]

payload = {
    "model": "mercury-2",
    "messages": [
        {
            "role": "user",
            "content": "What's the weather like in San Francisco?"
        }
    ],
    "tools": tools
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.environ["INCEPTION_API_KEY"]}",
}

response = requests.post("https://api.inceptionlabs.ai/v1/chat/completions", headers=headers, json=payload)
data = response.json()
tool_call = data["choices"][0]["message"]["tool_calls"][0]["function"]

print(f"Function called: {tool_call['name']}")
print(f"Arguments: {tool_call['arguments']}")
```

</CodeGroup>

> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.inceptionlabs.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Tool Use

> Inception API supports tool calling for more complex responses on the chat completion endpoint.

Export your api key as an environment variable in your terminal.

<CodeGroup>
  ```bash macOS / Linux theme={null}
  export INCEPTION_API_KEY="your_api_key_here"
  ```

```bash Windows theme={null}
set INCEPTION_API_KEY="your_api_key_here"
```

</CodeGroup>

<CodeGroup>
  ```bash cURL theme={null}
  curl https://api.inceptionlabs.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $INCEPTION_API_KEY" \
    -d '{
      "model": "mercury-2",
      "messages": [{"role": "user", "content": "What'"'"'s the weather like in San Francisco?"}],
      "tools": [{"type": "function", "function": {"name": "get_weather", "description": "Get the current weather in a given location", "parameters": {"type": "object", "properties": {"location": {"type": "string", "description": "City and state, e.g., '"'"'San Francisco, CA'"'"'"}, "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}}, "required": ["location", "unit"]}}}]
    }'
  ```

```python Python theme={null}
import os
import json
import requests

def get_weather(location: str, unit: str):
    return f"Getting the weather for {location} in {unit}..."

tool_functions = {"get_weather": get_weather}

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a given location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City and state, e.g., 'San Francisco, CA'"
                },
                "unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"]
                }
            },
            "required": ["location", "unit"]
        }
    }
}]

payload = {
    "model": "mercury-2",
    "messages": [
        {
            "role": "user",
            "content": "What's the weather like in San Francisco?"
        }
    ],
    "tools": tools
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.environ["INCEPTION_API_KEY"]}",
}

response = requests.post("https://api.inceptionlabs.ai/v1/chat/completions", headers=headers, json=payload)
data = response.json()
tool_call = data["choices"][0]["message"]["tool_calls"][0]["function"]

print(f"Function called: {tool_call['name']}")
print(f"Arguments: {tool_call['arguments']}")
```

</CodeGroup>

--

> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.inceptionlabs.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Next Edit

> Generate Next Edit completions using our edit model.

Export your api key as an environment variable in your terminal.

<CodeGroup>
  ```bash macOS / Linux theme={null}
  export INCEPTION_API_KEY="your_api_key_here"
  ```

```bash Windows theme={null}
set INCEPTION_API_KEY="your_api_key_here"
```

</CodeGroup>

```bash theme={null}
curl https://api.inceptionlabs.ai/v1/edit/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INCEPTION_API_KEY" \
  -d "{
    \"model\": \"mercury-edit\",
    \"messages\": [
      {
        \"role\": \"user\",
        \"content\": \"<|recently_viewed_code_snippets|>\\n\\n<|/recently_viewed_code_snippets|>\\n\\n<|current_file_content|>\\ncurrent_file_path: solver.py\\n'''''''''\\nfunction: flagAllNeighbors\\n----------\\nThis function marks each of the covered neighbors of the cell at the given row\\n<|code_to_edit|>\\nand col as flagged.\\n'''''''''\\ndef flagAllNeighbors(board<|cursor|>, row, col): \\n for r, c in b.getNeighbors(row, col):\\n if b.isValid(r, c):\\n b.flag(r, c)\\n\\n<|/code_to_edit|>\\n<|/current_file_content|>\\n\\n<|edit_diff_history|>\\n--- /c:/Users/test/testing/solver.py\\n+++ /c:/Users/test/testing/solver.py\\n@@ -6,1 +6,1 @@\\n-def flagAllNeighbors(b, row, col): \\n+def flagAllNeighbors(board, row, col): \\n\\n<|/edit_diff_history|>\"
      }
    ]
  }"
```

**Next Edit Request Format**

Mercury Edit expects next-edit requests to contain 3 sections of code contents: recently viewed snippets, the current file with the editable region, and a time-ordered edit history. The primary purpose of the recently viewed snippets and edit history are to provide context to Mercury Edit so that it can better understand the user's current intent in modifying code.

<AccordionGroup>
  <Accordion title="Recently Viewed Snippets">
    The recently viewed snippets should be formatted as:

    ```
    <|recently_viewed_code_snippets|>
    <|recently_viewed_code_snippet|>
    code_snippet_file_path: [SNIPPET FILE PATH 1]
    [SNIPPET 1 CODE]
    <|/recently_viewed_code_snippet|>

    <|recently_viewed_code_snippet|>
    code_snippet_file_path: [SNIPPET FILE PATH 2]
    [SNIPPET 2 CODE]
    <|/recently_viewed_code_snippet|>
    <|/recently_viewed_code_snippets|>
    ```

    Each snippet should correspond to a piece of code (or entire code files) that a user has recently viewed. If you do not wish to use recently viewed snippets, please add `<|recently_viewed_code_snippets|>\n\n<|/recently_viewed_code_snippets|>` with no contents inside the tags.

  </Accordion>

  <Accordion title="Current File Content">
    The current file content should be formatted as:

    ```
    <|current_file_content|>
    current_file_path: [CURRENT FILE PATH]
    [CODE ABOVE EDITABLE REGION]
    <|code_to_edit|>
    [EDITABLE REGION CODE]
    <|/code_to_edit|>
    [CODE BELOW EDITABLE REGION]
    <|/current_file_content|>
    ```

    Mercury Edit will return an updated version of the editable region in its response (e.g., completing a function) enclosed in triple backticks.

  </Accordion>

  <Accordion title="Edit History">
    The edit history should be formatted as:

    ```
    <|edit_diff_history|>
    --- [EDITED FILE PATH 1]
    +++ [EDITED FILE PATH 1]
    [DIFF HUNK HEADER 1 WITH @@]
    [DIFF LINES 1]

    --- [EDITED FILE PATH 2]
    +++ [EDITED FILE PATH 2]
    [DIFF HUNK HEADER 2 WITH @@]
    [DIFF LINES 2]

    <|/edit_diff_history|>
    ```

    As seen above, each edit should follow unidiff formatting. It is important to make sure that the bottommost edits in the prompt correspond to the most recent edits made by the user. If you do not wish to use edit history, please add `<|edit_diff_history|>\n\n<|/edit_diff_history|>` with no contents inside the tags.

  </Accordion>
</AccordionGroup>

**Next Edit Prompting Best Practices**

The following best practices will help you get the most relevant suggestions out of Mercury Edit while maintaining low latency.

<AccordionGroup>
  <Accordion title="Recently Viewed Snippets">
    Include **3–5 snippets** of roughly 20 lines each, centered around the user's recent cursor positions. These should be focused code excerpts — not full files. For more advanced implementations, consider using AST nodes at cursor locations or code RAG to surface relevant type definitions and method implementations across the codebase.

    Always provide the **latest state** of code at each snippet location, as stale snippets can cause the model to suggest reverting recent changes. Both full declarations and outlines (e.g., type signatures and docstrings) are acceptable snippet formats.

  </Accordion>

  <Accordion title="User Edit History">
    Include at least the **last 3–5 user edits**, ordered chronologically with the most recent edit last. Edits should be **range-based** — if a user made multiple modifications in the same area, combine them into a single unidiff rather than many granular diffs.

    The edit history is often the strongest signal for identifying user intent. Ensuring the final entry corresponds to the user's most recent edit can significantly improve suggestion quality.

  </Accordion>

  <Accordion title="Current File Content">
    Pass in the **entire current file** so the model can draw on imports, function signatures, and surrounding code. For extremely large files, trim distant regions while preserving the area around the editable region.
  </Accordion>

  <Accordion title="Editable Region Selection">
    The editable region directly determines output token count and dominates latency. We recommend starting with **10–15 lines** (\~100–150 tokens) and tuning from there. At \~1,000 tokens/second decoding speed, an upper bound of around 25 lines (\~250 tokens) is practical depending on network latency.

    For selecting which lines to include, a simple approach is to center the region around the cursor: `[currentLine - 5, currentLine + 10]`.

    To suggest edits beyond the cursor vicinity:

    * **Parallel requests**: Fire multiple requests with disjoint editable regions and check which ones produce meaningful diffs.
    * **Linter-guided selection**: Wrap editable regions around locations where the linter identifies errors.

    We recommend making the maximum editable region size configurable so you can tune the tradeoff between suggestion scope and latency.

  </Accordion>
</AccordionGroup>

---

> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.inceptionlabs.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Apply Edit

> Generate Apply Edit completions using our edit model.

Export your api key as an environment variable in your terminal.

<CodeGroup>
  ```bash macOS / Linux theme={null}
  export INCEPTION_API_KEY="your_api_key_here"
  ```

```bash Windows theme={null}
set INCEPTION_API_KEY="your_api_key_here"
```

</CodeGroup>

```bash theme={null}
curl https://api.inceptionlabs.ai/v1/apply/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INCEPTION_API_KEY" \
  -d '{
    "model": "mercury-edit",
    "messages": [
      {
        "role": "user",
        "content": "<|original_code|>\nclass Calculator:\n    \"\"\"A simple calculator class.\"\"\"\n    def __init__(self):\n        self.history = []\n\n    def add(self, a, b):\n        \"\"\"Adds two numbers.\"\"\"\n        result = a + b\n        return result\n<|/original_code|>\n\n<|update_snippet|>\n// ... existing code ...\ndef multiply(self, a, b):\n    \"\"\"Multiplies two numbers.\"\"\"\n    result = a * b\n    return result\n// ... existing code ...\n<|/update_snippet|>"
      }
    ]
  }'
```

**Apply Edit Request Format**

Mercury Edit expects apply-edit requests to contain 2 sections: the original code and an update snippet. The model will intelligently merge the update snippet into the original code while preserving the code's structure, order, comments, and indentation.

<AccordionGroup>
  <Accordion title="Original Code">
    The original code should be formatted as:

    ```
    <|original_code|>
    {original_code}
    <|/original_code|>
    ```

  </Accordion>

  <Accordion title="Update Snippet">
    The update snippet should be formatted as:

    ```
    <|update_snippet|>
    // ... existing code ...
    [UPDATED CODE SNIPPET 1]
    // ... existing code ...
    [UPDATED CODE SNIPPET 2]
    // ... existing code ...
    <|/update_snippet|>
    ```

  </Accordion>
</AccordionGroup>

--

> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.inceptionlabs.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Apply Edit

> Generate Apply Edit completions using our edit model.

Export your api key as an environment variable in your terminal.

<CodeGroup>
  ```bash macOS / Linux theme={null}
  export INCEPTION_API_KEY="your_api_key_here"
  ```

```bash Windows theme={null}
set INCEPTION_API_KEY="your_api_key_here"
```

</CodeGroup>

```bash theme={null}
curl https://api.inceptionlabs.ai/v1/apply/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INCEPTION_API_KEY" \
  -d '{
    "model": "mercury-edit",
    "messages": [
      {
        "role": "user",
        "content": "<|original_code|>\nclass Calculator:\n    \"\"\"A simple calculator class.\"\"\"\n    def __init__(self):\n        self.history = []\n\n    def add(self, a, b):\n        \"\"\"Adds two numbers.\"\"\"\n        result = a + b\n        return result\n<|/original_code|>\n\n<|update_snippet|>\n// ... existing code ...\ndef multiply(self, a, b):\n    \"\"\"Multiplies two numbers.\"\"\"\n    result = a * b\n    return result\n// ... existing code ...\n<|/update_snippet|>"
      }
    ]
  }'
```

**Apply Edit Request Format**

Mercury Edit expects apply-edit requests to contain 2 sections: the original code and an update snippet. The model will intelligently merge the update snippet into the original code while preserving the code's structure, order, comments, and indentation.

<AccordionGroup>
  <Accordion title="Original Code">
    The original code should be formatted as:

    ```
    <|original_code|>
    {original_code}
    <|/original_code|>
    ```

  </Accordion>

  <Accordion title="Update Snippet">
    The update snippet should be formatted as:

    ```
    <|update_snippet|>
    // ... existing code ...
    [UPDATED CODE SNIPPET 1]
    // ... existing code ...
    [UPDATED CODE SNIPPET 2]
    // ... existing code ...
    <|/update_snippet|>
    ```

  </Accordion>
</AccordionGroup>

curl -X POST https://api.inceptionlabs.ai/v1/chat/completions \
 -H "Authorization: Bearer INCEPTION_API_KEY" \
 -H "Content-Type: application/json" \
 -d '{"messages": [{"role": "user", "content": "What is the meaning of life?"}], "model": "mercury-2"}'
