"use client";

// Composer.CommandList family — resolution (sync/async items, fuzzy filter),
// keyboard/mouse selection, chip insertion, dismissal, and the nav/items
// context split (highlight changes don't re-render the items map, and items
// mutations don't re-render every row). All unstyled; state surfaces as
// data-state / data-highlighted.

import {
  type ComponentProps,
  createContext,
  Fragment,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Commands } from "../commands";
import { filterArrayItems } from "./fuzzy";
import { useAsRef, useComposerInternals } from "./internals";
import { commandListPluginKey } from "./prefix-plugin";
import { useComposer, useComposerStore } from "./store";
import type { CommandItemData, ComposerCommandsItems, PrefixOnSelectContext } from "./types";

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

const EMPTY_ITEMS: CommandItemData[] = [];

export type ComposerCommandListProps = {
  prefix: string;
  className?: string;
  children?: ReactNode;
};

export const ComposerCommandList = ({ prefix, className, children }: ComposerCommandListProps) => {
  const store = useComposerStore();
  const attachments = useComposer((composer) => composer.attachments);
  const internals = useComposerInternals();

  const isActive = useComposer(
    (composer) => composer.commands.isOpen && composer.commands.trigger === prefix,
  );
  const query = useComposer((composer) => composer.commands.query);

  const config = internals.commands[prefix];
  const itemsProp = config?.items ?? EMPTY_ITEMS;
  const kind = config?.kind ?? "execute";

  const { items, state } = useResolvedItems(itemsProp, query, isActive);

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
      const dataItem = items.find((item) => item.value === value);
      if (!dataItem) return;

      const pluginState = commandListPluginKey.getState(editor.state);
      const triggerStartPosition = pluginState?.triggerStartPosition ?? 0;
      const triggerEndPosition =
        pluginState?.triggerEndPosition ?? editor.state.selection.$from.pos;

      if (kind === "insert") {
        // Add a trailing space so the user can keep typing — unless one is
        // already there (mid-sentence mention), to avoid doubling it.
        const docEnd = editor.state.doc.content.size;
        const charAfter =
          triggerEndPosition < docEnd
            ? editor.state.doc.textBetween(triggerEndPosition, triggerEndPosition + 1)
            : "";
        const chain = editor
          .chain()
          .focus()
          .deleteRange({ from: triggerStartPosition, to: triggerEndPosition })
          .insertContentAt(triggerStartPosition, {
            type: "mentionChip",
            attrs: {
              prefix,
              label: dataItem.label ?? dataItem.value,
              value: dataItem.value,
              icon: dataItem.icon ?? null,
              variant: dataItem.variant ?? null,
            },
          });
        if (charAfter !== " ") chain.insertContent(" ");
        chain.run();
      } else {
        editor
          .chain()
          .focus()
          .deleteRange({ from: triggerStartPosition, to: triggerEndPosition })
          .run();
        const onSelectContext: PrefixOnSelectContext = {
          editor: store.controller,
          attachments: {
            add: attachments.add,
            remove: attachments.remove,
            openFileDialog: attachments.openFileDialog,
          },
        };
        dataItem.onSelect?.(onSelectContext);
      }

      editor.view.dispatch(editor.state.tr.setMeta(commandListPluginKey, { close: true }));
    },
    [store, items, kind, prefix, attachments],
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
  }, [selectState]);
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

  if (!isActive) return null;

  return (
    <CommandListItemsContext value={itemsContext}>
      <CommandListNavContext value={navContext}>
        <div
          ref={registerSelect}
          data-slot="composer-command-list"
          data-state={state}
          className={className}
        >
          {children}
        </div>
      </CommandListNavContext>
    </CommandListItemsContext>
  );
};

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

export type ComposerCommandItemsProps<Item extends CommandItemData> = {
  className?: string;
  children: (item: Item) => ReactNode;
};

export const ComposerCommandItems = <Item extends CommandItemData>({
  className,
  children: renderItem,
}: ComposerCommandItemsProps<Item>): ReactNode => {
  const { items } = useCommandListItems<Item>();

  return (
    <div data-slot="composer-command-items" className={className}>
      {items.map((item, index) => (
        <Fragment key={item.value ?? `__cmd_${index}`}>{renderItem(item)}</Fragment>
      ))}
    </div>
  );
};

export type ComposerCommandLoadingProps = ComponentProps<"div">;

