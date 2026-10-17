"use client";

import {
  type ChartRender,
  type DataTableRender,
  defaultCatalog,
  type MetricRender,
  type Tone,
} from "@intentface/chat/genui";
import { defineComponents } from "@intentface/chat/genui-render";
import type { ReactNode } from "react";

/*
 * A component for every piece of the default catalog: ten elements, six views
 * and the slots for streaming. The package hands each one render props —
 * values already formatted, alignment and tone decided — so these only draw.
 * `defineComponents` checks the map against the catalog: leave a piece out,
 * or read a prop it isn't given, and it fails to compile.
 *
 * Copy it and restyle it: nothing here is the package's.
 */

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-ink-secondary",
  positive: "text-emerald-700 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  warning: "text-amber-700 dark:text-amber-400",
};

const CALLOUT: Record<"info" | "positive" | "warning" | "negative", string> = {
  info: "border-accent-bg",
  positive: "border-emerald-600 dark:border-emerald-400",
  warning: "border-amber-600 dark:border-amber-400",
  negative: "border-red-600 dark:border-red-400",
};

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

const Surface = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section className="flex w-full min-w-0 flex-col gap-3 rounded-xl bg-primary-bg p-4 shadow-card">
    {title ? <h3 className="font-medium text-ink-primary text-md">{title}</h3> : null}
    {children}
  </section>
);

const MetricTile = ({ label, text, delta }: MetricRender) => (
  <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-ink-primary/[0.035] px-3 py-2.5">
    <span className="truncate text-ink-secondary text-xs">{label}</span>
    <span className="font-medium text-ink-primary text-xl tabular-nums">{text}</span>
    {delta ? (
      <span className={`text-xs ${TONE_TEXT[delta.tone]}`}>
        {delta.text}
        {delta.label ? <span className="text-ink-tertiary"> {delta.label}</span> : null}
      </span>
    ) : null}
  </div>
);

