import { CodeBlock } from "./code-block";
import { InstallationBlockTabs } from "./installation-block-tabs";

const MANAGERS = [
  { manager: "npm", install: "npm install" },
  { manager: "pnpm", install: "pnpm add" },
  { manager: "yarn", install: "yarn add" },
  { manager: "bun", install: "bun add" },
];

type InstallationBlockProps = {
  packageName: string;
};

// Server component: highlights one install command per package manager and
// hands them all to the client shell, which shows the selected one.
export const InstallationBlock = ({ packageName }: InstallationBlockProps) => (
  <InstallationBlockTabs
    entries={MANAGERS.map(({ manager, install }) => {
      const command = `${install} ${packageName}`;
      return { manager, command, code: <CodeBlock code={command} lang="bash" /> };
    })}
  />
);
