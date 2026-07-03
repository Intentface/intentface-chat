import { readFile } from "node:fs/promises";
import path from "node:path";

// Reads the registry manifest (packages/intentface/registry/manifest.json) — the
// deps + source-files metadata for each styled component — so the docs can render
// a manual copy-paste install block: "bun add <deps>" + the source to copy. This
// is build-time server-only code; there is no runtime registry or CLI.

type ManifestFile = {
  sourcePath: string;
  targetPath: string;
};

type ManifestItem = {
  name: string;
  type: string;
  hidden?: boolean;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: ManifestFile[];
};

type Manifest = { items: ManifestItem[] };

export type ManualInstallFile = {
  target: string;
  lang: string;
  content: string;
};

export type ManualInstall = {
  /** npm packages to install, unioned across the item's dependency closure. */
  npmDependencies: string[];
  /** The item's own source files (not transitive), read from disk. */
  files: ManualInstallFile[];
  /** Other non-hidden component items the user must also copy. */
  components: string[];
};

const langForPath = (filePath: string): string => {
  if (filePath.endsWith(".css")) return "css";
  if (filePath.endsWith(".json")) return "json";
  if (filePath.endsWith(".ts")) return "ts";
  return "tsx";
};

let cachedManifest: Manifest | undefined;

const loadManifest = async (): Promise<Manifest> => {
  if (!cachedManifest) {
    const manifestPath = path.join(
      process.cwd(),
      "packages",
      "intentface",
      "registry",
      "manifest.json",
    );
    cachedManifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  }
  return cachedManifest;
};

const collectClosure = (
  name: string,
  byName: Map<string, ManifestItem>,
  seen: Set<string>,
): void => {
  if (seen.has(name)) return;
  const item = byName.get(name);
  if (!item) return;
  seen.add(name);
  for (const dependency of item.registryDependencies ?? []) {
    collectClosure(dependency, byName, seen);
  }
};

export const getManualInstall = async (itemName: string): Promise<ManualInstall | null> => {
  const manifest = await loadManifest();
  const byName = new Map(manifest.items.map((item) => [item.name, item]));
  const item = byName.get(itemName);
  if (!item) return null;

  // npm deps across the whole registry-dependency closure.
  const closure = new Set<string>();
  collectClosure(itemName, byName, closure);
  const npmDependencies = [
    ...new Set([...closure].flatMap((name) => byName.get(name)?.dependencies ?? [])),
  ].sort();

  // The item's own source files, read from disk.
  const files: ManualInstallFile[] = [];
  for (const file of item.files ?? []) {
    if (file.sourcePath.includes("*")) continue;
    const content = await readFile(path.join(process.cwd(), file.sourcePath), "utf8");
    files.push({
      target: file.targetPath,
      lang: langForPath(file.targetPath),
      content: content.trimEnd(),
    });
  }

  // Other documented components (non-hidden) the user must also copy.
  const components = (item.registryDependencies ?? []).filter((dependency) => {
    const dependencyItem = byName.get(dependency);
    return dependencyItem?.type === "registry:component" && !dependencyItem.hidden;
  });

  return { npmDependencies, files, components };
};
