// Fails when the primitive reference pages contradict the package.
//
// Docs drift silently: a renamed part or a dropped prop breaks nothing at build
// time, so pages keep documenting an API that no longer exists. This resolves
// each part's real props and state through the TypeScript compiler — not regex,
// which cannot see multi-line types or inherited props — and diffs the pages
// against it.
//
//   node scripts/audit-docs.mjs
//
// Checks per documented part: the part exists, every PropsTable `name` is a real
// prop, and every AttributesTable `attribute` is one the part can emit.

import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.resolve("package.json"));
const ts = require("typescript");

const NAMESPACES = {
  composer: "Composer",
  message: "Message",
  thread: "Thread",
  steps: "Steps",
  reasoning: "Reasoning",
  chip: "Chip",
  attachments: "Attachments",
};
const SRC = "packages/chat/src";
const DOCS = "content/docs/primitives";

// ---------------------------------------------------------------------------
// Resolve each part's props and state from the type checker
// ---------------------------------------------------------------------------

const roots = Object.keys(NAMESPACES).map((ns) => path.resolve(SRC, ns, "index.parts.ts"));
const config = ts.readConfigFile("packages/chat/tsconfig.json", ts.sys.readFile).config;
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, "packages/chat");
const program = ts.createProgram(roots, { ...parsed.options, noEmit: true });
const checker = program.getTypeChecker();

const resolveParts = (root) => {
  const source = program.getSourceFile(root);
  const parts = {};
  for (const symbol of checker.getExportsOfModule(checker.getSymbolAtLocation(source))) {
    const declaration = symbol.declarations?.[0];
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const type = checker.getTypeOfSymbolAtLocation(target, target.declarations?.[0] ?? declaration);
    const signature = type.getCallSignatures()[0];
    const parameter = signature?.getParameters()[0];
    if (!parameter) {
      parts[symbol.getName()] = { props: [], state: [] };
      continue;
    }
    const propsType = checker.getTypeOfSymbolAtLocation(
      parameter,
      parameter.declarations?.[0] ?? declaration,
    );
    // State is the parameter of the className callback overload.
    let state = [];
    const className = propsType.getProperty("className");
    if (className) {
      const classNameType = checker.getTypeOfSymbolAtLocation(
        className,
        className.declarations?.[0] ?? declaration,
      );
      for (const candidate of classNameType.isUnion() ? classNameType.types : [classNameType]) {
        const stateParam = candidate.getCallSignatures()[0]?.getParameters()[0];
        if (!stateParam) continue;
        state = checker
          .getTypeOfSymbolAtLocation(stateParam, stateParam.declarations?.[0] ?? declaration)
          .getProperties()
          .map((p) => p.getName());
      }
    }
    parts[symbol.getName()] = {
      props: propsType.getProperties().map((p) => p.getName()),
      state,
    };
  }
  return parts;
};

// ---------------------------------------------------------------------------
// Which data-* attributes the package can emit
// ---------------------------------------------------------------------------

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });

// Bespoke part attributes appear either as quoted object keys or as JSX props.
const literals = new Set();
for (const file of walk(SRC)) {
  const body = readFileSync(file, "utf8");
  for (const [, a] of body.matchAll(/["'`](data-[a-z-]+)["'`]/g)) literals.add(a);
  for (const [, a] of body.matchAll(/(?<![\w"'-])(data-[a-z-]+)\s*[=:]/g)) literals.add(a);
}

// Unmapped state keys become data-<key>; open and transitionStatus are mapped.
const attributesFor = ({ state }) => {
  const attributes = new Set(literals);
  for (const key of state) {
    if (key === "open") attributes.add("data-open").add("data-closed");
    else if (key === "transitionStatus")
      attributes.add("data-starting-style").add("data-ending-style");
    else attributes.add(`data-${key.toLowerCase()}`);
  }
  return attributes;
};

// ---------------------------------------------------------------------------
// Diff the pages
// ---------------------------------------------------------------------------

let failures = 0;
for (const [slug, namespace] of Object.entries(NAMESPACES)) {
  const parts = resolveParts(path.resolve(SRC, slug, "index.parts.ts"));
  const page = readFileSync(path.join(DOCS, `${slug}.mdx`), "utf8");
  const findings = [];

  for (const section of page.split(/^### /m).slice(1)) {
    const heading = section.split("\n", 1)[0].trim().replace(/\(\)$/, "");
    let part;
    if (heading.startsWith(`${namespace}.`)) part = heading.slice(namespace.length + 1);
    else if (heading === namespace) part = "Root";
    else if (parts[heading]) part = heading;
    else continue; // a prose heading, not a part reference

    if (!parts[part]) {
      findings.push(`part does not exist: ${namespace}.${part}`);
      continue;
    }
    const { props } = parts[part];
    const attributes = attributesFor(parts[part]);

    for (const [, name] of section.matchAll(/\{\s*name:\s*"([^"]+)"/g)) {
      if (/[/\s]/.test(name)) continue; // rows naming several props at once
      if (!props.includes(name)) findings.push(`no such prop: ${namespace}.${part}.${name}`);
    }
    for (const [, attribute] of section.matchAll(/\{\s*attribute:\s*"(data-[^"]+)"/g)) {
      if (!attributes.has(attribute))
        findings.push(`never emitted: ${namespace}.${part} → ${attribute}`);
    }
  }

  // A part counts as covered by a prose mention; trivial sub-parts are grouped
  // rather than given a heading each.
  const uncovered = Object.keys(parts).filter(
    (part) => !page.includes(`${namespace}.${part}`) && part !== "Root",
  );
  for (const part of uncovered) findings.push(`undocumented: ${namespace}.${part}`);

  if (findings.length) {
    failures += findings.length;
    console.error(`\n${slug}.mdx`);
    for (const finding of findings) console.error(`  ✗ ${finding}`);
  }
}

if (failures) {
  console.error(`\n${failures} contradiction(s) between the docs and the package.\n`);
  process.exit(1);
}
console.log("Docs match the package: every documented part, prop and attribute resolves.");
