import { PACKAGE_MANAGERS } from "@/lib/docs/package-managers";
import { highlightCode } from "./code-block";
import { CodeFiles } from "./code-files";

type InstallationBlockProps = {
  packageName: string;
};

// Server component: highlights one install command per package manager and
// shows them as tabs, one per manager.
export const InstallationBlock = async ({ packageName }: InstallationBlockProps) => (
  <CodeFiles
    className="my-6"
    files={
      await Promise.all(
        PACKAGE_MANAGERS.map(async ({ manager, install }) => {
          const source = `${install} ${packageName}`;
          return { name: manager, source, code: await highlightCode(source, "bash") };
        }),
      )
    }
  />
);
