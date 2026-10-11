# @intentface/chat

## 0.5.2

### Patch Changes

- Add JSDoc to every part of `Attachments`, `Chip`, `Message`, `Reasoning` and `Steps`, so editors show the same reference as the docs.
- Refresh the README to match the rewritten docs.

## 0.5.1

### Patch Changes

- [Thread] Fix losing the bottom while the container is resized.

## 0.5.0

### Minor Changes

- [Tabs] Fix `dismissOnEscape` closing the panel on an Escape another handler already prevented.
- [Composer] Fix an Escape in one composer stopping generation in another.
- [Composer] [Breaking] Escape stops generation only from inside `Composer.Root`. To stop on any Escape, handle it on your chat container, such as `Thread.Root`.

## 0.4.0

### Minor Changes

- [Nav] New `Nav.Toggle`: a caret inside `Nav.Trigger`, so a branch row can also be a page.
- [Nav] Add `aria-current="page"` to active `Nav.Item` and `Nav.Trigger` rows.
- [Nav] Fix a disabled `Nav.Trigger` rendered as a link still navigating.
- [Nav] Fix Space not following a link row.
- [Tabs] New `openOnHover`, `openDelay` and `closeDelay` on `Tabs.Trigger`.
- [Tabs] Add `eventDetails` to `onValueChange` and `onItemsChange`, with `reason` and `cancel()`, so a close can be cancelled.
- [Tabs] Fix Escape from a floating `Tabs.Popup` dropping focus instead of returning it to its tab.
- [Breaking] `event.preventBaseUIHandler()` is now `event.preventPrimitiveHandler()`, and `event.baseUIHandlerPrevented` is now `event.primitiveHandlerPrevented`.

## 0.3.0

### Minor Changes

- [Shell] New primitive: a collapsible, resizable sidebar with hover-peek.
- [Nav] New primitive: a nav tree with roving focus, typeahead and a guide ladder.
- [Tabs] New primitive: closable tabs whose panel renders in the layout or anchored to its tab.
- [Composer] Fix a closing `Composer.Panel` staying mounted when there was nothing to animate.
- Fix anchored surfaces animating in from before they were placed, and add `--anchor-available-width`.

## 0.2.1

### Patch Changes

- [Thread] Fix visibly scrolling to the bottom while the container animates open.
- [Thread] Fix losing a few pixels of scroll position when the composer changes height.

## 0.2.0

### Minor Changes

- [Steps] [Reasoning] Fix the panel clipping content that grows after it opens.
- [Steps] [Reasoning] [Breaking] The panel height variable `--collapsible-panel-height` is now `--panel-height`.
- [Thread] [Breaking] `Thread.Root` no longer takes `dockSelector`. Put the composer in `Thread.Composer` and it is measured automatically.

### Patch Changes

- [Composer] Fix `Composer.Textarea` gaining phantom newlines during rapid editing.
- Fix the npm registry listing `exports` paths the package doesn't ship. Installs were unaffected.
- Point `homepage` and the README links at https://ui.intentface.com.

## 0.1.2

### Patch Changes

- Fix the package failing to load during server-side rendering.

## 0.1.1

### Patch Changes

- Fix a regex in `parseChipSegments` that could hang the browser on long messages.
- [Composer] Fix a regex that could freeze the editor on large pasted text.

## 0.1.0

### Minor Changes

- Initial release: headless chat primitives for React. `Composer`, `Thread`, `Message`, `Steps`, `Reasoning`, `Chip`, `Attachments` and `AskUser`, plus the message types and utilities.
