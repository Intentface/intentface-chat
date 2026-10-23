// The tool's input schema: each component's own JSON Schema, made strict for
// structured-output modes, and the nulls that strictness adds read back out.

import type { StandardJSONSchema, StandardSchema } from "../internal/standard-schema";
import {
  type AnyCatalog,
  type AnyComponent,
  type ComponentInput,
  type ComponentSchema,
  DEFAULT_REF_DESCRIPTION,
  isBinding,
  isObject,
  type JsonObject,
  limitsOf,
  type TreeInput,
} from "./catalog";

// ---------------------------------------------------------------------------
// Tool schema
// ---------------------------------------------------------------------------

export type TreeSchemaOptions = {
  /** The model writes one component as `{ type, props }` instead of a tree. */
  single?: boolean;
};

/** The JSON Schema of a tool's input: always an object. */
type ObjectSchema = {
  type: "object";
  properties: JsonObject;
  required: string[];
  additionalProperties: false;
};

/**
 * The tool's input schema: plain JSON Schema, which any model SDK takes as is,
 * carrying a typed Standard Schema the AI SDK infers the tool's input from.
 */
export type TreeSchema<Input> = ObjectSchema & {
  readonly "~standard": StandardSchema<Input>["~standard"] & {
    readonly jsonSchema: {
      readonly input: (options: { readonly target: string }) => ObjectSchema;
      readonly output: (options: { readonly target: string }) => ObjectSchema;
    };
  };
};

/** What the model writes under a schema built with these options. */
type InputOf<C extends AnyCatalog, Options extends TreeSchemaOptions> = Options extends {
  single: true;
}
  ? ComponentInput<C>
  : TreeInput<C>;

/**
 * The tool's input schema, typed as what the model writes, so an AI SDK tool
 * infers its input. It passes the call through as written: `tree.validate`
 * checks it, so the issues reach the model as the tool's result. Pass it as is:
 * a spread copy loses the Standard Schema.
 */
export const treeSchema = <
  C extends AnyCatalog,
  const Options extends TreeSchemaOptions = TreeSchemaOptions,
>(
  catalog: C,
  options?: Options,
): TreeSchema<InputOf<C, Options>> => {
  type Input = InputOf<C, Options>;
  // Built now, so a component schema that can't convert throws here.
  const schema = toJSONSchema(catalog, options);
  const jsonSchema = ({ target }: { readonly target: string }) => {
    if (target !== "draft-07") throw new Error(`tree.schema converts to draft-07, not ${target}.`);
    return schema;
  };
  const standard: TreeSchema<Input>["~standard"] = {
    version: 1,
    vendor: "intentface",
    validate: (value) => ({ value: value as Input }),
    jsonSchema: { input: jsonSchema, output: jsonSchema },
  };
  // Not enumerable, so an SDK that sends the schema as JSON leaves it out; the AI SDK still finds it.
  return Object.defineProperty(schema, "~standard", { value: standard }) as TreeSchema<Input>;
};

/**
 * The schema itself, built from each component's own. Strict, for
 * structured-output modes: every object closed, every property required, and
 * optional props nullable. `tree.validate` reads the nulls back as absent.
 */
const toJSONSchema = (catalog: AnyCatalog, options: TreeSchemaOptions = {}): ObjectSchema => {
  const limits = limitsOf(catalog);
  const refDescription = catalog.refDescription ?? DEFAULT_REF_DESCRIPTION;
  const components = Object.entries(catalog.components);
  const types = components.map(([type]) => type);
  const propsOf = (type: string, definition: AnyComponent) =>
    strict(withBindings(requireJsonSchema(type, definition), definition, refDescription));

  if (options.single) {
    return {
      type: "object",
      properties: {
        type: { type: "string", enum: types, description: "Which component to show." },
        props: {
          anyOf: components.map(([type, definition]) => ({
            ...(propsOf(type, definition) as JsonObject),
            description: `Props for ${type}: ${definition.description}`,
          })),
        },
      },
      required: ["type", "props"],
      additionalProperties: false,
    };
  }

  const element = ([type, definition]: [string, AnyComponent]): JsonObject => {
    const children = {
      type: "array",
      items: { type: "string" },
      maxItems: limits.children,
      description: "The ids of the elements inside, in order.",
    };
    return {
      type: "object",
      description: definition.description,
      properties: {
        id: { type: "string", description: "Unique within the call." },
        type: { type: "string", enum: [type] },
        props: propsOf(type, definition),
        ...(definition.container ? { children } : {}),
      },
      required: ["id", "type", "props", ...(definition.container ? ["children"] : [])],
      additionalProperties: false,
    };
  };

  return {
    type: "object",
    properties: {
      root: { type: "string", description: "The id of the element at the top." },
      elements: {
        type: "array",
        maxItems: limits.nodes,
        description: "Every element, each with its own id. Containers list their children by id.",
        items: { anyOf: components.map(element) },
      },
    },
    required: ["root", "elements"],
    additionalProperties: false,
  };
};

const conversions = new WeakMap<ComponentSchema, JsonObject | Error>();

