# Chat Components

A reference for the chat UI primitives in this project — `Composer`, `Thread`, `Message`, `Reasoning`, `Steps` — and the hooks/helpers that glue them to the AI SDK message stream. Aimed at someone composing a chat surface from these parts or porting them to another codebase.

## Stack

- **Vercel AI SDK** (`ai@6.x`) and **`@ai-sdk/react`** — `Chat` class, `useChat()`, `DefaultChatTransport`, `UIMessage` parts as the wire format
- **TipTap** (`@tiptap/react` + `@tiptap/pm`) — composer editor with inline chips and prefix-triggered command lists
- **Zustand** (with `persist`) — chat list metadata + per-chat message persistence in localStorage
- **Streamdown** — streaming-safe markdown renderer used by `Message.Markdown`
- **Zod** — tool input schemas
- **Next.js App Router** — POST `/api/chat` is the streaming endpoint

## Mental model

Three ideas keep the surface coherent:

1. **AI SDK parts are the wire format.** Every assistant turn is a list of `UIMessage["parts"]` — `text`, `reasoning`, `tool-{name}`, `source-url`, `file`, plus any project-specific `data-*` parts. Components read parts; they don't own message state.
2. **A single `Chat` instance per chat ID owns streaming and persistence.** UI primitives are stateless renderers around it.
3. **The composer panel reflects derived state.** `useActiveComposerState(messages, status)` collapses messages + chat status into one of `idle | active | ask-user`, and the consumer feeds that to `Composer.Panel`.

```
[Composer] → onSubmit(data)
   ↓
chat.sendMessage(...)         (Chat instance from @ai-sdk/react)
   ↓
DefaultChatTransport          (POST /api/chat)
   ↓
streamText → toUIMessageStreamResponse()
   ↓
useChat() aggregates parts → messages: UIMessage[]
   ↓
Chat.onFinish → useChatStore.setMessages(chatId, messages) [localStorage]
   ↓
<Thread> renders <Message> for each, panel reflects derived state
```

## UIMessage parts

| Part type     | Notes                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| `text`        | Final assistant prose / user input                                        |
| `reasoning`   | Streamed model reasoning (when `sendReasoning: true`)                     |
| `tool-{name}` | One per tool call. `state` cycles `input-streaming` → `input-available` → `output-available` → `output-error` |
| `source-url`  | Citations (when `sendSources: true`)                                      |
| `file`        | User-uploaded attachments                                                 |
| `data-chip`   | Custom: structured chip references inserted from the composer            |

Helpers in `lib/message-utils.ts` group consecutive parts into segments and expose derived flags so renderers don't reach into part shapes directly.

---

## Composer — `components/ai/composer.tsx`

A single-file compound component (~2700 lines) exporting one namespace:

```tsx
export const Composer = Object.assign(ComposerRoot, {
  Container, Attachments, AttachmentTrigger, Actions, Placeholder, Submit,
  Panel, PanelItem,
  Textarea,
  Questions, Hints, Dismiss, Continue,
  Commands, CommandList, CommandItem, CommandItemIcon, CommandItemLabel,
  CommandItemDescription, CommandGroup, CommandGroupLabel, CommandCollection,
});
```

### Skeleton

The nesting hierarchy at a glance:

```tsx
<Composer>
  <Composer.Panel>
    <Composer.PanelItem>
      <Composer.CommandList>
        <Composer.CommandGroup>
          <Composer.CommandGroupLabel />
          <Composer.CommandCollection>
            <Composer.CommandItem>
              <Composer.CommandItemIcon />
              <Composer.CommandItemLabel />
              <Composer.CommandItemDescription />
            </Composer.CommandItem>
          </Composer.CommandCollection>
        </Composer.CommandGroup>
      </Composer.CommandList>
      <Composer.Questions />
    </Composer.PanelItem>
  </Composer.Panel>

  <Composer.Container>
    <Composer.Attachments />
    <Composer.AttachmentTrigger />
    <Composer.Textarea>
      <Composer.Placeholder />
    </Composer.Textarea>
    <Composer.Actions>
      <Composer.Hints />
      <Composer.Dismiss />
      <Composer.Continue />
      <Composer.Submit />
    </Composer.Actions>
  </Composer.Container>
</Composer>
```

### Root — `<Composer>`

Owns a TipTap editor, attachment state, tool toggles, command/mention popovers, and the questionnaire state machine. Exposes everything through `useComposer()`.

