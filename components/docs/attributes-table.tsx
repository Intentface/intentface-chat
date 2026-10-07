import type { ReactNode } from "react";
import { ReferenceTable } from "./reference-table";

export type AttributeRow = {
  attribute: string;
  values?: string;
  description: ReactNode;
};

type AttributesTableProps = {
  rows: AttributeRow[];
};

// Hand-authored data-attribute reference — the styling hooks a part emits.
// Descriptions are short, so every row shows its own: no expanding. Values,
// when an attribute has them, sit under its name.
export const AttributesTable = ({ rows }: AttributesTableProps) => (
  <ReferenceTable columns={[{ label: "Attribute", width: "w-[35%]" }, { label: "Description" }]}>
    {rows.map((row) => (
      <tr key={row.attribute} className="border-ink-primary/6 border-b last:border-0">
        <td className="px-4 py-3.5 align-top">
          <div className="flex flex-col items-start gap-1.5">
            <code className="break-all font-medium font-mono text-ink-primary text-sm">
              {row.attribute}
            </code>
            {row.values && (
              <code className="rounded-[4px] bg-ink-primary/6 px-1.5 py-0.5 font-mono text-ink-body text-xs">
                {row.values}
              </code>
            )}
          </div>
        </td>
        <td className="px-4 py-3.5 align-top text-ink-body text-sm leading-5">{row.description}</td>
      </tr>
    ))}
  </ReferenceTable>
);
