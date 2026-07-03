// Emits a shadcn-CLI-compatible registry dist from the expanded internal
// registry items. Consumers install with:
//   bunx shadcn@latest add https://intentface.dev/r/<name>.json
// or via a components.json namespace:
//   { "registries": { "@intentface": "https://intentface.dev/r/{name}.json" } }
//
// Mapping from the internal authoring format:
//   files[].sourcePath → files[].path (content embedded)
//   files[].targetPath → files[].target
//   registryDependencies → absolute URLs (transitive deps resolve even for
//     one-off URL installs; hidden items are emitted but unlisted)
//   registry:bundle → registry:block with no files
//   cssBlocks → `cssVars` (:root/.dark/@theme inline variables) + `css`
//     (everything else: parameter at-rules, keyframes, non-variable
//     declarations); hidden/exampleDependencies/cssBlocks are stripped.

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const REGISTRY_SCHEMA = "https://ui.shadcn.com/schema/registry.json";
const REGISTRY_ITEM_SCHEMA = "https://ui.shadcn.com/schema/registry-item.json";
const DEFAULT_BASE_URL = "https://intentface.dev";

export const buildShadcnDist = async ({ manifest, expandedItems, outputDir, baseUrl }) => {
  const registryBaseUrl = (baseUrl ?? process.env.REGISTRY_BASE_URL ?? DEFAULT_BASE_URL).replace(
    /\/$/,
    "",
  );
  const itemUrl = (name) => `${registryBaseUrl}/r/${name}.json`;

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const distItems = expandedItems.map((item) => toDistItem(item, itemUrl));

  for (const distItem of distItems) {
    await writeFile(
      path.join(outputDir, `${distItem.name}.json`),
      `${JSON.stringify({ $schema: REGISTRY_ITEM_SCHEMA, ...distItem }, null, 2)}\n`,
    );
  }

  const hiddenNames = new Set(expandedItems.filter((item) => item.hidden).map((item) => item.name));
  const index = {
    $schema: REGISTRY_SCHEMA,
    name: manifest.name,
    homepage: manifest.homepage,
    items: distItems
      .filter((item) => !hiddenNames.has(item.name))
      .map(({ files, ...item }) => ({
        ...item,
        ...(files ? { files: files.map(({ content: _content, ...file }) => file) } : {}),
      })),
  };

  await writeFile(path.join(outputDir, "registry.json"), `${JSON.stringify(index, null, 2)}\n`);

  return { itemCount: distItems.length, listedCount: index.items.length };
};

const toDistItem = (item, itemUrl) => {
  const { name, title, description, dependencies, registryDependencies } = item;
  const type = item.type === "registry:bundle" ? "registry:block" : item.type;

  const distItem = {
    name,
    type,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(dependencies?.length ? { dependencies } : {}),
    ...(registryDependencies?.length
      ? { registryDependencies: registryDependencies.map(itemUrl) }
      : {}),
  };

  if (item.type !== "registry:bundle" && item.files?.length) {
    distItem.files = item.files.map((file) => ({
      path: file.sourcePath,
      type: file.type,
      target: file.targetPath,
      content: file.content,
    }));
  }

  for (const block of item.cssBlocks ?? []) {
    const { css, cssVars } = translateCssBlock(block.content);
    if (Object.keys(cssVars.light).length || Object.keys(cssVars.dark).length) {
      distItem.cssVars = {
        ...(Object.keys(cssVars.theme).length ? { theme: cssVars.theme } : {}),
        ...(Object.keys(cssVars.light).length ? { light: cssVars.light } : {}),
        ...(Object.keys(cssVars.dark).length ? { dark: cssVars.dark } : {}),
      };
    } else if (Object.keys(cssVars.theme).length) {
      distItem.cssVars = { theme: cssVars.theme };
    }
    if (Object.keys(css).length) {
      distItem.css = { ...(distItem.css ?? {}), ...css };
    }
  }

  return distItem;
};