const Table = ({ columns, rows }: DataTableRender) => (
  <div className="w-full overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              className={`px-2 pb-1.5 font-normal text-ink-secondary text-xs first:pl-0 last:pr-0 ${column.align === "right" ? "text-right" : ""}`}
              key={column.key}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr className="border-ink-primary/6 border-t">
            <td className="py-2 text-ink-tertiary" colSpan={columns.length}>
              No rows
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr className="border-ink-primary/6 border-t" key={row.key}>
              {row.cells.map((cell, index) => (
                <td
                  className={`px-2 py-1.5 text-ink-body tabular-nums first:pl-0 last:pr-0 ${columns[index]?.align === "right" ? "text-right" : ""}`}
                  key={columns[index]?.key ?? index}
                >
                  {cell.text}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const Fields = ({ items }: { items: { label: string; text: string }[] }) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
    {items.map((item) => (
      <div className="contents" key={item.label}>
        <dt className="text-ink-secondary">{item.label}</dt>
        <dd className="text-ink-body tabular-nums">{item.text}</dd>
      </div>
    ))}
  </dl>
);

// Series colours: the accent first, then a few that hold up in both themes.
const SERIES = [
  "fill-accent-bg stroke-accent-bg",
  "fill-emerald-500 stroke-emerald-500",
  "fill-amber-500 stroke-amber-500",
  "fill-violet-500 stroke-violet-500",
  "fill-rose-500 stroke-rose-500",
];

const W = 300;
const H = 140;
const PAD = { top: 8, right: 4, bottom: 18, left: 40 };

const Chart = ({ kind, categories, series, stacked, formatValue, formatTick }: ChartRender) => {
  const label = `${kind} chart of ${series.map((s) => s.label).join(", ")}`;
  if (kind === "pie")
    return <Pie categories={categories} formatValue={formatValue} series={series} />;

  const totals = categories.map((_, index) =>
    stacked
      ? series.reduce((sum, s) => sum + Math.max(0, s.values[index] ?? 0), 0)
      : Math.max(0, ...series.map((s) => s.values[index] ?? 0)),
  );
  const max = Math.max(1, ...totals);
  const width = W - PAD.left - PAD.right;
  const height = H - PAD.top - PAD.bottom;
  const band = width / categories.length;
  const y = (value: number) => PAD.top + height - (value / max) * height;
  const every = Math.ceil(categories.length / 8);

  return (
    <figure className="flex flex-col gap-2">
      <svg aria-label={label} className="w-full" role="img" viewBox={`0 0 ${W} ${H}`}>
        {[0, 0.5, 1].map((share) => (
          <g key={share}>
            <line
              className="stroke-ink-primary/8"
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(max * share)}
              y2={y(max * share)}
            />
            <text
              className="fill-ink-tertiary text-[9px]"
              dominantBaseline="middle"
              textAnchor="end"
              x={PAD.left - 6}
              y={y(max * share)}
            >
              {formatTick(max * share)}
            </text>
          </g>
        ))}
        {categories.map((category, index) =>
          index % every === 0 ? (
            <text
              className="fill-ink-tertiary text-[9px]"
              key={category}
              textAnchor="middle"
              x={PAD.left + band * (index + 0.5)}
              y={H - 4}
            >
              {category}
            </text>
          ) : null,
        )}
        {kind === "bar"
          ? categories.map((category, index) => {
              let base = 0;
              const inner = band * 0.7;
              return series.map((s, at) => {
                const value = Math.max(0, s.values[index] ?? 0);
                const x = stacked
                  ? PAD.left + band * index + (band - inner) / 2
                  : PAD.left + band * index + (band - inner) / 2 + (inner / series.length) * at;
                const barWidth = stacked ? inner : inner / series.length;
                const top = y(base + value);
                const bar = (
                  <rect
                    className={SERIES[at % SERIES.length]}
                    height={y(base) - top}
                    key={`${category}-${s.label}`}
                    rx={1.5}
                    width={Math.max(1, barWidth - 1)}
                    x={x}
                    y={top}
                  >
                    <title>{`${s.label}, ${category}: ${formatValue(value)}`}</title>
                  </rect>
                );
                if (stacked) base += value;
                return bar;
              });
            })
          : series.map((s, at) => {
              const points = s.values.map((value, index) =>
                value === null ? null : ([PAD.left + band * (index + 0.5), y(value)] as const),
              );
              const line = points
                .map((point, index) =>
                  point
                    ? `${index === 0 || !points[index - 1] ? "M" : "L"}${point[0]},${point[1]}`
                    : "",
                )
                .join("");
              const drawn = points.filter((point) => point !== null);
              const first = drawn[0];
              const last = drawn[drawn.length - 1];
              return (
                <g className={SERIES[at % SERIES.length]} key={s.label}>
                  {kind === "area" && first && last ? (
                    <path
                      className="stroke-none opacity-15"
                      d={`${line}L${last[0]},${y(0)}L${first[0]},${y(0)}Z`}
                    />
                  ) : null}
                  <path className="fill-none" d={line} strokeWidth={1.75} />
                </g>
              );
            })}
      </svg>
      <Legend labels={series.map((s) => s.label)} />
    </figure>
  );
};

const Pie = ({
  categories,
  series,
  formatValue,
}: Pick<ChartRender, "categories" | "series" | "formatValue">) => {
  const values = (series[0]?.values ?? []).map((value) => Math.max(0, value ?? 0));
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  let angle = -Math.PI / 2;
  const point = (at: number) => `${60 + 50 * Math.cos(at)},${60 + 50 * Math.sin(at)}`;
  return (
    <figure className="flex items-center gap-4">
      <svg
        aria-label={`pie chart of ${series[0]?.label ?? ""}`}
        className="size-28 shrink-0"
        role="img"
        viewBox="0 0 120 120"
      >
        {values.map((value, index) => {
          const start = angle;
          angle += (value / total) * Math.PI * 2;
          const large = angle - start > Math.PI ? 1 : 0;
          return (
            <path
              className={SERIES[index % SERIES.length]}
              d={`M60,60 L${point(start)} A50,50 0 ${large} 1 ${point(angle)} Z`}
              key={categories[index] ?? index}
            >
              <title>{`${categories[index]}: ${formatValue(value)}`}</title>
            </path>
          );
        })}
      </svg>
      <Legend
        labels={categories.map(
          (category, index) => `${category} ${formatValue(values[index] ?? 0)}`,
        )}
      />
    </figure>
  );
};

const Legend = ({ labels }: { labels: string[] }) => (
  <ul className="flex flex-wrap gap-x-3 gap-y-1 text-ink-secondary text-xs">
    {labels.map((label, index) => (
      <li className="flex items-center gap-1.5" key={label}>
        <svg aria-hidden="true" className="size-2" viewBox="0 0 8 8">
          <circle className={SERIES[index % SERIES.length]} cx="4" cy="4" r="4" />
        </svg>
        {label}
      </li>
    ))}
  </ul>
);

const STEP_MARK = { done: "✓", current: "●", todo: "○" } as const;

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

export const components = defineComponents(defaultCatalog, {
  elements: {
    Card: ({ title, description, children }) => (
      <Surface title={title}>
        {description ? <p className="-mt-2 text-ink-secondary text-sm">{description}</p> : null}
        {children}
      </Surface>
    ),
    Stack: ({ direction, gap, children }) => (
      <div
        className={`flex min-w-0 ${direction === "row" ? "flex-row flex-wrap" : "flex-col"} ${gap === "sm" ? "gap-2" : gap === "lg" ? "gap-5" : "gap-3"}`}
      >
        {children}
      </div>
    ),
    Grid: ({ columns, children }) => (
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
    ),
    Heading: ({ text }) => <h4 className="font-medium text-ink-primary text-sm">{text}</h4>,
    Text: ({ text, tone }) => (
      <p
        className={`text-md leading-6 ${tone === "muted" ? "text-ink-secondary" : "text-ink-body"}`}
      >
        {text}
      </p>
    ),
    Metric: (metric) => <MetricTile {...metric} />,
    KeyValue: ({ items }) => <Fields items={items} />,
    DataTable: (table) => <Table {...table} />,
    Chart: (chart) => <Chart {...chart} />,
    Callout: ({ tone, title, text }) => (
      <aside
        className={`rounded-r-md border-l-2 bg-ink-primary/[0.035] px-3 py-2 text-sm ${CALLOUT[tone]}`}
      >
        {title ? <strong className="font-medium text-ink-primary">{title} </strong> : null}
        <span className="text-ink-body">{text}</span>
      </aside>
    ),
  },
  views: {
    table: ({ title, ...table }) => (
      <Surface title={title}>
        <Table {...table} />
      </Surface>
    ),
    chart: ({ title, ...chart }) => (
      <Surface title={title}>
        <Chart {...chart} />
      </Surface>
    ),
    metrics: ({ title, items }) => (
      <Surface title={title}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2">
          {items.map((item) => (
            <MetricTile key={item.label} {...item} />
          ))}
        </div>
      </Surface>
    ),
    record: ({ name, subtitle, status, fields, note }) => (
      <Surface>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <h3 className="font-medium text-ink-primary text-md">{name}</h3>
            {subtitle ? <p className="text-ink-secondary text-sm">{subtitle}</p> : null}
          </div>
          {status ? (
            <span
              className={`shrink-0 rounded-full bg-raised px-2 py-0.5 font-medium text-xs shadow-raised ${TONE_TEXT[status.tone]}`}
            >
              {status.label}
            </span>
          ) : null}
        </div>
        {fields.length > 0 ? <Fields items={fields} /> : null}
        {note ? <p className="text-ink-body text-sm">{note}</p> : null}
      </Surface>
    ),
    email: ({ title, to, cc, subject, body }) => (
      <Surface title={title}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <dt className="text-ink-secondary">To</dt>
          <dd className="text-ink-body">{to.join(", ")}</dd>
          {cc?.length ? (
            <>
              <dt className="text-ink-secondary">Cc</dt>
              <dd className="text-ink-body">{cc.join(", ")}</dd>
            </>
          ) : null}
          <dt className="text-ink-secondary">Subject</dt>
          <dd className="font-medium text-ink-primary">{subject}</dd>
        </dl>
        <p className="whitespace-pre-wrap border-ink-primary/6 border-t pt-3 text-ink-body text-sm leading-6">
          {body}
        </p>
      </Surface>
    ),
    steps: ({ title, items }) => (
      <Surface title={title}>
        <ol className="flex flex-col gap-2 text-sm">
          {items.map((item) => (
            <li className="flex gap-2.5" key={item.key}>
              <span
                aria-hidden="true"
                className={`w-3 shrink-0 text-center ${item.status === "todo" ? "text-ink-tertiary" : "text-accent-bg"}`}
              >
                {STEP_MARK[item.status]}
              </span>
              <span className="flex flex-col">
                <span
                  className={
                    item.status === "done"
                      ? "text-ink-secondary line-through"
                      : item.status === "current"
                        ? "font-medium text-ink-primary"
                        : "text-ink-body"
                  }
                >
                  {item.title}
                </span>
                {item.detail ? <span className="text-ink-secondary">{item.detail}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </Surface>
    ),
  },
  // While it streams: nothing drawable yet, and a piece whose props haven't parsed.
  Placeholder: () => <div className="h-24 w-full animate-pulse rounded-xl bg-ink-primary/[0.04]" />,
  Pending: ({ container, children }) =>
    container ? (
      <div className="flex w-full flex-col gap-3">{children}</div>
    ) : (
      <div className="h-14 animate-pulse rounded-lg bg-ink-primary/[0.04]" />
    ),
  // A piece whose bound rows your host hasn't resolved: say where they live.
  Unbound: ({ refs }) => (
    <div className="rounded-lg border border-ink-primary/10 border-dashed px-3 py-2.5 text-ink-secondary text-sm">
      Rows from {refs.join(", ")}, not resolved yet
    </div>
  ),
  Arrive: ({ children }) => <div className="fade-in-0 animate-in duration-300">{children}</div>,
});
