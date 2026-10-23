"use client";

import { type TreeNode, useTree } from "@intentface/chat/generative";
import * as m from "motion/react-m";
import type { ReactNode } from "react";
import { catalog } from "@/lib/ai/generative-catalog";
import type { AppPart } from "@/lib/ai/types";
import { cn } from "@/lib/utils";
import type { RenderUiSource } from "@/tools/render-ui";

/**
 * A renderUi call drawn with this app's components. While the call streams it
 * draws from the input, with bound nodes as placeholders; once the tool has
 * run, it draws the tool's checked tree, its bound data already in place.
 */
export const GeneratedUi = ({ part }: { part: AppPart<"tool-renderUi"> }) => {
  const drawing = drawingOf(part);
  const streaming = part.state === "input-streaming";
  const { root } = useTree(drawing?.input, catalog, { streaming });
  if (!drawing || !root) return null;
  // Nodes that arrive while the call streams rise in; a stored call draws still.
  return <DrawNode node={root} enter={streaming} sources={drawing.sources} />;
};

const NO_SOURCES: Readonly<Record<string, RenderUiSource>> = {};

/** What a renderUi part draws: the tool's finished tree once it has run, the streaming input before. */
const drawingOf = (part: AppPart<"tool-renderUi">) => {
  if (part.state !== "output-available") return { input: part.input, sources: NO_SOURCES };
  // A refused call draws nothing: the model's next call replaces it.
  return part.output.issues ? undefined : { input: part.output.tree, sources: part.output.sources };
};

type DrawNodeProps = {
  node: TreeNode<typeof catalog>;
  enter: boolean;
  /** Where each bound node's data came from, by node id. */
  sources: Readonly<Record<string, RenderUiSource>>;
};

const DrawNode = ({ node, enter, sources }: DrawNodeProps): ReactNode => {
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
              <DrawNode key={child.id} node={child} enter={enter} sources={sources} />
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
    case "Table": {
      // A bound table's rows came straight from a tool, not from the model: say which.
      const source = sources[node.id];
      return (
        <Appear enter={enter} className="col-span-full overflow-x-auto">
          {node.status === "ready" ? (
            <>
              <Table columns={node.props.columns} rows={node.props.rows} />
              {source ? (
                <p title={source.picks} className="mt-2 text-ink-tertiary text-xs">
                  From {source.label}
                </p>
              ) : null}
            </>
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
  }
};

const Table = ({ columns, rows }: { columns: string[]; rows: (string | null)[][] }) => (
  <table className="w-full text-sm">
    <thead>
      <tr className="border-ink-primary/6 border-b">
        {columns.map((column, index) => (
          <th
            // By position: two columns may share a name, and columns don't reorder.
            key={index}
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
          {columns.map((_, cell) => (
            <td key={cell} className="py-2 pr-3 align-top text-ink-body first:text-ink-primary">
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
