# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Project Overview

Intentface is an AI chat interface built with Next.js 16, leveraging the Vercel AI SDK for streaming conversations with Google Gemini 2.5 Flash Lite. The application focuses on creating a polished, animated chat experience with composable UI components.

## Development Commands

- `npm run dev` - Start development server (localhost:3000)
- `npm run build` - Build for production
- `npm start` - Run production build
- `npm run lint` - Run Biome linter (checks code quality)
- `npm run format` - Format code with Biome

Important: This project uses Biome, not ESLint or Prettier. Always use `npm run lint` and `npm run format`.

## Architecture

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

### Directory Structure

```
/app
  /api/chat/route.ts - AI streaming endpoint (POST)
  layout.tsx - Root layout with ThemeProvider
  page.tsx - Main chat interface
  globals.css - Tailwind config and design tokens
/components
  /ai - Chat-specific components (Message, Messages, PromptInput, Conversation)
  /ui - Reusable UI primitives (Button, Tooltip, Input, etc.)
  /icons - Custom icon components
/hooks - Custom React hooks
/lib - Utilities (cn helper for classnames)
```

### Component Architecture

The codebase follows a compound component pattern where components expose sub-components as properties:

```tsx
// Usage pattern
<Message role="user" messageId="1">
  <Message.Content>
    <Message.Text>Hello</Message.Text>
  </Message.Content>
  <Message.Actions>
    <Message.Action tooltip="Copy"><CopyIcon /></Message.Action>
  </Message.Actions>
</Message>

// Implementation pattern
const MessageRoot = (props) => { /* ... */ };
const MessageContent = (props) => { /* ... */ };
export const Message = Object.assign(MessageRoot, {
  Content: MessageContent,
  Actions: MessageActions,
  // ...
});
```

This pattern is used throughout: `Message`, `PromptInput`, `Tooltip`, `Conversation`, etc.

Because this repository is a company AI chat boilerplate, all new and refactored components must follow library-style composition and structure (consistent APIs, compound composition where appropriate, predictable file organization, and reusable primitives over one-off implementations).

### Key Files

- `app/api/chat/route.ts`: Streaming API route using `streamText()` with Google Gemini. Uses `smoothStream()` for word-by-word chunking with 20ms delay.
- `app/page.tsx`: Main chat page using `useChat()` hook.
- `components/ai/message.tsx`: Message display with role-based styling, actions (copy/regenerate), error states, and Streamdown markdown rendering.
- `components/ai/prompt-input.tsx`: Rich text input built with TipTap.
- `lib/utils.ts`: Contains `cn()` helper for merging Tailwind classes with `clsx` and `tailwind-merge`.

### Styling Conventions

- Tailwind v4 with PostCSS plugin (`@tailwindcss/postcss`)
- Design tokens defined in `globals.css` using `@theme inline` directive
- Theme variables follow shadcn/ui convention: `--background`, `--foreground`, `--primary`, `--muted`, etc.
- Dark mode via `next-themes` with class strategy
- Use `cn()` utility for conditional classes
- Biome enforces sorted Tailwind classes via `useSortedClasses` rule

### State Management

- Chat state: Managed by Vercel AI SDK `useChat()` hook
- Form state: TanStack Form with Zod validation
- Theme: `next-themes` ThemeProvider in root layout
- No global state management library (Redux, Zustand, etc.)

### AI Integration

The chat API follows Vercel AI SDK conventions:
- Route exports `POST` handler with `maxDuration` export
- Uses `streamText()` for streaming responses
- Returns `toUIMessageStreamResponse()` for client consumption
- Client uses `useChat()` which automatically handles streaming and messages

### TypeScript Configuration

- Strict mode enabled
- Path alias: `@/*` maps to root directory
- React 19 with new JSX transform (`jsx: "react-jsx"`)

## Important Patterns

1. Prefer arrow functions over function declarations for components, handlers, and utilities.
2. Avoid `useEffect` for syncing/deriving state. Use it only for true side effects (subscriptions, DOM integrations).
3. Use standard size naming: `xs`, `sm`, `md`, `lg`, `xl`.
4. Organize CVA base classes with arrays/comments when classes are long.
5. Use compound components for complex UI elements.
6. Use `cn()` from `lib/utils.ts` for className merging.
7. Follow Biome rules and formatting.
8. Use data attributes (`data-slot`, `data-role`) for styling and state selectors.
9. Leverage Motion for entrance/exit animations.
10. Use TipTap for rich text editing needs.
11. Follow AI SDK patterns (`useChat()`, `streamText()`, `toUIMessageStreamResponse()`).
12. Enforce library-style component design for this boilerplate: keep consistent component anatomy, naming, slot/subcomponent patterns, and extension points across features.

## Environment Variables

The project requires `.env.local` with Google AI credentials (e.g. `GOOGLE_API_KEY`) for `@ai-sdk/google`.
