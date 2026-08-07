import { PACKAGE_MANAGERS } from "@/lib/docs/package-managers";
import { CodeBlock } from "./code-block";
import { InstallationBlockTabs } from "./installation-block-tabs";

type InstallationBlockProps = {
  packageName: string;
};

// Server component: highlights one install command per package manager and
// hands them all to the client shell, which shows the selected one.
export const InstallationBlock = ({ packageName }: InstallationBlockProps) => (
  <InstallationBlockTabs
    entries={PACKAGE_MANAGERS.map(({ manager, install }) => {
      const command = `${install} ${packageName}`;
      return { manager, command, code: <CodeBlock code={command} lang="bash" /> };
    })}
  />
);