```tsx
type ComposerRootProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  onSubmit?: (data: ComposerSubmitData) => void | Promise<void>;
  isSubmitting?: boolean;
  commands?: ComposerCommandsMap;
  questions?: AskUserQuestion[];          // present → switches Panel into ask-user
  defaultTools?: Record<string, boolean>; // uncontrolled tool toggles
  tools?: Record<string, boolean>;        // controlled tool toggles
  onToolsChange?: (values: Record<string, boolean>) => void;
  defaultValue?: ComposerSnapshot;
  value?: ComposerSnapshot;               // controlled editor doc
  onValueChange?: (snapshot: ComposerSnapshot) => void;
  onCommandQueryChange?: (query: string, prefix: string | null) => void;
  ref?: Ref<ComposerHandle>;              // focus / blur / clear / insertText / insertChip / get|setSnapshot
};
```

`ComposerSubmitData` is a discriminated union:

```ts
type ComposerMessageSubmit = {
  kind: "message";
  text: string;
  files: FileUIPart[];
  chips: ChipData[];                       // inline `@mention` chips collected from the doc
  tools: Record<string, boolean>;          // tool toggle snapshot
};

type ComposerAnswersSubmit = {
  kind: "answers";
  answers: ComposerAnswerEntry[];          // emitted while in questionnaire mode
};
```

Parent components dispatch based on `data.kind`: a `"message"` submit goes to `chat.sendMessage`, an `"answers"` submit goes to `addToolOutput` (resolving the open `askUser` tool call).

### `useComposer()`

```ts
const { editor, attachments, tools, questionnaire, commands } = useComposer();
```

| Slice           | Shape                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| `editor`        | `{ hasContent, isSubmitting }` plus refs the primitives wire themselves    |
| `attachments`   | `{ items, add, remove, openFileDialog, isDragging, error }`                |
| `tools`         | `{ values: Record<string, boolean>, setValue(name, v), toggle(name) }`    |
| `questionnaire` | Current step, accumulated answers, `toggleOption`, `continueStep`, `dismiss` |
| `commands`      | Open state of the prefix popover, current query, navigation refs           |

### Layout primitives

| Primitive                  | What it renders                                                                 |
| -------------------------- | ------------------------------------------------------------------------------- |
| `Composer.Container`       | The visible shell — border, padding, drop-target outline                        |
| `Composer.Attachments`     | Chip row of pending file uploads (delete buttons, progress)                     |
| `Composer.AttachmentTrigger` | Button that opens the file dialog                                             |
| `Composer.Textarea`        | The TipTap editor surface; children render absolutely-positioned overlays      |
| `Composer.Placeholder`     | Shown when the editor is empty. `placeholder` can be a string or string[] (rotates) |
| `Composer.Actions`         | Flex row for the bottom action bar                                              |
| `Composer.Submit`          | Submit button; disabled while `isSubmitting` or the doc is empty                |

### Panel — derived overlay above the input

`Composer.Panel` is a crossfading container, `Composer.PanelItem` selects the active child by string value. The consumer drives `value` from `useActiveComposerState`.

```tsx
<Composer.Panel value={panelState.type}>
  <Composer.PanelItem value="command-list">…</Composer.PanelItem>
  <Composer.PanelItem value="active">…</Composer.PanelItem>
  <Composer.PanelItem value="ask-user"><Composer.Questions /></Composer.PanelItem>
</Composer.Panel>
```

`PanelItem` mounts/unmounts with a transition; only one item is visible at a time.

### Questionnaire — `Composer.Questions` / `Hints` / `Dismiss` / `Continue`

Active when the root receives a non-empty `questions` prop (driven by the open `askUser` tool call).

- `Composer.Questions` — renders the current question with its options and a free-text fallback. Handles single- and multi-select.
- `Composer.Hints` — keyboard hint pills ("↵ to continue", etc.)
- `Composer.Dismiss` — cancels the questionnaire and returns to compose mode.
- `Composer.Continue` — advances to the next question, or submits the full answer set on the last step (fires `onSubmit({ kind: "answers", answers })`).

When in ask-user mode, swap the `Actions` row from the standard layout to `<Hints /> <Dismiss /> <Continue />`.

### Commands — prefix-triggered popovers

Pass a `commands` map to the root:

```tsx
<Composer
  commands={{
    "@": { kind: "insert",  trigger: "after-whitespace", items: MENTION_ITEMS },
    "/": { kind: "execute", trigger: "doc-start",        items: COMMAND_ITEMS },
  }}
>
```

| Field     | Meaning                                                                          |
| --------- | -------------------------------------------------------------------------------- |
| `kind`    | `"insert"` (selecting an item inserts a chip) or `"execute"` (item triggers an action) |
| `trigger` | `"doc-start"` (prefix only at position 0) or `"after-whitespace"` (anywhere after space) |
| `items`   | `CommandItemData[]` — `{ value, label, description?, icon?, keywords? }`        |
| `filter`  | Optional custom scoring function. Default: fuzzy match on `label + keywords`     |

