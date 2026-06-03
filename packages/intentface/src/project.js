import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathExists, readJson } from "./fs-utils.js";

export const DEFAULT_CONFIG = {
  $schema: "https://intentface.dev/schema.json",
  tsx: true,
  tailwind: {
    css: "app/globals.css",
  },
  sourceRoot: "",
  aliases: {
    components: "@/components",
    ui: "@/components/ui",
    ai: "@/components/ai",
    hooks: "@/hooks",
    lib: "@/lib",
    utils: "@/lib/utils",
  },
};

export const loadProject = async (cwd) => {
  const packageJsonPath = path.join(cwd, "package.json");
  const packageJson = await readJson(packageJsonPath);
  if (!packageJson) {
    throw new Error(`No package.json found in ${cwd}`);
  }

  const configPath = path.join(cwd, "intentface.json");
  const existingConfig = await readJson(configPath);
  const shadcnConfig = await readJson(path.join(cwd, "components.json"));
  const tsconfig = await readJson(path.join(cwd, "tsconfig.json"));

  const inferred = inferConfig({ existingConfig, shadcnConfig, tsconfig });
  return {
    cwd,
    packageJson,
    packageJsonPath,
    configPath,
    config: inferred,
    tsconfig,
  };
};

export const inferConfig = ({ existingConfig, shadcnConfig, tsconfig }) => {
  const aliases = {
    ...DEFAULT_CONFIG.aliases,
    ...shadcnConfig?.aliases,
    ...existingConfig?.aliases,
  };

  const detectedAlias = detectAlias(tsconfig);
  const detectedPrefix = detectedAlias?.prefix;
  if (detectedPrefix && !existingConfig?.aliases && !shadcnConfig?.aliases) {
    aliases.components = `${detectedPrefix}/components`;
    aliases.ui = `${detectedPrefix}/components/ui`;
    aliases.ai = `${detectedPrefix}/components/ai`;
    aliases.hooks = `${detectedPrefix}/hooks`;
    aliases.lib = `${detectedPrefix}/lib`;
    aliases.utils = `${detectedPrefix}/lib/utils`;
  }

  return {
    ...DEFAULT_CONFIG,
    ...existingConfig,
    sourceRoot:
      existingConfig?.sourceRoot ??
      shadcnConfig?.sourceRoot ??
      detectedAlias?.sourceRoot ??
      DEFAULT_CONFIG.sourceRoot,
    tailwind: {
      ...DEFAULT_CONFIG.tailwind,
      ...shadcnConfig?.tailwind,
      ...existingConfig?.tailwind,
    },
    aliases,
  };
};

export const assertCompatibleProject = async (project) => {
  const dependencies = {
    ...project.packageJson.dependencies,
    ...project.packageJson.devDependencies,
  };
  const missing = [];

  if (!dependencies.next) missing.push("next");
  if (!dependencies.react) missing.push("react");
  if (!(await pathExists(path.join(project.cwd, "tsconfig.json")))) {
    missing.push("tsconfig.json");
  }
  if (!dependencies.tailwindcss && !dependencies["@tailwindcss/postcss"]) {
    missing.push("tailwindcss");
  }

  if (missing.length > 0) {
    throw new Error(
      `Intentface v1 supports Next + TypeScript + Tailwind projects. Missing: ${missing.join(", ")}`,
    );
  }

  const tailwindSpec = dependencies.tailwindcss ?? dependencies["@tailwindcss/postcss"];
  if (tailwindSpec && !isTailwindV4OrLater(tailwindSpec)) {
    throw new Error(
      `Intentface requires Tailwind CSS v4 or later (uses @theme inline and @custom-variant). Found: ${tailwindSpec}`,
    );
  }
};

const isTailwindV4OrLater = (versionSpec) => {
  const match = versionSpec.match(/(\d+)/);
  if (!match) return true;
  return Number.parseInt(match[1], 10) >= 4;
};

export const findGlobalCssPath = async (cwd, config) => {
  const configured = config.tailwind?.css;
  if (configured && (await pathExists(path.join(cwd, configured)))) {
    return configured;
  }

  const candidates = [
    "app/globals.css",
    "src/app/globals.css",
    "styles/globals.css",
    "src/styles/globals.css",
  ];
  for (const candidate of candidates) {
    if (await pathExists(path.join(cwd, candidate))) return candidate;
  }

  return configured ?? "app/globals.css";
};

export const getExistingDependencies = (packageJson) => ({
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
});

export const hasTailwindImport = async (cwd, cssPath) => {
  const fullPath = path.join(cwd, cssPath);
  if (!(await pathExists(fullPath))) return false;
  return (await readFile(fullPath, "utf8")).includes('@import "tailwindcss"');
};

const detectAlias = (tsconfig) => {
  const paths = tsconfig?.compilerOptions?.paths;
  if (!paths || typeof paths !== "object") return null;

  for (const [alias, targets] of Object.entries(paths)) {
    if (!alias.endsWith("/*")) continue;
    const firstTarget = Array.isArray(targets) ? targets[0] : null;
    if (firstTarget === "./*" || firstTarget === "*") {
      return { prefix: alias.slice(0, -2), sourceRoot: "" };
    }
    if (firstTarget === "src/*" || firstTarget === "./src/*") {
      return { prefix: alias.slice(0, -2), sourceRoot: "src" };
    }
  }

  return null;
};
