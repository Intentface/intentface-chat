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
// when an attribute has them, follow its description on the same line. CSS
// variables are values to style with, not hooks to select, so `--` rows get a
// table of their own.
export const AttributesTable = ({ rows }: AttributesTableProps) => {
  const attributes = rows.filter((row) => !row.attribute.startsWith("--"));
  const variables = rows.filter((row) => row.attribute.startsWith("--"));

  return (
    <>
      {attributes.length > 0 && (
        <ReferenceTable
          columns={[{ label: "Attribute", width: "w-[35%]" }, { label: "Description" }]}
        >
          {attributes.map((row) => (
            <AttributeTableRow key={row.attribute} row={row} />
          ))}
        </ReferenceTable>
      )}
      {variables.length > 0 && (
        <ReferenceTable
          columns={[{ label: "CSS variable", width: "w-[35%]" }, { label: "Description" }]}
        >
          {variables.map((row) => (
            <AttributeTableRow key={row.attribute} row={row} />
          ))}
        </ReferenceTable>
      )}
    </>
  );
};

const AttributeTableRow = ({ row }: { row: AttributeRow }) => (
  <tr className="border-ink-primary/6 border-b last:border-0">
    <td className="px-4 py-3.5 align-top">
      <code className="break-all font-medium font-mono text-ink-primary text-sm">
        {row.attribute}
      </code>
    </td>
    <td className="p-0 align-top text-ink-body text-sm leading-5">
      {/* One line, scrolling sideways with fading edges instead of wrapping. */}
      <div className="scroll-mask overflow-x-auto whitespace-nowrap px-4 py-3.5 [scrollbar-width:none]">
        {row.description}
        {row.values && (
          <code className="ml-2 rounded-[4px] bg-ink-primary/6 px-1.5 py-0.5 font-mono text-ink-body text-xs">
            {row.values}
          </code>
        )}
      </div>
    </td>
  </tr>
);
