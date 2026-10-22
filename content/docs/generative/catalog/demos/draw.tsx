import type { TreeNode } from "@intentface/chat/generative";
import type { ReactNode } from "react";
import type { catalog } from "./catalog";

/*
 * Your own components, drawn with a plain switch on the node's type. The
 * package renders nothing: a node is typed data, and `props` is typed once
 * `status` is "ready".
 *
 * A pending node's props haven't validated yet — the model is still writing
 * them, or their data hasn't resolved. It keeps its slot, and its placeholder
 * cross-fades to the content in place, so nothing shifts when it's ready.
 *
 * Motion is plain CSS. Under `data-live`, a node that arrives fades in from
 * `@starting-style`; set it while a call streams, and a stored call draws still.
 */
export const DrawNode = ({ node }: { node: TreeNode<typeof catalog> }) => {
  switch (node.type) {
    case "Card":
      return (
        <Card title={node.status === "ready" ? node.props.title : undefined}>
          {node.children.map((child) => (
            <DrawNode key={child.id} node={child} />
          ))}
        </Card>
      );
    case "Metric":
      return <Metric props={node.status === "ready" ? node.props : undefined} />;
    case "Table":
      return <Table props={node.status === "ready" ? node.props : undefined} />;
  }
};

// A node rises in, un-blurring, when it arrives under `data-live`.
const ARRIVE =
  "transition-[opacity,translate,filter] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] in-data-live:starting:translate-y-1 in-data-live:starting:opacity-0 in-data-live:starting:blur-[2px] motion-reduce:transition-none";

// A slot stacks its placeholder and its content in one grid cell, and
// `data-ready` cross-fades between them with a matching blur.
const PLACEHOLDER =
  "transition-[opacity,filter] duration-400 ease-in-out group-data-ready/slot:opacity-0 group-data-ready/slot:blur-[2px] motion-reduce:transition-none";
const CONTENT =
  "opacity-0 blur-[2px] transition-[opacity,filter] duration-400 ease-in-out group-data-ready/slot:opacity-100 group-data-ready/slot:blur-[0px] motion-reduce:transition-none";

const Card = ({ title, children }: { title: string | undefined; children: ReactNode }) => (
  <section
    className={`w-full rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.075),0_1px_2px_rgb(0_0_0/0.06),0_4px_8px_-2px_rgb(0_0_0/0.05)] dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.1)] ${ARRIVE}`}
  >
    {title === undefined ? (
      <div className="flex h-5 items-center">
        <Bar className="h-2.5 w-24" />
      </div>
    ) : (
      <h3 className="font-semibold text-[14px] text-zinc-900 leading-5 dark:text-zinc-100">
        {title}
      </h3>
    )}
    {/* Metrics pair up two to a row; a table takes the full width. */}
    <div className="mt-4 grid grid-cols-2 gap-3 empty:hidden">{children}</div>
  </section>
);

type MetricProps = { label: string; value: string; note?: string };

const Metric = ({ props }: { props: MetricProps | undefined }) => (
  <div
    data-ready={props ? "" : undefined}
    className={`group/slot grid rounded-[10px] bg-zinc-50 px-3.5 py-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] *:col-start-1 *:row-start-1 dark:bg-white/3 dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)] ${ARRIVE}`}
  >
    <div aria-hidden="true" className={`flex flex-col gap-1 ${PLACEHOLDER}`}>
      <div className="flex h-4 items-center">
        <Bar className="h-2.5 w-18" />
      </div>
      <div className="flex h-7 items-center">
        <Bar className="h-4.5 w-10" />
      </div>
    </div>
    <div className={`flex flex-col gap-1 ${CONTENT}`}>
      {props ? (
        <>
          <span className="text-[13px] text-zinc-500 leading-4 dark:text-zinc-400">
            {props.label}
          </span>
          <span className="font-medium text-[20px] text-zinc-900 tabular-nums leading-7 dark:text-zinc-100">
            {props.value}
          </span>
          {props.note ? (
            <span className="text-[13px] text-zinc-600 leading-4 dark:text-zinc-300">
              {props.note}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  </div>
);

type TableProps = { columns: string[]; rows: string[][] };

const Table = ({ props }: { props: TableProps | undefined }) => (
  <div
    data-ready={props ? "" : undefined}
    className={`group/slot col-span-full grid *:col-start-1 *:row-start-1 ${ARRIVE}`}
  >
    <div aria-hidden="true" className={`flex flex-col ${PLACEHOLDER}`}>
      <div className="flex h-8 items-center border-zinc-100 border-b dark:border-white/6">
        <Bar className="h-2 w-16" />
      </div>
      <div className="flex h-9 items-center border-zinc-100 border-b dark:border-white/6">
        <Bar className="h-2.5 w-full" />
      </div>
      <div className="flex h-9 items-center border-zinc-100 border-b dark:border-white/6">
        <Bar className="h-2.5 w-full" />
      </div>
      <div className="flex h-9 items-center">
        <Bar className="h-2.5 w-3/5" />
      </div>
    </div>
    <div className={CONTENT}>
      {props ? (
        <table className="w-full text-[13px] leading-4">
          <thead>
            <tr className="border-zinc-100 border-b dark:border-white/6">
              {props.columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="h-8 text-left font-medium text-xs text-zinc-500 last:text-right dark:text-zinc-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, index) => (
              <tr
                // By position: rows only append, and a row's cells change while it's written.
                key={index}
                // Rows that arrive together fade in 40ms apart.
                style={{ transitionDelay: `${index * 40}ms` }}
                className="border-zinc-100 border-b transition-opacity duration-400 ease-in-out last:border-0 in-data-live:starting:opacity-0 motion-reduce:transition-none dark:border-white/6"
              >
                {props.columns.map((column, cell) => (
                  <td
                    key={column}
                    className="h-9 text-zinc-600 first:text-zinc-900 last:text-right last:tabular-nums dark:text-zinc-300 dark:first:text-zinc-100"
                  >
                    {row[cell]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  </div>
);

// Placeholder bars pulse until their slot is ready.
const Bar = ({ className }: { className: string }) => (
  <span
    className={`block animate-pulse rounded-full bg-zinc-200/70 group-data-ready/slot:animate-none motion-reduce:animate-none dark:bg-white/8 ${className}`}
  />
);
