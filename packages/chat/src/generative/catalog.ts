// The catalog and the shapes the generative helpers read and return: what the
// model may use, the tree it writes, and the small lookups over both.

import type { InferOutput, StandardJSONSchema, StandardSchema } from "../internal/standard-schema";

export type JsonObject = Record<string, unknown>;

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/**
 * A component's schema: it validates the props, and converts to the JSON
 * Schema the model is shown. zod 4.2+ and ArkType 2.1.28+ do both; Valibot
 * through `toStandardJsonSchema`.
 */
export type ComponentSchema = StandardSchema & StandardJSONSchema;

type BindKey<Schema extends ComponentSchema> = unknown extends InferOutput<Schema>
  ? string
  : keyof InferOutput<Schema> & string;

/** One component the model may use. */
export type ComponentDefinition<Schema extends ComponentSchema = ComponentSchema> = {
  /** When to use it, written for the model. */
  description: string;
  /** Validates its props, and converts to the JSON Schema the model is shown. */
  props: Schema;
  /** Whether it holds other components. */
  container?: boolean;
  /** Props the model may point at data (`{ "$data": ref }`) instead of writing out. */
  bind?: readonly BindKey<Schema>[];
  /** How it reads as Markdown. `children` is its children's Markdown. */
  markdown?(props: InferOutput<Schema>, children: string): string;
};

/** The components the model may use, by type. */
export type Catalog<
  Schemas extends Record<string, ComponentSchema> = Record<string, ComponentSchema>,
> = {
  components: { [Type in keyof Schemas]: ComponentDefinition<Schemas[Type]> };
  /** Caps on one call: shown to the model in the tool's schema, and checked. */
  limits?: Partial<Limits>;
  /** What a ref looks like, in the model's terms. */
  refDescription?: string;
};

/** Types a catalog from each component's schema. The catalog stays plain data. */
export const defineCatalog = <Schemas extends Record<string, ComponentSchema>>(
  catalog: Catalog<Schemas>,
): Catalog<Schemas> => catalog;

/** Any catalog: the bound for the helpers' type parameters, so every typed catalog fits. */
export type AnyCatalog = {
  components: Record<
    string,
    {
      description: string;
      props: ComponentSchema;
      container?: boolean;
      bind?: readonly string[];
      markdown?(props: never, children: string): string;
    }
  >;
  limits?: Partial<Limits>;
  refDescription?: string;
};

/** One component of any catalog, as the helpers read it. */
export type AnyComponent = AnyCatalog["components"][string];

/**
 * The component a type names, if it's one of the catalog's own. A name the
 * catalog only inherits, such as `"constructor"`, is not a component.
 */
export const componentOf = (catalog: AnyCatalog, type: unknown): AnyComponent | undefined =>
  typeof type === "string" && Object.hasOwn(catalog.components, type)
    ? catalog.components[type]
    : undefined;

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

type ComponentType<C extends AnyCatalog> = keyof C["components"] & string;

type PropsOf<C extends AnyCatalog, Type extends ComponentType<C>> = InferOutput<
  C["components"][Type]["props"]
>;

/** One element of a checked tree. A bound prop holds its `Binding` until resolved. */
export type TreeElement<C extends AnyCatalog = AnyCatalog> = {
  [Type in ComponentType<C>]: { type: Type; props: PropsOf<C, Type>; children?: string[] };
}[ComponentType<C>];

/** A checked call: the root's id and every element by id. Plain JSON, safe to store. */
export type Tree<C extends AnyCatalog = AnyCatalog> = {
  root: string;
  elements: Record<string, TreeElement<C>>;
};

/** One node, ready to draw. Its props are typed once its status is `ready`. */
export type TreeNode<C extends AnyCatalog = AnyCatalog> = {
  [Type in ComponentType<C>]:
    | {
        id: string;
        type: Type;
        status: "ready";
        props: PropsOf<C, Type>;
        children: TreeNode<C>[];
      }
    | { id: string; type: Type; status: "pending"; props: unknown; children: TreeNode<C>[] };
}[ComponentType<C>];

/** Caps on one call. The node and children caps are also in the tool's schema. */
export type Limits = { nodes: number; depth: number; children: number };

export const DEFAULT_LIMITS: Limits = { nodes: 40, depth: 6, children: 24 };

/** A catalog's limits, each one it leaves out at its default. */
export const limitsOf = (catalog: AnyCatalog): Limits => ({ ...DEFAULT_LIMITS, ...catalog.limits });

// ---------------------------------------------------------------------------
// Bindings

/** Data by reference: a tool result's ref, and the columns to pick from its rows. */
export type Binding = { $data: string; columns?: string[]; column?: string };

/** A binding found in a tree, and where it sits. */
export type FoundBinding = Binding & { id: string; prop: string };

export const DEFAULT_REF_DESCRIPTION = "Where the data comes from: its ref, exactly as given.";

export const isBinding = (value: unknown): value is Binding =>
  isObject(value) && typeof value.$data === "string";