export const ComposerCommandLoading = ({ children, ...props }: ComposerCommandLoadingProps) => (
  <div data-slot="composer-command-loading" {...props}>
    {children ?? "Loading…"}
  </div>
);

export type ComposerCommandEmptyProps = ComponentProps<"div">;

export const ComposerCommandEmpty = ({ children, ...props }: ComposerCommandEmptyProps) => (
  <div data-slot="composer-command-empty" {...props}>
    {children ?? "No results found"}
  </div>
);

// Dismisses the active token (same as Escape): closes the popup, leaves the
// typed text in place, and keeps it dismissed until the prefix is retyped.
// preventDefault on mousedown so the click never steals focus from the editor.
export type ComposerCommandDismissProps = ComponentProps<"button">;

export const ComposerCommandDismiss = ({ children, ...props }: ComposerCommandDismissProps) => {
  const navContext = useCommandListNav("CommandDismiss");

  return (
    <button
      type="button"
      data-slot="composer-command-dismiss"
      onMouseDown={(event) => {
        event.preventDefault();
        navContext.dismiss();
      }}
      {...props}
    >
      {children ?? "Dismiss"}
    </button>
  );
};

export type ComposerCommandItemProps = {
  value: string;
  className?: string;
  children?: ReactNode;
};

export const ComposerCommandItem = ({ value, className, children }: ComposerCommandItemProps) => {
  const navContext = useCommandListNav("CommandItem");

  const isHighlighted = navContext.highlightedValue === value;

  return (
    <Commands.Item
      ref={isHighlighted ? navContext.scrollHighlightedIntoView : undefined}
      data-slot="composer-command-item"
      highlighted={isHighlighted}
      className={className}
      onMouseDown={(event) => {
        event.preventDefault();
        navContext.selectByValue(value);
      }}
      onMouseEnter={() => navContext.setHighlightedValue(value)}
    >
      {children}
    </Commands.Item>
  );
};

export type ComposerCommandItemIconProps = ComponentProps<"span">;

export const ComposerCommandItemIcon = (props: ComposerCommandItemIconProps) => (
  <span data-slot="composer-command-item-icon" {...props} />
);

export type ComposerCommandItemLabelProps = ComponentProps<"span">;

export const ComposerCommandItemLabel = (props: ComposerCommandItemLabelProps) => (
  <span data-slot="composer-command-item-label" {...props} />
);

export type ComposerCommandItemDescriptionProps = ComponentProps<"span">;

export const ComposerCommandItemDescription = (props: ComposerCommandItemDescriptionProps) => (
  <span data-slot="composer-command-item-description" {...props} />
);

export type ComposerCommandGroupProps = ComponentProps<"div">;

export const ComposerCommandGroup = (props: ComposerCommandGroupProps) => (
  <Commands.Group {...props} />
);

export type ComposerCommandGroupLabelProps = ComponentProps<"div">;

export const ComposerCommandGroupLabel = (props: ComposerCommandGroupLabelProps) => (
  <div data-slot="composer-command-group-label" {...props} />
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

// Default render for all registered command lists: one CommandList per
// registered prefix with an icon + label + description row. Unstyled — the
// styled layer ships its own default with its classes and icon map.
export type ComposerCommandsProps = {
  className?: string;
};

export const ComposerCommands = ({ className }: ComposerCommandsProps) => {
  const { commands, chipIconsRef } = useComposerInternals();
  const prefixes = Object.keys(commands);

  return (
    <>
      {prefixes.map((prefix) => (
        <ComposerCommandList key={prefix} prefix={prefix} className={className}>
          <ComposerCommandLoading />
          <ComposerCommandEmpty>
            <span>No results found</span>
            <ComposerCommandDismiss />
          </ComposerCommandEmpty>
          <ComposerCommandItems>
            {(item) => (
              <ComposerCommandItem value={item.value}>
                {item.icon && (
                  <ComposerCommandItemIcon>
                    {chipIconsRef.current[item.icon]}
                  </ComposerCommandItemIcon>
                )}
                <ComposerCommandItemLabel>{item.label}</ComposerCommandItemLabel>
                {item.description && (
                  <ComposerCommandItemDescription>
                    {item.description}
                  </ComposerCommandItemDescription>
                )}
              </ComposerCommandItem>
            )}
          </ComposerCommandItems>
        </ComposerCommandList>
      ))}
    </>
  );
};
