import path from "node:path";

export const INTENTFACE_CSS_START = "/* intentface:start */";
export const INTENTFACE_CSS_END = "/* intentface:end */";

export const upsertIntentfaceCssBlock = (existingCss, cssBlock, options = {}) => {
  const managedBlock = `${INTENTFACE_CSS_START}\n${rewriteSourcePaths(
    cssBlock.trim(),
    options.cssPath,
  )}\n${INTENTFACE_CSS_END}`;
  const pattern = new RegExp(
    `${escapeRegExp(INTENTFACE_CSS_START)}[\\s\\S]*?${escapeRegExp(INTENTFACE_CSS_END)}`,
  );

  if (pattern.test(existingCss)) {
    return existingCss.replace(pattern, managedBlock);
  }

  const separator = existingCss.trim().length > 0 ? "\n\n" : "";
  return `${existingCss.trimEnd()}${separator}${managedBlock}\n`;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const rewriteSourcePaths = (cssBlock, cssPath) => {
  if (!cssPath) return cssBlock;

  return cssBlock.replace(/@source\s+"([^"]+)";/g, (match, sourcePath) => {
    if (!sourcePath.startsWith("../node_modules/")) return match;

    const packagePath = sourcePath.replace(/^(\.\.\/)+node_modules\//, "");
    const cssDirectory = path.posix.dirname(cssPath);
    let relativeNodeModules = path.posix.relative(cssDirectory, "node_modules");
    if (!relativeNodeModules.startsWith(".")) {
      relativeNodeModules = `./${relativeNodeModules}`;
    }

    return `@source "${relativeNodeModules}/${packagePath}";`;
  });
};