// ---------------------------------------------------------------------------
// CSS translation
//
// The authored css blocks are flat: parameter-only at-rules, plus rule/at-rule
// blocks containing declarations (one nesting level for @keyframes). That is
// simple enough to parse by brace matching — no CSS parser dependency.
// ---------------------------------------------------------------------------

const translateCssBlock = (source) => {
  const css = {};
  const cssVars = { theme: {}, light: {}, dark: {} };

  for (const node of parseTopLevel(source)) {
    if (node.body === null) {
      // Parameter-only at-rule (@source, @custom-variant, @import…): keep the
      // full prelude as a key with an empty body — the shadcn CLI emits these
      // as `<prelude>;`. Mechanism A risk: verified by the token spike.
      css[node.prelude] = {};
      continue;
    }

    const bucket = varBucket(node.prelude);
    if (bucket) {
      const { variables, declarations } = splitDeclarations(node.body);
      Object.assign(cssVars[bucket], variables);
      if (Object.keys(declarations).length) {
        css[node.prelude] = declarations;
      }
      continue;
    }

    css[node.prelude] = parseBlockBody(node.body);
  }

  return { css, cssVars };
};

const varBucket = (prelude) => {
  if (prelude === ":root") return "light";
  if (prelude === ".dark") return "dark";
  if (prelude === "@theme inline" || prelude === "@theme") return "theme";
  return null;
};

// Splits `--name: value` declarations (variables, emitted via cssVars with the
// leading -- stripped) from everything else (kept in the css field).
const splitDeclarations = (body) => {
  const variables = {};
  const declarations = {};
  for (const [property, value] of parseDeclarations(body)) {
    if (property.startsWith("--")) {
      variables[property.slice(2)] = value;
    } else {
      declarations[property] = value;
    }
  }
  return { variables, declarations };
};

// A block body is either flat declarations or nested blocks (@keyframes).
const parseBlockBody = (body) => {
  if (!body.includes("{")) {
    return Object.fromEntries(parseDeclarations(body));
  }
  const nested = {};
  for (const node of parseTopLevel(body)) {
    nested[node.prelude] = node.body === null ? {} : parseBlockBody(node.body);
  }
  return nested;
};

const parseDeclarations = (body) => {
  const declarations = [];
  for (const statement of splitStatements(body)) {
    const colon = statement.indexOf(":");
    if (colon === -1) continue;
    declarations.push([
      statement.slice(0, colon).trim(),
      normalizeWhitespace(statement.slice(colon + 1)),
    ]);
  }
  return declarations;
};

// Splits on `;` at paren-depth zero, so values like `calc(16% * var(--con))`
// and multiline font-feature-settings stay intact.
const splitStatements = (body) => {
  const statements = [];
  let current = "";
  let depth = 0;
  for (const char of body) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === ";" && depth === 0) {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
};

const normalizeWhitespace = (value) => value.replace(/\s+/g, " ").trim();

// Yields { prelude, body } for each top-level node; body is null for
// parameter-only at-rules terminated by `;`.
const parseTopLevel = (source) => {
  const nodes = [];
  let index = 0;

  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index])) index += 1;
    if (index >= source.length) break;

    let cursor = index;
    while (cursor < source.length && source[cursor] !== "{" && source[cursor] !== ";") {
      cursor += 1;
    }

    if (cursor >= source.length || source[cursor] === ";") {
      const prelude = normalizeWhitespace(source.slice(index, cursor));
      if (prelude) nodes.push({ prelude, body: null });
      index = cursor + 1;
      continue;
    }

    const prelude = normalizeWhitespace(source.slice(index, cursor));
    let depth = 1;
    let end = cursor + 1;
    while (end < source.length && depth > 0) {
      if (source[end] === "{") depth += 1;
      if (source[end] === "}") depth -= 1;
      end += 1;
    }
    nodes.push({ prelude, body: source.slice(cursor + 1, end - 1).trim() });
    index = end;
  }

  return nodes;
};
