# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

### Tech Stack

- Framework: Next.js 16 with App Router
- AI: Vercel AI SDK (`ai` package) with Google Gemini via `@ai-sdk/google`
- UI Libraries:
  - Base UI (`@base-ui/react`) for headless accessible components
  - Motion (`motion/react`) for animations
  - TipTap (`@tiptap/react`) for rich text editor
  - Streamdown for animated markdown rendering
- Styling: Tailwind CSS v4 with `@tailwindcss/postcss`, custom design tokens
- Forms: TanStack Form (`@tanstack/react-form`)
- Utilities: `class-variance-authority`, `clsx`, `tailwind-merge`
- Theming: `next-themes` for dark/light mode

### Component Architecture

**Every component in `components/ai/` and `components/ui/` must follow the compound component pattern.** Components expose sub-components as static properties via `Object.assign`, giving consumers full control over composition and layout.

```tsx
// Usage — consumer composes the pieces
<Message role="user" messageId="1">
  <Message.Content>
    <Message.Text>Hello</Message.Text>
  </Message.Content>
  <Message.Actions>
    <Message.Action tooltip="Copy">
      <CopyIcon />
    </Message.Action>
  </Message.Actions>
</Message>;

// Implementation — Root + sub-components, single named export
const MessageRoot = (props) => {
  /* ... */
};
const MessageContent = (props) => {
  /* ... */
};
export const Message = Object.assign(MessageRoot, {
  Content: MessageContent,
  Actions: MessageActions,
  // ...
});
```

Rules for compound components:

- **One named export per file** — the compound object (e.g. `export const Message = Object.assign(...)`)
- **Root component** is the provider/container; sub-components consume context or accept props
- **No monolithic render-all components** — break UI into composable pieces (container, item, action, etc.) so consumers can reorder, omit, or extend parts
- **Accept `children`** where possible instead of hardcoding internal structure
- **Accept `className`** on every sub-component for style overrides
- **Convenience wrappers are fine** — a higher-level component can compose the primitives with default behavior (e.g. `Composer.Attachments` composes `Attachments`, `Attachments.Item`, `Attachments.Remove`)

This pattern is used throughout: `Message`, `Composer`, `Attachments`, `Tooltip`, `Conversation`, `Thread`, etc.

### AI Integration

The chat API follows Vercel AI SDK conventions

### TypeScript Configuration

- Strict mode enabled
- Path alias: `@/*` maps to root directory
- React 19 with new JSX transform (`jsx: "react-jsx"`)
- React 19 passes `ref` as a regular prop — do not use `forwardRef`. Accept `ref` directly in the props type instead.

## Important Patterns

1. Prefer `type` over `interface` for type definitions. Prefer arrow functions over `function` keyword for components, handlers, and utilities.
2. Avoid `useEffect` for syncing/deriving state. Use it only for true side effects (subscriptions, DOM integrations).
3. Use standard size naming: `xs`, `sm`, `md`, `lg`, `xl`.
4. Organize CVA base classes with arrays/comments when classes are long.
5. Every component in `components/ai/` and `components/ui/` must use the compound component pattern (see Component Architecture above).
6. Use `cn()` from `lib/utils.ts` for className merging.
7. Follow Biome rules and formatting.
8. Use data attributes (`data-slot`, `data-role`) for styling and state selectors.
9. Leverage Motion for entrance/exit animations.
10. Use TipTap for rich text editing needs.
11. Follow AI SDK patterns (`useChat()`, `streamText()`, `toUIMessageStreamResponse()`).
12. No monolithic components — always decompose into composable sub-components with `Object.assign`. Consumers compose the pieces; components never hardcode their own layout.
13. Do not use index/barrel files (`index.ts` that re-exports from other files). Import directly from the specific module instead.

## Environment Variables

The project requires `.env.local` with Google AI credentials (e.g. `GOOGLE_API_KEY`) for `@ai-sdk/google`.
