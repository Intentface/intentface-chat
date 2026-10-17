import { describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { defaultCatalog, defineCatalog } from "../src/genui/catalog";
import type { DataTableRender, MetricRender } from "../src/genui/render";
import { defineComponents, type GenUiComponents } from "../src/genui-render";
import { checkComponents, fixtures } from "../src/genui-testing";

// A plain, accessible map: semantic elements, every text from the render props.
const Metric = ({ label, text, delta }: MetricRender) => (
  <div>
    <span>{label}</span> <strong>{text}</strong>
    {delta ? <span> {delta.text}</span> : null}
  </div>
);
const Table = ({ columns, rows }: DataTableRender) => (
  <table>
    <thead>
      <tr>
        {columns.map((column) => (
          <th key={column.key}>{column.label}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.key}>
          {row.cells.map((cell, index) => (
            <td key={columns[index]?.key}>{cell.text}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);
const Pairs = ({ items }: { items: { label: string; text: string }[] }) => (
  <dl>
    {items.map((item) => (
      <div key={item.label}>
        <dt>{item.label}</dt>
        <dd>{item.text}</dd>
      </div>
    ))}
  </dl>
);
const Chart = ({ kind, series }: { kind: string; series: { label: string }[] }) => (
  <figure aria-label={`${kind} chart of ${series.map((s) => s.label).join(", ")}`}>
    <svg />
  </figure>
);
const Captioned = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section>
    {title ? <h3>{title}</h3> : null}
    {children}
  </section>
);

const good = defineComponents(defaultCatalog, {
  elements: {
    Card: ({ title, description, children }) => (
      <section>
        {title ? <h3>{title}</h3> : null}
        {description ? <p>{description}</p> : null}
        {children}
      </section>
    ),
    Stack: ({ children }) => <div>{children}</div>,
    Grid: ({ children }) => <div>{children}</div>,
    Heading: ({ text }) => <h4>{text}</h4>,
    Text: ({ text }) => <p>{text}</p>,
    Metric,
    KeyValue: ({ items }) => <Pairs items={items} />,
    DataTable: Table,
    Chart,
    Callout: ({ title, text }) => (
      <aside>
        {title ? <strong>{title}</strong> : null} {text}
      </aside>
    ),
  },
  views: {
    table: ({ title, ...table }) => (
      <Captioned title={title}>
        <Table {...table} />
      </Captioned>
    ),
    chart: ({ title, ...chart }) => (
      <Captioned title={title}>
        <Chart {...chart} />
      </Captioned>
    ),
    metrics: ({ title, items }) => (
      <Captioned title={title}>
        {items.map((item) => (
          <Metric key={item.label} {...item} />
        ))}
      </Captioned>
    ),
    record: ({ name, subtitle, status, fields, note }) => (
      <section>
        <h3>{name}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
        {status ? <span>{status.label}</span> : null}
        <Pairs items={fields} />
        {note ? <p>{note}</p> : null}
      </section>
    ),
    email: ({ title, to, subject, body }) => (
      <Captioned title={title}>
        <p>To: {to.join(", ")}</p>
        <p>{subject}</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{body}</p>
      </Captioned>
    ),
    steps: ({ title, items }) => (
      <Captioned title={title}>
        <ol>
          {items.map((item) => (
            <li key={item.key}>
              {item.title} {item.detail}
            </li>
          ))}
        </ol>
      </Captioned>
    ),
  },
});

describe("checkComponents", () => {
  test("passes a map that draws what its render props promise", async () => {
    expect(await checkComponents(good, { locale: "en-GB" })).toEqual([]);
  });

  test("names what a sloppy map gets wrong, by fixture", async () => {
    const sloppy: GenUiComponents = {
      ...good,
      elements: {
        ...good.elements,
        // Drops its children.
        Card: ({ title }) => <section>{title}</section>,
        // A heading that isn't one.
        Heading: ({ text }) => <p>{text}</p>,
        // Formats nothing: the raw value instead of the text.
        Metric: ({ label, props }) => (
          <p>
            {label} {String(props.value)}
          </p>
        ),
        // A table of divs: no header or row roles.
        DataTable: ({ rows }) => (
          <div>
            {rows.map((row) => (
              <div key={row.key}>{row.cells.map((cell) => cell.text).join(" ")}</div>
            ))}
          </div>
        ),
        Callout: () => {
          throw new Error("bad tone");
        },
      },
    };
    const failures = await checkComponents(sloppy, { locale: "en-GB" });
    expect(failures).toContain("Card (example): it doesn't draw its children.");
    expect(failures).toContain("Heading (example): its text isn't a heading (role heading).");
    expect(failures).toContain('Metric (example): "€240,000" isn\'t on screen.');
    expect(failures).toContain('Metric (example): "+8%" isn\'t on screen.');
    expect(failures).toContain(
      "DataTable (example): 2 columns need 2 column headers (role columnheader); found 0.",
    );
    expect(failures).toContain("Callout (example): the component threw: bad tone");
  });

  test("reports a piece with no component once, rather than every fixture of it", async () => {
    const { Chart: _, ...elements } = good.elements;
    const failures = await checkComponents({ ...good, elements }, { locale: "en-GB" });
    expect(failures).toEqual(["Chart: no component; it would draw through Fallback."]);
  });

  test("checks only what the catalog holds", async () => {
    const narrow = defineCatalog({
      version: 1,
      elements: { Text: defaultCatalog.elements.Text },
    });
    const map = defineComponents(narrow, { elements: { Text: ({ text }) => <p>{text}</p> } });
    expect(await checkComponents(map, { catalog: narrow })).toEqual([]);
  });
});

describe("fixtures", () => {
  test("cover every piece in its example, its own states, and mid-stream", () => {
    const names = fixtures().map((fixture) => fixture.name);
    expect(names).toContain("DataTable (example)");
    expect(names).toContain("DataTable (empty)");
    expect(names).toContain("DataTable (streaming)");
    expect(names).toContain("email view (copied)");
    for (const type of Object.keys(defaultCatalog.elements)) {
      expect(names).toContain(`${type} (example)`);
    }
  });
});
