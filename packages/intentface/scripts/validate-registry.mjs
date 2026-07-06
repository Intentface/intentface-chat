import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSourceImport } from "../src/imports.js";

// Validates the registry manifest against the repo: no duplicate source files,
// every registryDependency is a known item, and every internal import in a
// component's source is covered by that item's dependency closure. The manifest
// is metadata for the docs' manual copy-paste blocks (deps + files per item);
// this validator keeps it honest. Exits non-zero on any violation.

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const manifestPath = path.join(packageRoot, "registry", "manifest.json");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const expandedItems = [];

for (const item of manifest.items) {
  const files = [];
  for (const file of item.files ?? []) {
    files.push(...(await expandFile(file)));
  }
  expandedItems.push({ ...item, files });
}

validateRegistry(expandedItems);

console.log(`Validated ${expandedItems.length} registry items.`);

async function expandFile(file) {
  if (!file.sourcePath.includes("*")) {
    const content = await readSource(file.sourcePath);
    return [{ ...file, content }];
  }

  const sourceDirectory = path.dirname(file.sourcePath);
  const extension = path.extname(file.sourcePath.replace("*", "placeholder"));
  const names = await readdir(path.join(repoRoot, sourceDirectory));
  const expanded = [];

  for (const name of names.sort()) {
    if (!name.endsWith(extension)) continue;
    const basename = name.slice(0, -extension.length);
    const sourcePath = `${sourceDirectory}/${name}`;
    expanded.push({
      ...file,
      sourcePath,
      targetPath: file.targetPath.replace("[name]", basename),
      content: await readSource(sourcePath),
    });
  }

  return expanded;
}

async function readSource(sourcePath) {
  return readFile(path.join(repoRoot, sourcePath), "utf8");
}

function validateRegistry(items) {
  const itemMap = new Map(items.map((item) => [item.name, item]));
  const sourceToItem = new Map();
  const knownSources = new Set();

  for (const item of items) {
    for (const file of item.files ?? []) {
      if (sourceToItem.has(file.sourcePath)) {
        throw new Error(`Duplicate registry source file: ${file.sourcePath}`);
      }
      sourceToItem.set(file.sourcePath, item.name);
      knownSources.add(file.sourcePath);
    }
  }

  for (const item of items) {
    for (const dependency of item.registryDependencies ?? []) {
      if (!itemMap.has(dependency)) {
        throw new Error(`${item.name} depends on unknown item ${dependency}`);
      }
    }
  }

  for (const item of items) {
    const closure = getClosure(item.name, itemMap);
    const closureSources = new Set(
      closure.flatMap((entry) => (entry.files ?? []).map((file) => file.sourcePath)),
    );

    for (const file of item.files ?? []) {
      for (const specifier of extractImports(file.content)) {
        const resolved = resolveSourceImport(file.sourcePath, specifier, knownSources);
        if (!resolved) continue;

        if (!knownSources.has(resolved)) {
          throw new Error(
            `${item.name}:${file.sourcePath} imports ${specifier}, but ${resolved} is not in the registry`,
          );
        }

        if (!closureSources.has(resolved)) {
          throw new Error(
            `${item.name}:${file.sourcePath} imports ${resolved}, but it is not included by the item dependency closure`,
          );
        }
      }
    }
  }
}

function getClosure(name, itemMap, seen = new Map(), stack = new Set()) {
  if (seen.has(name)) return [...seen.values()];
  if (stack.has(name)) throw new Error(`Circular registry dependency: ${name}`);
  const item = itemMap.get(name);
  if (!item) throw new Error(`Unknown registry item: ${name}`);

  stack.add(name);
  for (const dependency of item.registryDependencies ?? []) {
    getClosure(dependency, itemMap, seen, stack);
  }
  stack.delete(name);
  seen.set(name, item);
  return [...seen.values()];
}

function extractImports(content) {
  return [...content.matchAll(/(?:from\s+["']|import\(\s*["'])([^"']+)["']/g)].map(
    (match) => match[1],
  );
}
