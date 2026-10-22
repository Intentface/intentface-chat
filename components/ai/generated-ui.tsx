"use client";

import { type FoundBinding, type TreeNode, useTree } from "@intentface/chat/generative";
import { isToolPart, type ToolPart, type UnknownPart } from "@intentface/chat/types";
import * as m from "motion/react-m";
import type { ReactNode } from "react";
import { catalog } from "@/lib/ai/generative-catalog";
import { cn } from "@/lib/utils";

type GeneratedUiProps = {
  part: ToolPart;
  /** The message's parts, where a bound ref's data tool result lives. */
  parts: readonly UnknownPart[];
};

// What each data tool's result offers a binding: its rows.
const ROWS: Record<string, (output: unknown) => unknown> = {
  "tool-listDocsPages": (output) => (output as { pages?: unknown } | undefined)?.pages,
};

/**
 * A renderUi call drawn with this app's components, while its input streams and
 * after. A call the tool refused draws nothing: the model's next call replaces it.
 */
export const GeneratedUi = ({ part, parts }: GeneratedUiProps) => {
  const streaming = part.state === "input-streaming";
  // A ref is the data tool call's id, given back in its result.
  const resolve = (binding: FoundBinding) => {
    const source = parts.filter(isToolPart).find((tool) => tool.toolCallId === binding.$data);
    return source?.state === "output-available" ? ROWS[source.type]?.(source.output) : undefined;
  };
  const { root } = useTree(part.input, catalog, { streaming, resolve });
  const refused = (part.output as { ok?: boolean } | undefined)?.ok === false;
  if (!root || refused) return null;
  // Nodes that arrive while the call streams rise in; a stored call draws still.
  return <DrawNode node={root} enter={streaming} />;
};

type DrawNodeProps = { node: TreeNode<typeof catalog>; enter: boolean };

const DrawNode = ({ node, enter }: DrawNodeProps): ReactNode => {
  switch (node.type) {
    case "Card":
      return (
        <Appear enter={enter} className="my-2 rounded-xl bg-primary-bg p-4 shadow-card">
          {node.status === "ready" ? (
            <h3 className="font-semibold text-ink-primary text-sm">{node.props.title}</h3>
          ) : (
            <Bar className="h-2.5 w-24" />
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 empty:hidden">
            {node.children.map((child) => (
              <DrawNode key={child.id} node={child} enter={enter} />
            ))}
          </div>
        </Appear>
      );
    case "Metric":
      return (
        <Appear
          enter={enter}
          className="flex flex-col gap-1 rounded-lg bg-ink-primary/5 px-3 py-2.5"
        >
          {node.status === "ready" ? (
            <>
              <span className="text-ink-secondary text-xs">{node.props.label}</span>
              <span className="font-medium text-ink-primary text-lg tabular-nums">
                {node.props.value}
              </span>
            </>
          ) : (
            <>
              <Bar className="h-2 w-16" />
              <Bar className="h-4 w-10" />
            </>
          )}
        </Appear>
      );
    case "Table":
      return (
        <Appear enter={enter} className="col-span-full overflow-x-auto">
          {node.status === "ready" ? (
            <Table columns={node.props.columns} rows={node.props.rows} />
          ) : (
            <div className="flex flex-col gap-3 py-2">
              <Bar className="h-2 w-16" />
              <Bar className="h-2.5 w-full" />
              <Bar className="h-2.5 w-3/5" />
            </div>
          )}
        </Appear>
      );
  }
};

const Table = ({ columns, rows }: { columns: string[]; rows: (string | null)[][] }) => (
  <table className="w-full text-sm">
    <thead>
      <tr className="border-ink-primary/6 border-b">
        {columns.map((column) => (
          <th
            key={column}
            scope="col"
            className="h-8 pr-3 text-left font-medium text-ink-secondary text-xs"
          >
            {column}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, index) => (
        // By position: rows only append, and a row's cells change while it's written.
        <tr key={index} className="border-ink-primary/6 border-b last:border-0">
          {columns.map((column, cell) => (
            <td key={column} className="py-2 pr-3 align-top text-ink-body first:text-ink-primary">
              {row[cell] ?? "—"}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

const Appear = ({
  enter,
  className,
  children,
}: {
  enter: boolean;
  className: string;
  children: ReactNode;
}) => (
  <m.div
    initial={enter ? { opacity: 0, y: 4, filter: "blur(2px)" } : false}
    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </m.div>
);

const Bar = ({ className }: { className: string }) => (
  <span className={cn("block animate-pulse rounded-full bg-ink-primary/8", className)} />
);
