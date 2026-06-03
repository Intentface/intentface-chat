import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const pathExists = async (filePath) => {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
};

export const readJson = async (filePath, fallback = null) => {
  if (!(await pathExists(filePath))) return fallback;
  return JSON.parse(await readFile(filePath, "utf8"));
};

export const writeJson = async (filePath, value) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

export const writeText = async (filePath, value) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value);
};

export const toPosix = (value) => value.split(path.sep).join("/");

export const withoutExtension = (filePath) => filePath.replace(/\.(tsx|ts|jsx|js|mjs|cjs)$/, "");