Render the popovers inside `Composer.PanelItem value="command-list"`. `Composer.CommandList` takes a `prefix` plus a render function that maps an item to a `Composer.CommandItem`:

```tsx
<Composer.CommandList prefix="@">
  {(item: CommandItemData) => (
    <Composer.CommandItem value={item.value}>
      {item.icon && <Composer.CommandItemIcon>{CHIP_ICONS[item.icon]}</Composer.CommandItemIcon>}
      <Composer.CommandItemLabel>{item.label}</Composer.CommandItemLabel>
      {item.description && (
        <Composer.CommandItemDescription>{item.description}</Composer.CommandItemDescription>
      )}
    </Composer.CommandItem>
  )}
</Composer.CommandList>
```

`Composer.CommandGroup` + `Composer.CommandGroupLabel` group items under headers. `Composer.CommandCollection` is the low-level loop primitive — use it when you want to interleave groups with custom JSX.

### TipTap setup

- Extensions: `Document`, `Paragraph`, `Text`, plus a custom `MentionChip` node and a ProseMirror plugin for command prefixes.
- The plugin watches doc changes and decorates a registered prefix (configurable per command via `trigger`) with an inline badge, opening the popover list.
- Fuzzy scoring favours prefix matches over scattered matches, and consecutive-character runs over single matches.

### Submission flow

1. `Composer.Submit` (or Enter inside the editor) triggers form submit.
2. If `questions` is set and the user is mid-questionnaire → `continueStep()` advances or finalises.
3. Otherwise → the root packages `{ text, files, chips, tools }` and calls `onSubmit({ kind: "message", ... })`.
4. Parent maps that to `chat.sendMessage({ parts: [...files, { type: "text", text }, ...chipParts] }, { body: { ...tools } })`.

---

## Thread — `components/ai/thread.tsx`

```tsx
export const Thread = Object.assign(ThreadRoot, {
  Overlay, Viewport, Composer, Placeholder, ScrollButton, Spacer,
});
```

### Skeleton

```tsx
<Thread>
  <Thread.Overlay />
  <Thread.Viewport>
    <Thread.Placeholder />
    {/* messages render here */}
    <Thread.Spacer />
  </Thread.Viewport>
  <Thread.Composer>
    <Thread.ScrollButton />
    {/* <Composer> goes here */}
  </Thread.Composer>
  <Thread.Overlay />
</Thread>
```

| Primitive             | Role                                                                          |
| --------------------- | ----------------------------------------------------------------------------- |
| `Thread`              | Layout shell — flex column, full height                                       |
| `Thread.Viewport`     | Scroll container. Place mapped `<Message>` children here                      |
| `Thread.Composer`     | Anchored composer slot at the bottom                                          |
| `Thread.ScrollButton` | "Jump to latest" button; auto-hides when the viewport is pinned to bottom    |
| `Thread.Spacer`       | End-of-list padding so the last message clears the composer overlay          |
| `Thread.Overlay`      | `direction="top" \| "bottom"` — gradient fade masks at the viewport edges    |
| `Thread.Placeholder`  | Renders only when the viewport has no children (empty-state slot)             |

Typical assembly:

```tsx
<Thread>
  <Header />
  <Thread.Overlay direction="top" />
  <Thread.Viewport>
    {messages.length === 0 ? (
      <Thread.Placeholder><ChatPlaceholder /></Thread.Placeholder>
    ) : (
      messages.map((m) => <Message key={m.id} message={m} />)
    )}
    <Thread.Spacer />
  </Thread.Viewport>
  <Thread.Composer>
    <Thread.ScrollButton />
    <ChatInput />
  </Thread.Composer>
  <Thread.Overlay direction="bottom" />
</Thread>
```

`Thread.Spacer` measures both overlay heights with `offsetHeight` and subtracts them so the last message lands above the composer regardless of composer size or panel state.

---

## Message — `components/ai/message.tsx`

```tsx
export const Message = Object.assign(MessageRoot, {
  Content, Text, Markdown, Chip,
  Attachments, Attachment,
  Sources, Source,
  Actions, Action, Copy,
  Error, Loading, Timestamp,
});
```

### Skeleton

