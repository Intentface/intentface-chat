/** Install commands per package manager. Shared by the docs tab component and
 *  the markdown expander so the two can't drift. */
export const PACKAGE_MANAGERS = [
  { manager: "npm", install: "npm install" },
  { manager: "pnpm", install: "pnpm add" },
  { manager: "yarn", install: "yarn add" },
  { manager: "bun", install: "bun add" },
];
