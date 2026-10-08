import { PACKAGE_MANAGERS } from "@/lib/docs/package-managers";
import { highlightCode } from "./code-block";
import { InstallationBlockTabs } from "./installation-block-tabs";

type InstallationBlockProps = {
  packageName: string;
};

// Server component: highlights one install command per package manager and
// hands them all to the client shell, which shows the selected one.
export const InstallationBlock = async ({ packageName }: InstallationBlockProps) => (
  <InstallationBlockTabs
    entries={
      await Promise.all(
        PACKAGE_MANAGERS.map(async ({ manager, install }) => {
          const command = `${install} ${packageName}`;
          return { manager, command, code: await highlightCode(command, "bash") };
        }),
      )
    }
  />
);