```tsx
<Message>
  <Message.Attachments>
    <Message.Attachment />
  </Message.Attachments>

  <Message.Content>
    <Message.Text />
    <Message.Markdown>
      <Message.Chip />
    </Message.Markdown>
    <Message.Loading />
  </Message.Content>

  <Message.Sources>
    <Message.Source />
  </Message.Sources>

  <Message.Actions>
    <Message.Action />
    <Message.Copy />
  </Message.Actions>

  <Message.Timestamp />
  <Message.Error />
</Message>
```

`Message` accepts a `role: "user" | "assistant"` (and an optional `message` for derived helpers) and switches styling and alignment accordingly.

| Primitive             | Role                                                                       |
| --------------------- | -------------------------------------------------------------------------- |
| `Message.Content`     | Bubble container — applies role-specific spacing, background, alignment   |
| `Message.Text`        | Plain-text body (user turns or assistant text with no markdown features)  |
| `Message.Markdown`    | Streamdown wrapper — citations, code-block styling, inline chip support  |
| `Message.Chip`        | Inline chip badge rendered inside assistant markdown                       |
| `Message.Attachments` / `Message.Attachment` | User-uploaded file thumbnails                       |
| `Message.Sources` / `Message.Source` | Citation row (deduped favicon badges)                       |
| `Message.Actions` / `Message.Action` | Hover/inline action bar (copy, retry, delete, …)            |
| `Message.Copy`        | Pre-wired "copy to clipboard" action                                       |
| `Message.Error`       | Error banner (e.g. when `chat.status === "error"`)                         |
| `Message.Loading`     | Lightweight inline loader (shimmer dot)                                    |
| `Message.Timestamp`   | Localised timestamp pill                                                   |

Inside a typical assistant message, the renderer walks `message.parts` and emits one of `Message.Text` / `Message.Markdown` / `Message.Chip` per segment, then appends `Message.Sources` and `Message.Actions` outside `Message.Content`.

---

## Reasoning — `components/ai/reasoning.tsx`

Collapsible block for `reasoning` parts. While streaming, it shows a shimmer and the most recent `**Bold Header**` (extracted via `splitReasoningByHeaders`). On completion the duration in seconds is displayed in the trigger.

### Skeleton

```tsx
<Reasoning>
  <Reasoning.Trigger />
  <Reasoning.Content />
</Reasoning>
```

The parent passes the derived `info` from `getReasoningInfo(segments, isStreaming)` so `Reasoning` doesn't read parts itself.

---

## Steps — `components/ai/steps.tsx`

### Skeleton

```tsx
<Steps>
  <Steps.Header>
    <Steps.Summary />
  </Steps.Header>
  <Steps.Content>
    <Steps.Step>
      <Steps.Body />
      <Steps.ToolCall />
      <Steps.AskUser />
      <Steps.SearchResults>
        <Steps.SearchResult />
      </Steps.SearchResults>
    </Steps.Step>
  </Steps.Content>
</Steps>
```

`Steps` renders a chronological list of in-flight or completed work items inside one collapsible:

> Thinking… used 2 tools, asked 1 question

`Steps.Step` items use a per-tool `toolLabels[name]` dictionary to switch between an active label ("Searching the web…") and a complete label ("Searched the web"). `InterleavedSteps` (in `chat.tsx`) handles the case where reasoning and tool calls are mixed inside one assistant turn.

When the panel is in `active` mode, the same step list is mirrored above the composer via `StepQueue` (rendered inside `Composer.PanelItem value="active"`).

---

## Hooks

### `useChatInstance(chatId)` — `hooks/use-chat-instance.ts`

Resolves (or lazily creates) the cached `Chat` for a given id, wires `useChat({ chat })`, and rehydrates persisted messages on mount:

```ts
export const useChatInstance = (chatId: string) => {
  const chat = useMemo(() => getChatInstance(chatId), [chatId]);
  const helpers = useChat<AppUIMessage>({ chat });

  const { setMessages } = helpers;
  useEffect(() => {
    const stored = useChatStore.getState().getMessages(chatId);
    if (stored.length > 0) setMessages(stored);
  }, [chatId, setMessages]);

  return helpers;
};
```

SSR can't read localStorage, so the server and the first client render both start empty; the effect rehydrates after mount, avoiding hydration mismatches.

`getChatInstance(chatId)` (in `lib/chat-instance.ts`) keeps a `Map<chatId, Chat>` so navigation between chats reuses the same in-flight streams. Each instance is configured with:

- `transport: new DefaultChatTransport({ body: () => ({ model, ... }) })` — the function form re-evaluates per request so it picks up the current Zustand state.
- `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` — auto-continues after a tool result lands, so multi-step tool chains don't need user re-submission.
- `onFinish` — persists messages via `useChatStore.setMessages`. Aborts and errors are skipped so a half-written assistant turn isn't saved.

