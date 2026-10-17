"use client";

// Headless renderer for generative UI: a spec or a view, drawn with the
// consumer's components. The package owns reading the input — while it
// streams, after it is whole, and when part of it breaks — and the logic of
// every piece (formatted values, state, callbacks), handed over as render
// props. It owns no pixels: every element, view, placeholder and entrance is a
// component from the map the consumer passes to Root. Nothing here reads a
// thread, a message or a chat; it mounts wherever a spec does (a document
// node, a slide, a share).
//
// Root renders no element. Spec and View render no wrapper around what they
// draw either, so a Grid's children are the grid's children: anything the
// package put between them would be in the consumer's layout. Only the
// package's own defaults (Pending, Placeholder, Fallback) and Part render DOM,
// and those carry bespoke data-genui-* attributes for styling.

import {
  Component,
  type ComponentType,
  type CSSProperties,
  createContext,
  type ErrorInfo,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import type { z } from "zod";
import { type BoundData, bindingRefs, hasBinding, withData } from "../genui/bindings";
import {
  type Catalog,
  type DefaultCatalog,
  defaultCatalog,
  type ElementName,
  type ElementProps,
  type ElementRender,
  isViewName,
  type ViewName,
  type ViewProps,
  type ViewRender,
} from "../genui/catalog";
import type { Phase } from "../genui/define";
import { exportSpec, exportView, resolveSpec, type UnboundPiece } from "../genui/export";
import type { FormatOptions } from "../genui/format";
import { type LooseSpec, normaliseView, readSpec } from "../genui/spec";
import { type ElementUiState, initialState, type UiState, VIEW_STATE_ID } from "../genui/state";
import {
  type ChangeEventDetails,
  createChangeEventDetails,
} from "../internal/change-event-details";
import type { PrimitiveProps } from "../internal/primitive-props";
import { useRenderElement } from "../internal/render/useRenderElement";
import { useControlled } from "../internal/use-controlled";
import { registerPart } from "./copy";

// ---------------------------------------------------------------------------
// The component map
// ---------------------------------------------------------------------------

/** What an element's component is drawn with: its render props, its schema props, its children. */
export type GenUiElementProps<
  C extends Catalog = DefaultCatalog,
  Name extends ElementName<C> = ElementName<C>,
> = ElementRender<C, Name> & { props: ElementProps<C, Name>; children?: ReactNode };

/** What a view's component is drawn with: its render props, its schema props, its caption. */
export type GenUiViewComponentProps<
  C extends Catalog = DefaultCatalog,
  Name extends ViewName<C> = ViewName<C>,
> = ViewRender<C, Name> & { props: ViewProps<C, Name>; title?: string };

/** A piece with no component in the map, drawn from its Markdown. */
export type GenUiFallbackProps = { markdown: string; id?: string; type: string };

type Slots = {
  /**
   * Nothing drawable yet: the view or the root hasn't arrived. Only while
   * streaming — a whole input with nothing to draw draws nothing.
   */
  Placeholder?: ComponentType<{ title?: string }>;
  /**
   * One element whose props haven't parsed yet, while it streams. A container
   * is given the children that have arrived, so a card still being written
   * doesn't hide everything under it.
   */
  Pending?: ComponentType<{ type: string; container: boolean; children?: ReactNode }>;
  /**
   * A whole piece whose data is bound and wasn't resolved. Null by default —
   * a chat that refuses unresolved calls never gets here — but a document
   * that stores bindings should say the data is elsewhere rather than leave a
   * gap that reads as "nothing". See `ExportOptions.onUnbound`.
   */
  Unbound?: ComponentType<UnboundPiece>;
  /**
   * A piece the map has no component for — a spec written against a wider
   * catalog than this host draws — given its Markdown, the subtree's for a
   * container. Drawn as plain text by default; a host with a Markdown
   * renderer passes its own.
   */
  Fallback?: ComponentType<GenUiFallbackProps>;
  /**
   * Wraps each drawn piece while `live`: the place for an entrance. Keyed so
   * that a view replacing its placeholder arrives as a new piece, rather than
   * swapping silently inside a wrapper that has already arrived.
   */
  Arrive?: ComponentType<{ children: ReactNode }>;
};

/**
 * Names to components, typed against the catalog as mapped types: an element
 * the catalog declares with no component here — or a component whose props
 * don't match its render props — is a type error. Build one with
 * `defineComponents`.
 */
export type GenUiComponents<C extends Catalog = DefaultCatalog> = Slots & {
  elements: { [Name in ElementName<C>]: ComponentType<GenUiElementProps<C, Name>> };
  views?: { [Name in ViewName<C>]: ComponentType<GenUiViewComponentProps<C, Name>> };
};

/**
 * What Root takes: any part of a map for the catalog it reads. A reader reads
 * against the widest catalog, so a host may lack a component; that piece is
 * drawn through `Fallback`.
 */
export type GenUiComponentMap<C extends Catalog = DefaultCatalog> = Slots & {
  elements: Partial<GenUiComponents<C>["elements"]>;
  views?: Partial<NonNullable<GenUiComponents<C>["views"]>>;
};

/**
 * A component map, checked against the catalog it draws: every element
 * needs a component, and each component's props must match its entry's.
 */
export const defineComponents = <C extends Catalog>(
  _catalog: C,
  components: GenUiComponents<C>,
): GenUiComponents<C> => components;

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

/** A state change, with the piece it came from. `cancel()` keeps it from landing. */
export type GenUiStateChangeDetails = ChangeEventDetails<string> & {
  piece: { id?: string; type: string };
};

type RootContextValue = {
  catalog: Catalog;
  components: GenUiComponentMap<Catalog>;
  phase: Phase;
  live: boolean;
  format: FormatOptions;
  state: UiState;
  update: (
    piece: { id: string; type: string },
    patch: Partial<ElementUiState>,
    reason: string,
  ) => void;
  onError: (error: unknown, piece: { id?: string; type: string }) => void;
};

const RootContext = createContext<RootContextValue | null>(null);

const useRoot = (part: string) => {
  const context = use(RootContext);
  if (!context) throw new Error(`GenUi.${part} must be inside GenUi.Root.`);
  return context;
};

export type GenUiRootProps<C extends Catalog = DefaultCatalog> = {
  /**
   * The catalog to read the input against: the widest the host knows, so a
   * spec written under a wider preset still loads. The default catalog when
   * omitted.
   */
  catalog?: C;
  /** Components by name. A piece without one is drawn through `Fallback`. */
  components: GenUiComponentMap<C>;
  /**
   * How far the input has got: `streaming` while it is written, `complete`
   * once whole, `accepted` once `canonicalSpec` or `canonicalView` passed it.
   * While streaming, props that don't parse yet are pending rather than
   * dropped, and long arrays are settled. `accepted` by default: a stored
   * spec has been.
   */
  phase?: Phase;
  /**
   * Whether the input is being written as it is drawn. Pieces that arrive
   * then go through `Arrive`, and `useGenUiLive()` is true for components
   * that animate on arrival. False by default — decide it once, at mount: a
   * stream finishing mid-view doesn't make it history, and a page of history
   * rising in at once would be motion about nothing.
   */
  live?: boolean;
  /** BCP 47 tag for formatting values, e.g. "en-GB". The runtime's when omitted. */
  locale?: string;
  /** IANA zone for timestamps, e.g. "Europe/Helsinki". UTC when omitted. */
  timeZone?: string;
  /**
   * The reader's UI state, controlled: the open tab, the ticked items. One
   * Root is one UI, so this is one tool call's state. Persist
   * `persistedState(state)` beside the call and hand it back through
   * `readState`.
   */
  state?: UiState;
  /** The UI state to start from, uncontrolled. Nothing is persisted then. */
  defaultState?: UiState;
  /** The state is changing. Call `details.cancel()` to keep it from landing. */
  onStateChange?: (next: UiState, details: GenUiStateChangeDetails) => void;
  /**
   * One element failed to render. It is dropped and the rest drawn — whatever
   * data a source handed back, the rest of the answer stays readable. Logged
   * to the console when omitted.
   */
  onError?: (error: unknown, piece: { id?: string; type: string }) => void;
  children?: ReactNode;
};

const logError = (error: unknown, piece: { id?: string; type: string }) =>
  console.error(`genui: ${piece.id ? `"${piece.id}" (${piece.type})` : piece.type} failed`, error);

/**
 * Holds the catalog, your component map, how far the input has got and the
 * reader's state, for the spec or view inside it. One Root is one UI: phase
 * and state belong to a single tool call. Reads no thread or message, so it
 * mounts wherever a spec does: a reply, a document, a slide, a share.
 * Renders no element.
 */
export const GenUiRoot = <C extends Catalog = DefaultCatalog>({
  catalog,
  components,
  phase = "accepted",
  live = false,
  locale,
  timeZone,
  state: controlledState,
  defaultState,
  onStateChange,
  onError = logError,
  children,
}: GenUiRootProps<C>) => {
  const [state, setState] = useControlled({
    controlled: controlledState,
    default: defaultState ?? initialState(),
    name: "GenUi.Root",
    state: "state",
  });

  const update = useCallback<RootContextValue["update"]>(
    (piece, patch, reason) => {
      const next: UiState = {
        ...state,
        elements: { ...state.elements, [piece.id]: { ...state.elements[piece.id], ...patch } },
      };
      const details = Object.assign(createChangeEventDetails(reason), {
        piece: piece.id === VIEW_STATE_ID ? { type: piece.type } : piece,
      });
      onStateChange?.(next, details);
      if (!details.isCanceled) setState(next);
    },
    [state, onStateChange, setState],
  );

  const format = useMemo(() => ({ locale, timeZone }), [locale, timeZone]);
  const value = useMemo<RootContextValue>(
    () => ({
      catalog: catalog ?? defaultCatalog,
      components: components as unknown as GenUiComponentMap<Catalog>,
      phase,
      live,
      format,
      state,
      update,
      onError,
    }),
    [catalog, components, phase, live, format, state, update, onError],
  );
  return <RootContext value={value}>{children}</RootContext>;
};

// ---------------------------------------------------------------------------
// What a drawn component may ask
// ---------------------------------------------------------------------------

const ElementContext = createContext<{ id?: string; type: string } | null>(null);

/** True under an input being written as it is drawn (`GenUiRootProps.live`). */
export const useGenUiLive = () => use(RootContext)?.live ?? false;

/**
 * The piece being drawn: an element's id and type, or a view's name with no
 * id. For a component that needs to know which piece it is — to look itself
 * up in state its consumer keeps beside the spec — without that state having
 * to be smuggled through its props.
 */
export const useGenUiElement = () => use(ElementContext);

// ---------------------------------------------------------------------------
// Reading while it streams
// ---------------------------------------------------------------------------

/**
 * The newest value that was defined, held across renders.
 *
 * Streamed JSON is valid, then invalid, then valid again, many times a
 * second: an enum mid-word (`"ba"` on its way to `"bar"`) fails its schema for
 * exactly one chunk. Drawn literally, a piece blinks back to pending on every
 * one of those chunks. So each piece keeps the last props that parsed and
 * draws those until newer ones do — it only ever moves forward.
 *
 * Kept in state, updated during render the way React documents for
 * information from previous renders, so nothing is written to a ref that a
 * discarded render could leave behind. Values are compared by identity: pass
 * one that changes only when its input does (memoised), or every render would
 * store a new one.
 */
export const useSteady = <T,>(next: T | undefined): T | undefined => {
  const [last, setLast] = useState(next);
  if (next !== undefined && next !== last) setLast(next);
  return next !== undefined ? next : last;
};

type Entry = {
  props: z.ZodType;
  settle?(loose: unknown, complete: boolean): unknown;
  toRender?(props: unknown, context: never): unknown;
};

const parse = (definition: Entry, loose: unknown, complete: boolean) => {
  const settled = definition.settle ? definition.settle(loose, complete) : loose;
  const parsed = definition.props.safeParse(settled ?? {});
  return parsed.success ? parsed.data : undefined;
};

const EMPTY_SLICE: ElementUiState = {};

/**
 * A piece's render props, from its steady schema props: its entry's
 * `toRender` with the root's phase, format and the piece's own state, or the
 * schema props themselves.
 */
const useRender = (
  definition: Entry | undefined,
  props: unknown,
  piece: { id: string; type: string } | null,
) => {
  const { phase, format, state, update } = useRoot("Spec");
  const slice = (piece && state.elements[piece.id]) || EMPTY_SLICE;
  const updateSlice = useCallback(
    (patch: Partial<ElementUiState>, reason: string) => {
      if (piece) update(piece, patch, reason);
    },
    [piece, update],
  );
  return useMemo(() => {
    if (props === undefined || !definition) return undefined;
    if (!definition.toRender) return props as Record<string, unknown>;
    const context = { ...format, phase, state: slice, update: updateSlice };
    return definition.toRender(props, context as never) as Record<string, unknown>;
  }, [definition, props, format, phase, slice, updateSlice]);
};

const Arrive = ({ children }: { children: ReactNode }) => {
  const { live, components } = useRoot("Spec");
  const Wrap = live ? components.Arrive : undefined;
  return Wrap ? <Wrap>{children}</Wrap> : children;
};

const DefaultPlaceholder = () => <div aria-busy="true" data-genui-placeholder="" />;

const DefaultPending = ({ type, children }: { type: string; children?: ReactNode }) => (
  <div data-genui-pending="" data-genui-type={type}>
    {children}
  </div>
);

// A functional style, as Steps uses one: Markdown is lines, and collapsing
// them would lose the structure that makes the fallback readable.
const fallbackStyle: CSSProperties = { whiteSpace: "pre-wrap" };

const DefaultFallback = ({ markdown, type }: GenUiFallbackProps) => (
  <div data-genui-fallback="" data-genui-type={type} style={fallbackStyle}>
    {markdown}
  </div>
);

// ---------------------------------------------------------------------------
// Part: where a UI sits, for copying
// ---------------------------------------------------------------------------

const PartContext = createContext<((markdown: () => string) => () => void) | null>(null);

/** Registers how the drawn UI reads as Markdown with the `GenUi.Part` around it, if any. */
const usePartMarkdown = (markdown: () => string) => {
  const register = use(PartContext);
  useEffect(() => register?.(markdown), [register, markdown]);
};

export type GenUiPartProps = PrimitiveProps<"div">;

/**
 * Marks where one UI sits, so copying a selection that touches it copies the
 * UI's whole Markdown at the reader's state (`copyWithGenUi`). The spec or
 * view inside registers itself; put it around one, inside or outside Root.
 * Renders a `<div>` element.
 */
export const GenUiPart = ({ className, render, style, ...elementProps }: GenUiPartProps) => {
  const id = useId();
  const register = useCallback((markdown: () => string) => registerPart(id, markdown), [id]);
  const element = useRenderElement(
    "div",
    { className, render, style },
    { props: [{ "data-genui-part": id }, elementProps] },
  );
  return <PartContext value={register}>{element}</PartContext>;
};

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

export type GenUiSpecProps = {
  /** Model input, partial or whole, or a canonical spec. */
  input: unknown;
  /** Bound values to swap in, filed by where each binding sits (`withData`). */
  data?: BoundData;
};

/**
 * A spec, drawn from its root down.
 *
 * Draws only what parses. While the input streams, what doesn't parse yet is
 * pending; once it is whole, an element that still doesn't is dropped — a
 * whole spec that got this far was accepted against the same schemas, so a
 * failure means it outlived a change to the catalog, and a blank is better
 * than a guess.
 * Wraps what it draws in nothing, so a grid's children are the grid's
 * children. Only the default `Placeholder`, `Pending` and `Fallback` render a
 * `<div>`.
 */
export const GenUiSpec = ({ input, data }: GenUiSpecProps) => {
  const { catalog, phase, components, format, state } = useRoot("Spec");
  const spec = useMemo(
    () => readSpec(data ? resolveSpec(input, data) : input, catalog),
    [input, data, catalog],
  );
  const markdown = useCallback(
    () => exportSpec(input, { catalog, data, state, ...format })?.markdown ?? "",
    [input, catalog, data, state, format],
  );
  usePartMarkdown(markdown);

  const root = spec.root ? spec.elements[spec.root] : undefined;
  if (!spec.root || !root) {
    if (phase !== "streaming") return null;
    const Placeholder = components.Placeholder ?? DefaultPlaceholder;
    return (
      <Arrive>
        <Placeholder />
      </Arrive>
    );
  }
  return <Element id={spec.root} path={[]} spec={spec} />;
};

/**
 * One element and, if it holds any, its children.
 *
 * A child that hasn't arrived is skipped rather than outlined: it may never
 * come (the model writes parents first), and a row of outlines that resolves
 * into fewer elements would have promised more than it delivered. The path
 * guards against a cycle in a spec nobody has checked yet.
 */
const Element = ({ spec, id, path }: { spec: LooseSpec; id: string; path: string[] }) => {
  const { catalog, phase, components } = useRoot("Spec");
  const complete = phase !== "streaming";
  const element = path.includes(id) ? undefined : spec.elements[id];
  const definition = element ? catalog.elements[element.type] : undefined;
  // Memoised on the element, which `readSpec` makes once per input, so a
  // render with the same input hands `useSteady` the same props.
  const parsed = useMemo(
    () => (element && definition ? parse(definition, element.props, complete) : undefined),
    [element, definition, complete],
  );
  // Held only while it streams: once whole, props that stop parsing (bound
  // data taken back) are dropped or Unbound, never drawn as they were.
  const steady = useSteady(parsed);
  const props = complete ? parsed : steady;
  const piece = useMemo(() => (element ? { id, type: element.type } : null), [id, element]);
  const rendered = useRender(definition, props, piece);
  if (!element || !definition || !piece) return null;

  const children = definition.container
    ? element.children.map((child) => (
        <Element id={child} key={child} path={[...path, id]} spec={spec} />
      ))
    : undefined;

  if (props === undefined || rendered === undefined) {
    return (
      <NotDrawn container={definition.container} id={id} props={element.props} type={element.type}>
        {children}
      </NotDrawn>
    );
  }

  const Drawn = (components.elements as Record<string, ComponentType<Record<string, unknown>>>)[
    element.type
  ];
  return (
    <Arrive>
      <Boundary piece={piece}>
        {Drawn ? (
          <ElementContext value={piece}>
            <Drawn {...rendered} props={props}>
              {children}
            </Drawn>
          </ElementContext>
        ) : (
          <ElementFallback id={id} spec={spec} type={element.type} />
        )}
      </Boundary>
    </Arrive>
  );
};

/**
 * An element whose props don't parse: pending while the input streams; once
 * it is whole, `Unbound` when the reason is unresolved data, else nothing.
 */
const NotDrawn = ({
  id,
  type,
  props,
  container,
  children,
}: {
  id: string;
  type: string;
  props: unknown;
  container: boolean;
  children?: ReactNode;
}) => {
  const { phase, components } = useRoot("Spec");
  if (phase !== "streaming") {
    return hasBinding(props) ? <Unbound id={id} props={props} type={type} /> : null;
  }
  const Pending = components.Pending ?? DefaultPending;
  return (
    <Pending container={container} type={type}>
      {children}
    </Pending>
  );
};

/** An element the map has no component for, drawn from its subtree's Markdown. */
const ElementFallback = ({ spec, id, type }: { spec: LooseSpec; id: string; type: string }) => {
  const { catalog, components, format, state } = useRoot("Spec");
  const Fallback = components.Fallback ?? DefaultFallback;
  const markdown = exportSpec(spec, { catalog, from: id, state, ...format })?.markdown ?? "";
  return <Fallback id={id} markdown={markdown} type={type} />;
};

const Unbound = ({ id, type, props }: { id?: string; type: string; props: unknown }) => {
  const { components } = useRoot("Spec");
  const Drawn = components.Unbound;
  return Drawn ? <Drawn id={id} props={props} refs={bindingRefs(props)} type={type} /> : null;
};

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export type GenUiViewProps = {
  /** `{ view, title?, props }`, partial or whole. Props beside `view` are its props. */
  input: unknown;
  /** Bound values to swap in, filed by where each binding sits (`withData`). */
  data?: BoundData;
};

/**
 * A view, filled with its props and captioned with its title. Steady and
 * pending exactly as an element is.
 * Wraps the view's component in nothing. Only the default `Placeholder` and
 * `Fallback` render a `<div>`.
 */
export const GenUiView = ({ input, data }: GenUiViewProps) => {
  const { catalog, phase, components, format, state } = useRoot("View");
  const complete = phase !== "streaming";
  const normal = useMemo(() => {
    const view = normaliseView(input);
    return data ? (withData(view, data) as typeof view) : view;
  }, [input, data]);
  const markdown = useCallback(
    () => exportView(normal, { catalog, state, ...format })?.markdown ?? "",
    [normal, catalog, state, format],
  );
  usePartMarkdown(markdown);

  const caption = typeof normal.title === "string" ? normal.title : undefined;
  const steadyTitle = useSteady(caption);
  const title = complete ? caption : steadyTitle;
  const name = isViewName(catalog, normal.view) ? normal.view : undefined;
  const definition = name ? catalog.views[name] : undefined;
  const parsed = useMemo(
    () => (definition ? parse(definition, normal.props, complete) : undefined),
    [definition, normal.props, complete],
  );
  // Held only while it streams, as an element's are.
  const steady = useSteady(parsed);
  const props = complete ? parsed : steady;
  const piece = useMemo(() => (name ? { id: VIEW_STATE_ID, type: name } : null), [name]);
  // What a view's component and its boundary are told it is: a name, no id.
  const shown = useMemo(() => (name ? { type: name } : null), [name]);
  const rendered = useRender(definition, props, piece);
  const Drawn = name
    ? (components.views as Record<string, ComponentType<Record<string, unknown>>> | undefined)?.[
        name
      ]
    : undefined;

  if (!name || !shown || props === undefined || rendered === undefined) {
    if (complete) {
      return name && hasBinding(normal.props) ? <Unbound props={normal.props} type={name} /> : null;
    }
    const Placeholder = components.Placeholder ?? DefaultPlaceholder;
    return (
      <Arrive key="placeholder">
        <Placeholder title={title} />
      </Arrive>
    );
  }

  if (!Drawn) {
    const Fallback = components.Fallback ?? DefaultFallback;
    return (
      <Arrive key="view">
        <Boundary piece={shown}>
          <Fallback markdown={markdown()} type={name} />
        </Boundary>
      </Arrive>
    );
  }

  return (
    <Arrive key="view">
      <Boundary piece={shown}>
        <ElementContext value={shown}>
          <Drawn {...rendered} props={props} title={title} />
        </ElementContext>
      </Boundary>
    </Arrive>
  );
};

// ---------------------------------------------------------------------------
// One broken piece must not take the rest down with it
// ---------------------------------------------------------------------------

class Boundary extends Component<
  { piece: { id?: string; type: string }; children: ReactNode },
  { failed: boolean }
> {
  static contextType = RootContext;
  declare context: RootContextValue | null;
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, _info: ErrorInfo) {
    (this.context?.onError ?? logError)(error, this.props.piece);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
