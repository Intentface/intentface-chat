# Thread

The scrollable message viewport — a layout container that frames a chat: a scroll area, top/bottom blur overlays, a bottom-anchored composer dock, an empty-state placeholder, a "scroll to latest" button, and opt-in auto-scroll. It knows nothing about chats or messages; you compose those inside it. Single component (`components/ai/thread.tsx`), exposed as a compound API via `Thread.X`.

Import from `@/components/ai/thread`.

## Minimal usage

The bare skeleton — a scroll area with a composer dock:

```tsx
import { Thread } from "@/components/ai/thread";

<Thread>
  <Thread.Viewport>{/* your turns */}</Thread.Viewport>
  <Thread.Composer>{/* your composer */}</Thread.Composer>
</Thread>;
```

A realistic chat — overlays, auto-scroll, a scroll-to-latest button, and message turns:

```tsx
<Thread>
  <Thread.Overlay direction="top" />
  <Thread.Viewport>
    {messages.length === 0 ? (
      <Thread.Placeholder>
        <EmptyState />
      </Thread.Placeholder>
    ) : (
      turns.map((turn) => <Message.Turn key={turn.id}>{/* ... */}</Message.Turn>)
    )}
  </Thread.Viewport>
  <Thread.AutoScroll mode="follow" />
  <Thread.Composer>
    <Thread.ScrollButton />
    <Composer onSubmit={onSubmit}>{/* ... */}</Composer>
  </Thread.Composer>
  <Thread.Overlay direction="bottom" />
</Thread>;
```

`Thread` is a plain layout container — it reserves room for the composer automatically (it measures the dock), fades content under the overlays, and exposes scroll state via context. Auto-scroll is **opt-in**: mount `Thread.AutoScroll` for it, omit it for a plain scroll area.

## Auto-scroll modes

`Thread.AutoScroll` renders nothing; mount it to control how the view reacts when a turn is added and while a reply streams. The `mode` prop:

| `mode` | New turn lands at | Follows the streaming reply? | Feels like |
|---|---|---|---|
| `"follow"` (default) | top | yes | ChatGPT / Claude |
| `"jump"` | top | no | jump-to-top, then read freely |
| `"bottom"` | bottom | yes | Codex / classic chat |

Notes:

- **Follow is conditional.** When following, the view sticks to the bottom only while the user is already at the bottom; scrolling up releases it (and `Thread.ScrollButton` reappears). Scrolling back to the bottom re-engages.
- **"Lands at top"** means the newest turn is lifted so its top sits at the top of the viewport — the reply streams into the space below. It works by reserving a viewport-tall min-height on the last turn (see [Layout](#layout)).
- **Omitting `Thread.AutoScroll`** = a plain scroll area: no landing, no follow, no reserve. The scroll-to-latest button still works.

```tsx
<Thread.AutoScroll mode={scrollMode} />   // scrollMode: ThreadAutoScrollMode
```

## Scroll context

Any part inside `<Thread>` can read scroll state via `useThreadScroll()`:

```tsx
const { isAtBottom, scrollToBottom } = useThreadScroll();

scrollToBottom();           // smooth (default)
scrollToBottom("instant");  // jump
```

| Field | Type | Description |
|---|---|---|
| `isAtBottom` | `boolean` | Whether the bottom sentinel is in view (computed by an IntersectionObserver — no `scrollTop` reads). |
| `scrollToBottom` | `(behavior?: ScrollBehavior) => void` | Scroll the viewport to the bottom. Defaults to `"smooth"`. |
| `scrollRef` | `RefObject<HTMLDivElement \| null>` | The scroll container. |
| `contentRef` | `RefObject<HTMLDivElement \| null>` | The content column (turns are its direct children). |
| `sentinelRef` | `RefObject<HTMLDivElement \| null>` | The bottom sentinel used for at-bottom detection. |

Throws if used outside `<Thread>`.

## Compound parts

### `Thread` (root)
The layout container and scroll-state provider. Standard `div` props; renders with `role="log"`. Reserves space for the composer dock, defines the overlay heights, and sets up the scroll context.

### `Thread.Viewport`
The scroll area — holds the content column (your turns) and the bottom sentinel. Standard `div` props + `children`. The newest-turn reserve is applied here, so the last child can be lifted to the top.

### `Thread.Composer`
Bottom-anchored dock for your composer + the scroll button. Standard `div` props + `children`. Thread measures this dock to reserve bottom space, so content never hides behind it.

### `Thread.Overlay`
A progressive-blur band fading content into the top or bottom edge. `pointer-events-none`, so clicks pass through to the content.

| Prop | Type | Notes |
|---|---|---|
| `direction` | `"top" \| "bottom"` | Which edge to fade. Required. |
| …rest | `ProgressiveBlur` props | |

### `Thread.Placeholder`
Centered empty-state container — render it in place of turns when there are no messages. Standard `div` props + `children`.

### `Thread.ScrollButton`
A floating "Latest" button that appears (animated) only when the user is not at the bottom and scrolls to the bottom on click. Place it inside `Thread.Composer`. Standard `motion.div` props.

### `Thread.AutoScroll`
Opt-in scroll behavior. Renders nothing. See [Auto-scroll modes](#auto-scroll-modes).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `mode` | `ThreadAutoScrollMode` | `"follow"` | `"bottom" \| "jump" \| "follow"`. |

## Layout

Thread writes a few CSS variables via a `ResizeObserver` (not React state — composer growth never re-renders the thread):

| Variable | Meaning |
|---|---|
| `--thread-overlay-top-height` | Top overlay height + viewport top padding. Default `4rem`. |
| `--thread-overlay-bottom-height` | Bottom overlay height + viewport bottom padding. Measured from the composer dock (`[data-slot="composer-context-window"]` / `composer-container`); default `8rem`. |
| `--thread-turn-area` | The visible thread area (root − top − bottom). `Thread.AutoScroll` maps the last turn's reserve to this when landing at the top. |

You normally don't touch these — they keep the composer-dock spacing and the top-landing reserve self-adjusting.

## Reference: types

From `@/components/ai/thread`:

`ThreadRootProps`, `ThreadOverlayProps`, `ThreadViewportProps`, `ThreadComposerProps`, `ThreadPlaceholderProps`, `ThreadScrollButtonProps`, `ThreadAutoScrollProps`, `ThreadAutoScrollMode`.