### `useActiveComposerState(messages, status)` — `hooks/use-active-composer-state.ts`

Pure function-over-state hook that decides what the panel above the composer should show:

```ts
type ComposerPanelState =
  | { type: "idle" }
  | { type: "active"; steps: ComposerStepItem[] }
  | { type: "ask-user"; toolCallId: string; questions: AskUserQuestion[]; isAnswered: boolean };
```

Logic, in order:

1. If the last assistant message has a `tool-askUser` part with `state: "input-available"` → **ask-user** (regardless of chat status).
2. If `status === "ready" | "error"` → **idle**.
3. If `status === "submitted"` → **active**, with a single "Thinking…" step.
4. If `status === "streaming"`:
   - Collect in-flight or recently-completed tool parts → one step per tool.
   - If the last part is `reasoning` → add a "Thinking…" step.
   - If only text follows (no tools, no reasoning) → **idle**.

The hook memoises by structural equality so streaming token-by-token doesn't churn React.

### `useComposer()` — see above

The internal context hook used by composer subtree primitives. Useful in consumer-side ornaments (custom action buttons, tool toggle UIs) that need to read or mutate composer state.

---

## Helpers — `lib/message-utils.ts`

| Helper                          | What it does                                                              |
| ------------------------------- | ------------------------------------------------------------------------- |
| `getSegmentedParts(parts)`      | Group consecutive parts into `text` / `reasoning` / `tool` / `file` segments |
| `getTextInfo(segments)`         | Concatenated text and last text part                                      |
| `getChainInfo(segments)`        | Reasoning-only flag, `hasTools`, the reasoning+tool segments              |
| `getReasoningInfo(segs, isStr)` | Headers, body texts, streaming flag                                       |
| `getAskUserInfo(parts)`         | Whether an answer is awaited; previously answered tool calls              |
| `getSourcesInfo(parts)`         | Deduped `source-url` parts, by domain                                     |
| `splitReasoningByHeaders(...)`  | Split reasoning text into `{ header, body }` sections                     |
| `toolLabels`                    | Per-tool `{ active, complete }` label generators                          |

These helpers exist so the renderer and the panel-state hook share derivation logic and stay decoupled from AI SDK part shapes.

---

## Putting it together

A minimal chat surface uses all the primitives like this:

```tsx
const ChatSurface = () => {
  const { messages, status, sendMessage, addToolOutput } = useChatInstance(chatId);
  const panelState = useActiveComposerState(messages, status);

  return (
    <Thread>
      <Thread.Overlay direction="top" />
      <Thread.Viewport>
        {messages.map((m) => <Message key={m.id} message={m} role={m.role} />)}
        <Thread.Spacer />
      </Thread.Viewport>
      <Thread.Composer>
        <Thread.ScrollButton />
        <Composer
          onSubmit={(data) => {
            if (data.kind === "answers") {
              if (panelState.type !== "ask-user") return;
              addToolOutput({
                tool: "askUser",
                toolCallId: panelState.toolCallId,
                output: JSON.stringify(data.answers),
              });
              return;
            }
            sendMessage(
              { parts: [...data.files, { type: "text", text: data.text }] },
              { body: data.tools },
            );
          }}
          questions={panelState.type === "ask-user" ? panelState.questions : undefined}
          commands={{ "@": { kind: "insert", trigger: "after-whitespace", items: MENTIONS } }}
        >
          <Composer.Panel value={panelState.type}>
            <Composer.PanelItem value="command-list">{/* CommandLists */}</Composer.PanelItem>
            <Composer.PanelItem value="active">{/* StepQueue */}</Composer.PanelItem>
            <Composer.PanelItem value="ask-user"><Composer.Questions /></Composer.PanelItem>
          </Composer.Panel>

          <Composer.Container>
            <Composer.Attachments />
            <Composer.Textarea autoFocus>
              <Composer.Placeholder placeholder="Ask anything…" />
            </Composer.Textarea>
            <Composer.Actions>
              {panelState.type === "ask-user" ? (
                <>
                  <Composer.Hints />
                  <Composer.Dismiss />
                  <Composer.Continue />
                </>
              ) : (
                <Composer.Submit />
              )}
            </Composer.Actions>
          </Composer.Container>
        </Composer>
      </Thread.Composer>
      <Thread.Overlay direction="bottom" />
    </Thread>
  );
};
```

The composition reads top-down: `Thread` lays out the surface, `Message` renders parts of each turn, `Composer` collects the next turn, and `useActiveComposerState` keeps the panel above the composer in sync with whatever the assistant is currently doing.