/** A schema as JSON Schema, converted once; the conversion's error when it can't. */
const convert = (schema: ComponentSchema): JsonObject | Error => {
  let converted = conversions.get(schema);
  if (!converted) {
    try {
      converted = schema["~standard"].jsonSchema.input({ target: "draft-07" });
    } catch (error) {
      converted = error instanceof Error ? error : new Error(String(error));
    }
    conversions.set(schema, converted);
  }
  return converted;
};

/** A component's props as JSON Schema, or `null` when its schema can't convert. */
export const jsonSchemaOf = (definition: AnyComponent): JsonObject | null => {
  const converted = convert(definition.props);
  return converted instanceof Error ? null : converted;
};

/** The JSON Schema the model is shown. A conversion's own error comes through. */
const requireJsonSchema = (type: string, definition: AnyComponent): JsonObject => {
  // Typed as required, but a JavaScript caller can still pass an older validator.
  if (!(definition.props["~standard"] as Partial<StandardJSONSchema["~standard"]>).jsonSchema) {
    throw new Error(
      `"${type}" needs a schema that converts to JSON Schema: zod 4.2+, ArkType 2.1.28+, or Valibot through toStandardJsonSchema.`,
    );
  }
  const schema = convert(definition.props);
  if (schema instanceof Error) throw schema;
  if (JSON.stringify(schema).includes('"$ref"')) {
    throw new Error(`"${type}" uses $ref in its JSON Schema, which isn't supported yet.`);
  }
  return schema;
};

const bindingSchema = (refDescription: string): JsonObject => ({
  type: "object",
  description: "Data by reference instead of written out: a tool result's ref, and what to pick.",
  properties: {
    $data: { type: "string", description: refDescription },
    columns: {
      type: "array",
      items: { type: "string" },
      description: "Columns to pick from each row, in order, for a list of rows.",
    },
    column: { type: "string", description: "One column to pick from each row." },
  },
  required: ["$data"],
  additionalProperties: false,
});

const withBindings = (
  schema: JsonObject,
  definition: AnyComponent,
  refDescription: string,
): JsonObject => {
  if (!definition.bind?.length || !isObject(schema.properties)) return schema;
  const properties = { ...schema.properties };
  for (const key of definition.bind) {
    if (key in properties) {
      properties[key] = { anyOf: [properties[key], bindingSchema(refDescription)] };
    }
  }
  return { ...schema, properties };
};

const SCHEMA_LISTS = new Set(["anyOf", "oneOf", "allOf", "prefixItems"]);
const SCHEMA_SLOTS = new Set(["items", "not", "additionalProperties"]);

const strict = (schema: unknown): unknown => {
  if (!isObject(schema)) return schema;
  const next: JsonObject = {};
  for (const [key, value] of Object.entries(schema)) {
    switch (true) {
      case key === "$schema":
        break;
      case key === "properties" && isObject(value):
        next[key] = Object.fromEntries(
          Object.entries(value).map(([name, property]) => [name, strict(property)]),
        );
        break;
      case SCHEMA_LISTS.has(key) && Array.isArray(value):
        next[key] = (value as unknown[]).map(strict);
        break;
      case SCHEMA_SLOTS.has(key) && isObject(value):
        next[key] = strict(value);
        break;
      default:
        next[key] = value;
    }
  }
  if (isObject(next.properties)) {
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    const properties = Object.fromEntries(
      Object.entries(next.properties).map(([name, property]) => [
        name,
        required.has(name) ? property : nullable(property),
      ]),
    );
    next.properties = properties;
    next.required = Object.keys(properties);
    next.additionalProperties = false;
  }
  return next;
};

const nullable = (schema: unknown): unknown =>
  isObject(schema) && typeof schema.type === "string" && !("enum" in schema)
    ? { ...schema, type: [schema.type, "null"] }
    : { anyOf: [schema, { type: "null" }] };

const allowsNull = (schema: unknown): boolean =>
  isObject(schema) &&
  (schema.type === "null" ||
    (Array.isArray(schema.type) && schema.type.includes("null")) ||
    schema.const === null ||
    (Array.isArray(schema.enum) && schema.enum.includes(null)) ||
    [schema.anyOf, schema.oneOf].some(
      (branches) => Array.isArray(branches) && branches.some(allowsNull),
    ));

/** A strict schema's nulls read back as absent, where the component's own schema has no null. */
export const dropNulls = (value: unknown, schema: unknown): unknown => {
  if (!isObject(schema)) return value;
  if (Array.isArray(value)) return value.map((item) => dropNulls(item, schema.items));
  if (!isObject(value) || !isObject(schema.properties)) return value;
  const properties = schema.properties;
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      item === null && !required.has(key) && !allowsNull(properties[key])
        ? []
        : [
            [
              key,
              // A binding's optional parts come back null in strict mode; none of them allow it.
              isBinding(item)
                ? Object.fromEntries(Object.entries(item).filter(([, part]) => part !== null))
                : dropNulls(item, properties[key]),
            ],
          ],
    ),
  );
};
