// Public surface of @intentface/chat/generative. No directive, so the helpers
// stay importable on a server; the hook arrives there as a client reference.

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
export {
  escapeMarkdown,
  escapeMarkdownInline,
  markdownHeading,
  markdownTable,
  toMarkdown,
} from "./markdown";
export {
  findBindings,
  formatIssues,
  type ReadTreeOptions,
  readTree,
  resolveBindings,
  type TreeIssue,
  type TreeIssueCode,
  type TreeRead,
  type TreeResult,
  validateTree,
} from "./tree";
export { type UseTreeOptions, useTree } from "./use-tree";
