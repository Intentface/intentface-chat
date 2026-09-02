---
"@intentface/chat": minor
---

The ask-user flow is now a generic request flow: consumer-minted ids and option values replace display-text identity, so tool approvals (and any future choice put to the user) need no new types. One term throughout — requests in, resolved requests back.

Migration:

| Before | After |
| --- | --- |
| prop `questions` | `requests` (entries now require an `id` you mint) |
| `AskUserQuestion` | `ComposerRequest`; field `question` → `label` |
| `AskUserOption` | `ComposerRequestOption` (gains optional `value`, echoed back; falls back to `label`) |
| `ComposerAnswerEntry` (4-variant union) | `ComposerRequestEntry` — flat `{ id, selected: string[], text? }`; `text` present only when typed; skipped entries have `selected: []` |
| `ComposerAnswersSubmit`, `kind: "answers"`, `data.answers` | `ComposerRequestsSubmit`, `kind: "requests"`, `data.requests` |
| `ComposerAskUserState`, slice `composer.askUser` | `ComposerRequestsState`, slice `composer.requests` (fields `questions` → `items`, `answers` → `drafts: Map<number, RequestDraft>`) |
| store `setQuestions` / `activateAskUser` / `submitAnswersRef` | `setRequests` / `activateRequests` / `submitRequestsRef` |
| `interpretAskUserKey` | `interpretRequestKey` |
| `EditorKeyContext.hasActiveAskUser` | `hasActiveRequests` |
| `EditorKeyAction` `"ask-user-arrow"` / `"ask-user-dismiss"` | `"request-arrow"` / `"request-dismiss"` |
| subpath `@intentface/chat/ask-user` | `@intentface/chat/ask` |
| namespace `AskUser.*`, hooks `useAskUserOption(s)`, `AskUser*Props` | `Ask.*`, `useAskOption(s)`, `Ask*Props` |
| attributes `data-ask-user-*` | `data-ask-*` |

Also in this change:

- `requests={[]}` no longer arms request mode — an empty array normalizes to `null`, so the slice can't read active with nothing to render.
- The request flow's document keydown listener no longer claims events from unrelated elements; it accepts its own editor, its own options, and the `<body>` focus fallback it exists for. Space on an unrelated button can no longer select an option.
- `Ask.Previous` / `Ask.Next` default accessible names are now "Previous request" / "Next request" (override via `aria-label`), since the flow is no longer questions-only.
- A disabled composer's hidden form mirror is unchanged here — tracked separately in CHAT-28.
