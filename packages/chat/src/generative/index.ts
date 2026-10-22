// Public surface of @intentface/chat/generative. Experimental: it may change or
// be removed before 1.0. No directive, so the helpers stay importable on a
// server; the hook arrives there as a client reference.

import {
  markdownHeading,
  markdownParagraph,
  markdownTable,
  markdownText,
  toMarkdown,
} from "./markdown";
import { findBindings, formatIssues, readTree, resolveBindings, validateTree } from "./tree";

export {
  type AnyCatalog,
  type Binding,
  type Catalog,
  type ComponentDefinition,
  type ComponentSchema,
  DEFAULT_LIMITS,
  DEFAULT_REF_DESCRIPTION,
  defineCatalog,
  type FoundBinding,
  isBinding,
  type Limits,
  type Tree,
  type TreeElement,
  type TreeNode,
} from "./catalog";
export { type ToJSONSchemaOptions, toJSONSchema } from "./json-schema";
export type {
  ReadTreeOptions,
  TreeIssue,
  TreeIssueCode,
  TreeRead,
  TreeResult,
} from "./tree";
export { type UseTreeOptions, useTree } from "./use-tree";

/** What the model wrote: a whole call checked, a partial one read, and issues worded for the model. */
export const tree = { validate: validateTree, read: readTree, formatIssues };

/** Data by reference: the bindings in a tree, and the tree with their data in place. */
export const bindings = { find: findBindings, resolve: resolveBindings };

/** A tree as Markdown, and the helpers that keep text the model wrote literal in it. */
export const markdown = {
  fromTree: toMarkdown,
  text: markdownText,
  paragraph: markdownParagraph,
  heading: markdownHeading,
  table: markdownTable,
};
