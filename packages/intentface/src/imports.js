import path from "node:path";
import { toPosix, withoutExtension } from "./fs-utils.js";

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs"];

export const resolveSourceImport = (sourcePath, specifier, knownSources) => {
  if (specifier.startsWith("@/")) {
    return resolveWithExtensions(specifier.slice(2), knownSources);
  }

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const base = toPosix(path.posix.dirname(sourcePath));
    return resolveWithExtensions(
      path.posix.normalize(path.posix.join(base, specifier)),
      knownSources,
    );
  }

  return null;
};

export const rewriteInternalImports = ({
  content,
  sourcePath,
  targetPath,
  sourceToTarget,
  config,
}) => {
  const knownSources = new Set(Object.keys(sourceToTarget));

  return content.replace(
    /(from\s+["']|import\(\s*["'])([^"']+)(["']\s*\)?)/g,
    (match, prefix, specifier, suffix) => {
      const resolved = resolveSourceImport(sourcePath, specifier, knownSources);
      if (!resolved) return match;

      const dependencyTarget = sourceToTarget[resolved];
      if (!dependencyTarget) return match;

      return `${prefix}${formatTargetImport({
        fromTargetPath: targetPath,
        dependencyTargetPath: dependencyTarget,
        config,
      })}${suffix}`;
    },
  );
};

export const formatTargetImport = ({ fromTargetPath, dependencyTargetPath, config }) => {
  const dependencyNoExt = stripSourceRoot(
    withoutExtension(dependencyTargetPath),
    config.sourceRoot,
  );
  const aliasMatch = findBestAlias(dependencyNoExt, config.aliases ?? {});
  if (aliasMatch) return aliasMatch;

  const fromDir = path.posix.dirname(fromTargetPath);
  let relative = path.posix.relative(fromDir, dependencyNoExt);
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative;
};

export const resolveTargetPath = (targetPath, config) => {
  const sourceRoot = normalizeSourceRoot(config.sourceRoot);
  if (!sourceRoot) return targetPath;
  if (!isSourceFileTarget(targetPath)) return targetPath;
  if (targetPath === sourceRoot || targetPath.startsWith(`${sourceRoot}/`)) {
    return targetPath;
  }
  return `${sourceRoot}/${targetPath}`;
};

const findBestAlias = (targetNoExt, aliases) => {
  const candidates = [
    ["components/ui", aliases.ui],
    ["components/ai", aliases.ai],
    ["components", aliases.components],
    ["hooks", aliases.hooks],
    ["lib/utils", aliases.utils],
    ["lib", aliases.lib],
  ]
    .filter(([, alias]) => typeof alias === "string" && alias.length > 0)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [targetPrefix, alias] of candidates) {
    if (targetNoExt === targetPrefix) return alias;
    if (targetNoExt.startsWith(`${targetPrefix}/`)) {
      return `${alias}${targetNoExt.slice(targetPrefix.length)}`;
    }
  }

  return null;
};

const resolveWithExtensions = (sourcePath, knownSources) => {
  if (knownSources.has(sourcePath)) return sourcePath;
  for (const extension of EXTENSIONS) {
    const withExtension = `${sourcePath}${extension}`;
    if (knownSources.has(withExtension)) return withExtension;
  }
  for (const extension of EXTENSIONS) {
    const indexPath = `${sourcePath}/index${extension}`;
    if (knownSources.has(indexPath)) return indexPath;
  }
  return sourcePath;
};

const normalizeSourceRoot = (sourceRoot) =>
  typeof sourceRoot === "string" ? sourceRoot.replace(/^\.?\//, "").replace(/\/$/, "") : "";

const stripSourceRoot = (targetPath, sourceRoot) => {
  const normalized = normalizeSourceRoot(sourceRoot);
  if (!normalized) return targetPath;
  if (targetPath === normalized) return "";
  if (targetPath.startsWith(`${normalized}/`)) {
    return targetPath.slice(normalized.length + 1);
  }
  return targetPath;
};

const isSourceFileTarget = (targetPath) =>
  targetPath.startsWith("components/") ||
  targetPath.startsWith("hooks/") ||
  targetPath.startsWith("lib/");
