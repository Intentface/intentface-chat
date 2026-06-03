import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const loadRegistry = async () => {
  const registryPath = path.join(packageRoot, "registry", "registry.json");
  return JSON.parse(await readFile(registryPath, "utf8"));
};

export const getPublicItems = (registry) => registry.items.filter((item) => !item.hidden);

export const resolveRegistrySelection = (registry, names, options = {}) => {
  const selectedNames = names.length > 0 ? names : ["ui-primitives"];
  const itemMap = new Map(registry.items.map((item) => [item.name, item]));
  const resolved = new Map();
  const visiting = new Set();

  const visit = (name) => {
    const item = itemMap.get(name);
    if (!item) throw new Error(`Unknown Intentface item: ${name}`);
    if (resolved.has(name)) return;
    if (visiting.has(name)) throw new Error(`Circular registry dependency: ${name}`);

    visiting.add(name);
    for (const dependency of item.registryDependencies ?? []) {
      visit(dependency);
    }
    visiting.delete(name);
    resolved.set(name, item);

    if (options.includeExamples) {
      for (const dependency of item.exampleDependencies ?? []) {
        visit(dependency);
      }
    }
  };

  for (const name of selectedNames) visit(name);
  return [...resolved.values()];
};

export const getInstallPlan = (items) => {
  const fileMap = new Map();
  const dependencies = new Set();
  const devDependencies = new Set();
  const cssBlocks = new Map();

  for (const item of items) {
    for (const dependency of item.dependencies ?? []) dependencies.add(dependency);
    for (const dependency of item.devDependencies ?? []) {
      devDependencies.add(dependency);
    }
    for (const block of item.cssBlocks ?? []) cssBlocks.set(block.name, block);
    for (const file of item.files ?? []) fileMap.set(file.sourcePath, file);
  }

  return {
    files: [...fileMap.values()].sort((a, b) => a.targetPath.localeCompare(b.targetPath)),
    dependencies: [...dependencies].sort(),
    devDependencies: [...devDependencies].sort(),
    cssBlocks: [...cssBlocks.values()],
    items: items.map((item) => ({
      name: item.name,
      version: item.version,
      type: item.type,
    })),
  };
};
