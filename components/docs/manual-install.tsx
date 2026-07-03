import { getManualInstall } from "@/lib/docs/registry";
import { CodeBlock } from "./code-block";

type ManualInstallProps = {
  item: string;
};

// Server component: renders the manual copy-paste install for a styled
// component — install the deps, then copy the source into your project. Reads
// the deps + source from the registry manifest at build time.
export const ManualInstall = async ({ item }: ManualInstallProps) => {
  const data = await getManualInstall(item);

  if (!data) {
    return (
      <div className="my-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive text-sm">
        No registry metadata for <code>{item}</code>.
      </div>
    );
  }

  return (
    <div className="my-6 flex flex-col gap-4">
      <p className="text-ink-secondary text-sm">Install the dependencies:</p>
      <CodeBlock code={`bun add ${data.npmDependencies.join(" ")}`} lang="bash" />

      {data.components.length > 0 && (
        <p className="text-ink-secondary text-sm">
          This component also uses{" "}
          {data.components.map((name, index) => (
            <span key={name}>
              {index > 0 && ", "}
              <code>{name}</code>
            </span>
          ))}
          {" — copy their source too."}
        </p>
      )}

      <p className="text-ink-secondary text-sm">Copy the source into your project:</p>
      {data.files.map((file) => (
        <CodeBlock
          key={file.target}
          code={file.content}
          lang={file.lang}
          title={file.target.replace(/^~\//, "")}
        />
      ))}
    </div>
  );
};
