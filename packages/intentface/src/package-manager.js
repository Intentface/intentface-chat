import path from "node:path";
import { pathExists } from "./fs-utils.js";

export const detectPackageManager = async (cwd) => {
  if (await pathExists(path.join(cwd, "bun.lock"))) return "bun";
  if (await pathExists(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (await pathExists(path.join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
};

export const getInstallCommand = (manager, dependencies, { dev = false } = {}) => {
  if (dependencies.length === 0) return null;

  const devFlag = dev ? ["-D"] : [];
  switch (manager) {
    case "bun":
      return { command: "bun", args: ["add", ...devFlag, ...dependencies] };
    case "pnpm":
      return { command: "pnpm", args: ["add", ...devFlag, ...dependencies] };
    case "yarn":
      return { command: "yarn", args: ["add", ...devFlag, ...dependencies] };
    default:
      return { command: "npm", args: ["install", ...devFlag, ...dependencies] };
  }
};

export const packageNameFromSpec = (dependency) => {
  if (dependency.startsWith("@")) {
    const parts = dependency.split("/");
    return `${parts[0]}/${parts[1]?.split("@")[0] ?? ""}`;
  }
  return dependency.split("@")[0];
};
