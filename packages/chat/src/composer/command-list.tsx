"use client";

// Composer.CommandList family — resolution (sync/async items, fuzzy filter),
// keyboard/mouse selection, chip insertion, dismissal, and the nav/items
// context split (highlight changes don't re-render the items map, and items
// mutations don't re-render every row). All unstyled; state panels as
// data-state / data-highlighted.

import type { Editor } from "@tiptap/react";
import {
  type ComponentProps,
  createContext,
  Fragment,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";
import { Commands } from "./commands";
import { filterArrayItems } from "./fuzzy";
import { useAsRef, useComposerInternals } from "./internals";
import { commandListPluginKey } from "./prefix-plugin";
import { useComposer, useComposerContextStore } from "./store";
import type { CommandItemData, ComposerCommandsItems, PrefixOnSelectContext } from "./types";

// ---------------------------------------------------------------------------
// Types & contexts — a two-context split so navigation and item resolution
// re-render independently.
// ---------------------------------------------------------------------------

export type CommandListState = "loading" | "empty" | "ready";

// Nav slice — updates on arrow-key navigation. Consumed by `Composer.CommandItem`.
type CommandListNavContextValue = {
  highlightedValue: string | null;
  setHighlightedValue: (value: string | null) => void;
  selectByValue: (value: string) => void;
  dismiss: () => void;
  // Stable callback ref the highlighted row attaches to: stores nothing, just
  // scrolls itself into view when it becomes the highlight (no effect).
  scrollHighlightedIntoView: (node: HTMLElement | null) => void;
};

const CommandListNavContext = createContext<CommandListNavContextValue | null>(null);

// Items slice — updates on items resolution. Consumed by `Composer.CommandItems`.
type CommandListItemsContextValue = {
  items: CommandItemData[];
  state: CommandListState;
};

const CommandListItemsContext = createContext<CommandListItemsContextValue | null>(null);

// ---------------------------------------------------------------------------
// Item resolution — turn the prefix's items config (array or async callback)
// into the current filtered list + loading/empty/ready state.
// ---------------------------------------------------------------------------

const useResolvedItems = (
  itemsProp: ComposerCommandsItems,
  query: string,
  isActive: boolean,
): { items: CommandItemData[]; state: CommandListState } => {
  const isCallback = typeof itemsProp === "function";

  const [asyncState, setAsyncState] = useState<{
    items: CommandItemData[];
    loading: boolean;
  }>(() => ({ items: [], loading: isCallback }));

  useEffect(() => {
    if (typeof itemsProp !== "function") return;
    if (!isActive) return;

    const controller = new AbortController();
    let cancelled = false;

    let result: CommandItemData[] | Promise<CommandItemData[]>;
    try {
      result = itemsProp(query, { signal: controller.signal });
    } catch (error) {
      console.warn("Composer.commands items callback threw:", error);
      setAsyncState({ items: [], loading: false });
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    if (result instanceof Promise) {
      setAsyncState((previous) => ({ ...previous, loading: true }));
      result.then(
        (resolved) => {
          if (cancelled) return;
          setAsyncState({ items: resolved, loading: false });
        },
        (error) => {
          if (cancelled) return;
          if ((error as { name?: string })?.name === "AbortError") return;
          console.warn("Composer.commands items callback rejected:", error);
          setAsyncState((previous) => ({ ...previous, loading: false }));
        },
      );
    } else {
      setAsyncState({ items: result, loading: false });
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [itemsProp, query, isActive]);

  if (Array.isArray(itemsProp)) {
    const items = filterArrayItems(itemsProp, query);
    return { items, state: items.length === 0 ? "empty" : "ready" };
  }

  if (asyncState.loading) {
    // Locally filter the most-recent resolved set so typing feels instant
    // while the new fetch is in flight. The server result replaces this once
    // it lands.
    return {
      items: filterArrayItems(asyncState.items, query),
      state: "loading",
    };
  }

  return {
    items: asyncState.items,
    state: asyncState.items.length === 0 ? "empty" : "ready",
  };
};

// ---------------------------------------------------------------------------
// Selection helpers — the editor mutations a selection performs, split out of
// the CommandList component so its `selectByValue` reads as a plain dispatch.
// ---------------------------------------------------------------------------

// The active trigger's document range, read from the plugin's mirror. Falls
// back to the caret when the plugin has no active token.
const resolveTriggerRange = (editor: Editor): { from: number; to: number } => {
  const pluginState = commandListPluginKey.getState(editor.state);
  return {
    from: pluginState?.triggerStartPosition ?? 0,
    to: pluginState?.triggerEndPosition ?? editor.state.selection.$from.pos,
  };
};

// Replace the trigger range with a mention chip. Adds a trailing space so the
// user can keep typing — unless one already follows (mid-sentence mention), to
// avoid doubling it.
const insertMentionChip = (
  editor: Editor,
  prefix: string,
  item: CommandItemData,
  range: { from: number; to: number },
) => {
  const docEnd = editor.state.doc.content.size;
  const charAfter = range.to < docEnd ? editor.state.doc.textBetween(range.to, range.to + 1) : "";
  const chain = editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContentAt(range.from, {
      type: "mentionChip",
      attrs: {
        prefix,
        label: item.label ?? item.value,
        value: item.value,
        icon: item.icon ?? null,
      },
    });
  if (charAfter !== " ") chain.insertContent(" ");
  chain.run();
};

// ---------------------------------------------------------------------------
// Composer.CommandList — the orchestrator: resolves items for the active
// prefix, owns the highlight/selection/dismiss logic, and provides the two
// contexts. Renders null unless this prefix is the active one.
// ---------------------------------------------------------------------------

const EMPTY_ITEMS: CommandItemData[] = [];

export type ComposerCommandListState = {
  /** Present as data-loading while an async items callback is in flight. */
  loading: boolean;
  /** Present as data-empty when nothing matches the query. */
  empty: boolean;
};

export type ComposerCommandListProps = PrimitiveProps<"div", ComposerCommandListState> & {
  prefix: string;
};

export const ComposerCommandList = ({
  prefix,
  className,
  render,
  style,
  children,
  ...elementProps
}: ComposerCommandListProps) => {
  const store = useComposerContextStore();
  const internals = useComposerInternals();

  // Renders while this prefix is the active one AND through its close animation. `active`
  // flips false the instant the trigger closes, but the store keeps `present` sticky until
  // the Panel's exit animation finishes (finalizePanelClose). `wasActiveRef` marks that this
  // prefix — not a sibling — is the one closing, so only it keeps rendering during the window.
  const isActive = useComposer(
    (composer) => composer.commands.active && composer.commands.trigger === prefix,
  );
  const present = useComposer((composer) => composer.commands.present);
  const query = useComposer((composer) => composer.commands.query);

  const wasActiveRef = useRef(false);
  if (isActive) wasActiveRef.current = true;
  else if (!present) wasActiveRef.current = false;
  const isPresent = isActive || (present && wasActiveRef.current);

  const config = internals.commands[prefix];
  const itemsProp = config?.items ?? EMPTY_ITEMS;
  const kind = config?.kind ?? "execute";

  // Freeze the last resolved items while closing so the exiting panel shows what it had,
  // not a re-filter/re-fetch against the now-empty query.
  const resolved = useResolvedItems(itemsProp, query, isActive);
  const lastResolvedRef = useRef(resolved);
  if (isActive) lastResolvedRef.current = resolved;
  const { items, state } = isActive ? resolved : lastResolvedRef.current;

  // The highlight index lives in the store (so the editor's keydown handler can
  // move it). It's raw/unbounded; wrap it by the current item count here. An
  // empty list has no highlighted row — the "No results" row stands in as the
  // sole selectable.
  const highlightIndex = useComposer((composer) => composer.commands.highlightIndex);
  const activeIndex =
    items.length > 0 ? ((highlightIndex % items.length) + items.length) % items.length : -1;
  const effectiveHighlight = items[activeIndex]?.value ?? null;

  const selectByValue = useCallback(
    (value: string) => {
      const editor = store.editorRef.current;
      if (!editor) return;
      const item = items.find((candidate) => candidate.value === value);
      if (!item) return;

      const range = resolveTriggerRange(editor);

      if (kind === "insert") {
        insertMentionChip(editor, prefix, item, range);
      } else {
        editor.chain().focus().deleteRange(range).run();
        // Read the attachment actions lazily at selection time — their
        // identities are store-stable, so subscribing would only re-render the
        // list on unrelated attachment changes.
        const { add, remove, openFileDialog } = store.getSnapshot().attachments;
        const onSelectContext: PrefixOnSelectContext = {
          editor: store.controller,
          attachments: { add, remove, openFileDialog },
        };
        item.onSelect?.(onSelectContext);
      }

      editor.view.dispatch(editor.state.tr.setMeta(commandListPluginKey, { close: true }));
    },
    [store, items, kind, prefix],
  );

  const dismiss = useCallback(() => {
    const editor = store.editorRef.current;
    if (!editor) return;
    editor.view.focus();
    editor.view.dispatch(editor.state.tr.setMeta(commandListPluginKey, { close: true }));
  }, [store]);

  // The editor's keydown handler invokes the current selection through
  // commandSelectRef. Keep the latest values in a ref so the callback stays
  // stable, and register it via the root's callback ref (commit-time) — not an
  // effect, not a render-phase assignment.
  const selectState = useAsRef({ effectiveHighlight, selectByValue, dismiss, state });
  const runSelect = useCallback(() => {
    const { effectiveHighlight, selectByValue, dismiss, state } = selectState.current;
    // With a match, select it. When empty, the "No results" row is the sole
    // option and selecting it dismisses — so Tab/Enter aren't dead (Linear-style).
    if (effectiveHighlight) selectByValue(effectiveHighlight);
    else if (state === "empty") dismiss();
  }, []);
  const registerSelect = useCallback(
    (node: HTMLDivElement | null) => {
      store.commandSelectRef.current = node ? runSelect : null;
    },
    [store, runSelect],
  );

  // Scroll the highlighted row into view as it becomes the highlight. Stable, so
  // React calls it only on highlight change — no per-render scroll, no effect.
  const scrollHighlightedIntoView = useCallback((node: HTMLElement | null) => {
    node?.scrollIntoView({ block: "nearest" });
  }, []);

  const navContext = useMemo<CommandListNavContextValue>(
    () => ({
      highlightedValue: effectiveHighlight,
      setHighlightedValue: (value) => {
        const index = value === null ? -1 : items.findIndex((item) => item.value === value);
        if (index >= 0) store.setHighlight(index);
      },
      selectByValue,
      dismiss,
      scrollHighlightedIntoView,
    }),
    [effectiveHighlight, items, selectByValue, dismiss, scrollHighlightedIntoView, store],
  );

  const itemsContext = useMemo<CommandListItemsContextValue>(
    () => ({ items, state }),
    [items, state],
  );

  const element = useRenderElement(
    "div",
    { className, render, style },
    {
      enabled: isPresent,
      state: { loading: state === "loading", empty: state === "empty" },
      ref: registerSelect,
      props: [{ "data-slot": "composer-command-list", children }, elementProps],
    },
  );

  if (!isPresent) return null;

  return (
    <CommandListItemsContext value={itemsContext}>
      <CommandListNavContext value={navContext}>{element}</CommandListNavContext>
    </CommandListItemsContext>
  );
};

// ---------------------------------------------------------------------------
// List hooks — the consumer-facing items hook and the internal nav accessor
// the slot primitives read.
// ---------------------------------------------------------------------------

export const useCommandListItems = <Item extends CommandItemData = CommandItemData>(): {
  items: Item[];
  state: CommandListState;
} => {
  const context = use(CommandListItemsContext);
  if (!context) {
    throw new Error("<Composer.CommandItems> must be rendered inside <Composer.CommandList>.");
  }
  return context as { items: Item[]; state: CommandListState };
};

const useCommandListNav = (componentName: string): CommandListNavContextValue => {
  const context = use(CommandListNavContext);
  if (!context) {
    throw new Error(`<Composer.${componentName}> must be rendered inside <Composer.CommandList>.`);
  }
  return context;
};

// ---------------------------------------------------------------------------
// Slot primitives — unstyled structural parts of the list. Each sets its
// data-slot and forwards props; the styled layer supplies the look.
// ---------------------------------------------------------------------------

export type ComposerCommandItemsProps<Item extends CommandItemData> = Omit<
  PrimitiveProps<"div">,
  "children"
> & {
  children: (item: Item) => ReactNode;
};

export const ComposerCommandItems = <Item extends CommandItemData>({
  className,
  render,
  style,
  children: renderItem,
  ...elementProps
}: ComposerCommandItemsProps<Item>): ReactNode => {
  const { items } = useCommandListItems<Item>();

  return useRenderElement(
    "div",
    { className, render, style },
    {
      props: [
        {
          "data-slot": "composer-command-items",
          children: items.map((item, index) => (
            <Fragment key={item.value ?? `__cmd_${index}`}>{renderItem(item)}</Fragment>
          )),
        },
        elementProps,
      ],
    },
  );
};

export type ComposerCommandLoadingProps = PrimitiveProps<"div">;

export const ComposerCommandLoading = ({
  children,
  className,
  render,
  style,
  ...elementProps
}: ComposerCommandLoadingProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    {
      props: [{ "data-slot": "composer-command-loading", children }, elementProps],
    },
  );

export type ComposerCommandEmptyProps = PrimitiveProps<"div">;

export const ComposerCommandEmpty = ({
  children,
  className,
  render,
  style,
  ...elementProps
}: ComposerCommandEmptyProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    {
      props: [{ "data-slot": "composer-command-empty", children }, elementProps],
    },
  );

// Dismisses the active token (same as Escape): closes the popup, leaves the
// typed text in place, and keeps it dismissed until the prefix is retyped.
// preventDefault on mousedown so the click never steals focus from the editor.
export type ComposerCommandDismissProps = PrimitiveProps<"button">;

export const ComposerCommandDismiss = ({
  children,
  className,
  render,
  style,
  ...elementProps
}: ComposerCommandDismissProps) => {
  const navContext = useCommandListNav("CommandDismiss");

  return useRenderElement(
    "button",
    { className, render, style },
    {
      props: [
        {
          "data-slot": "composer-command-dismiss",
          onMouseDown: (event: React.MouseEvent) => {
            event.preventDefault();
            navContext.dismiss();
          },
          children,
        },
        elementProps,
      ],
    },
  );
};

export type ComposerCommandItemProps = Omit<ComponentProps<typeof Commands.Item>, "highlighted"> & {
  value: string;
};

export const ComposerCommandItem = ({ value, ...props }: ComposerCommandItemProps) => {
  const navContext = useCommandListNav("CommandItem");

  const isHighlighted = navContext.highlightedValue === value;

  return (
    <Commands.Item
      ref={isHighlighted ? navContext.scrollHighlightedIntoView : undefined}
      data-slot="composer-command-item"
      highlighted={isHighlighted}
      onMouseDown={(event) => {
        event.preventDefault();
        navContext.selectByValue(value);
      }}
      onMouseEnter={() => navContext.setHighlightedValue(value)}
      {...props}
    />
  );
};

export type ComposerCommandItemIconProps = PrimitiveProps<"span">;

export const ComposerCommandItemIcon = ({
  className,
  render,
  style,
  ...elementProps
}: ComposerCommandItemIconProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-slot": "composer-command-item-icon" }, elementProps] },
  );

export type ComposerCommandItemLabelProps = PrimitiveProps<"span">;

export const ComposerCommandItemLabel = ({
  className,
  render,
  style,
  ...elementProps
}: ComposerCommandItemLabelProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-slot": "composer-command-item-label" }, elementProps] },
  );

export type ComposerCommandItemDescriptionProps = PrimitiveProps<"span">;

export const ComposerCommandItemDescription = ({
  className,
  render,
  style,
  ...elementProps
}: ComposerCommandItemDescriptionProps) =>
  useRenderElement(
    "span",
    { className, render, style },
    { props: [{ "data-slot": "composer-command-item-description" }, elementProps] },
  );

export type ComposerCommandGroupProps = ComponentProps<typeof Commands.Group>;

export const ComposerCommandGroup = (props: ComposerCommandGroupProps) => (
  <Commands.Group {...props} />
);

export type ComposerCommandGroupLabelProps = PrimitiveProps<"div">;

export const ComposerCommandGroupLabel = ({
  className,
  render,
  style,
  ...elementProps
}: ComposerCommandGroupLabelProps) =>
  useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-slot": "composer-command-group-label" }, elementProps] },
  );

export type ComposerCommandCollectionProps<Item> = {
  items: Item[];
  children: (item: Item) => ReactNode;
};

export const ComposerCommandCollection = <Item,>({
  items,
  children: renderItem,
}: ComposerCommandCollectionProps<Item>): ReactNode => (
  <>
    {items.map((item, index) => (
      <Fragment key={(item as { value?: string } | null)?.value ?? `__col_${index}`}>
        {renderItem(item)}
      </Fragment>
    ))}
  </>
);
