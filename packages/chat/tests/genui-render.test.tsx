import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultCatalog } from "../src/genui/catalog";
import {
  GenUi,
  type GenUiComponents,
  type GenUiRootProps,
  useGenUiElement,
  useGenUiLive,
} from "../src/genui-render";

// Bare components: the package draws with whatever it is handed.
const Box = ({ children, title }: { children?: ReactNode; title?: string }) => (
  <section>
    {title ? <h3>{title}</h3> : null}
    {children}
  </section>
);
const components: GenUiComponents = {
  elements: {
    Card: Box,
    Stack: Box,
    Grid: Box,
    Heading: ({ text }) => <h4>{text}</h4>,
    Text: ({ text }) => <p>{text}</p>,
    Metric: ({ label, value }) => (
      <p>
        {label}: {value}
      </p>
    ),
    KeyValue: ({ items }) => <dl>{items.length}</dl>,
    DataTable: ({ rows }) => <table data-rows={rows.length} />,
    Chart: ({ kind }) => <figure data-kind={kind} />,
    Callout: ({ text }) => <aside>{text}</aside>,
  },
  views: {
    table: ({ props, title }) => <table data-rows={props.rows.length} title={title} />,
    chart: () => <figure />,
    metrics: () => <div />,
    record: ({ props }) => <h3>{props.name}</h3>,
    email: () => <div />,
    steps: () => <ol />,
  },
};

const layout = {
  root: "c",
  elements: [
    { id: "c", type: "Card", props: { title: "Q3" }, children: ["m", "t"] },
    { id: "m", type: "Metric", props: { label: "Socks", value: 47 } },
    { id: "t", type: "Text", props: { text: "Up a lot." } },
  ],
};

const draw = (node: ReactNode, root: Partial<GenUiRootProps> = {}) =>
  renderToStaticMarkup(
    <GenUi.Root components={components} {...root}>
      {node}
    </GenUi.Root>,
  );

describe("GenUi, outside any chat", () => {
  test("draws a whole spec with nothing but the component map", () => {
    expect(draw(<GenUi.Spec input={layout} />)).toBe(
      "<section><h3>Q3</h3><p>Socks: 47</p><p>Up a lot.</p></section>",
    );
  });

  test("adds no element of its own around what it draws", () => {
    const html = draw(<GenUi.Spec input={layout} />, { live: false });
    expect(html).not.toContain("data-genui");
  });

  test("draws a view with its title", () => {
    expect(
      draw(<GenUi.View input={{ view: "record", props: defaultCatalog.views.record.example }} />),
    ).toBe("<h3>Northwind Traders</h3>");
  });

  test("swaps bound data in", () => {
    const bound = {
      view: "table",
      title: "Paid",
      props: { columns: [{ label: "A" }], rows: { $data: "q1", columns: ["a"] } },
    };
    const data = { "props.rows": [["x"], ["y"]] };
    expect(draw(<GenUi.View data={data} input={bound} />)).toBe(
      '<table data-rows="2" title="Paid"></table>',
    );
  });
});

describe("GenUi, while the input streams", () => {
  test("keeps a container's children on screen while its own props arrive", () => {
    const partial = {
      root: "c",
      elements: [
        { id: "c", type: "Card", props: { title: 7 }, children: ["t"] },
        { id: "t", type: "Text", props: { text: "Here already" } },
      ],
    };
    expect(draw(<GenUi.Spec input={partial} />, { complete: false })).toBe(
      '<div data-genui-pending="" data-genui-type="Card"><p>Here already</p></div>',
    );
    // Whole, the same spec draws nothing for the card, and so nothing under it.
    expect(draw(<GenUi.Spec input={partial} />)).toBe("");
  });

  test("shows the placeholder until there is a root, and nothing once whole", () => {
    const Placeholder = ({ title }: { title?: string }) => <i>{title ?? "…"}</i>;
    const root = { complete: false, components: { ...components, Placeholder } };
    expect(draw(<GenUi.Spec input={{ root: "c" }} />, root)).toBe("<i>…</i>");
    expect(draw(<GenUi.View input={{ view: "table", title: "Deals" }} />, root)).toBe(
      "<i>Deals</i>",
    );
    expect(draw(<GenUi.Spec input={{ root: "c" }} />)).toBe("");
  });

  test("wraps each arriving piece only while live", () => {
    const Arrive = ({ children }: { children: ReactNode }) => <ins>{children}</ins>;
    const withArrive = { ...components, Arrive };
    expect(draw(<GenUi.Spec input={layout} />, { components: withArrive })).not.toContain("<ins>");
    expect(draw(<GenUi.Spec input={layout} />, { components: withArrive, live: true })).toContain(
      "<ins><section>",
    );
  });

  test("holds the last props that parsed through a chunk that doesn't", () => {
    const input = (kind: string) => ({
      root: "ch",
      elements: [
        {
          id: "ch",
          type: "Chart",
          props: { kind, categories: ["A"], series: [{ label: "S", values: [1] }] },
        },
      ],
    });
    const tree = (kind: string) => (
      <GenUi.Root complete={false} components={components}>
        <GenUi.Spec input={input(kind)} />
      </GenUi.Root>
    );
    const { container, rerender } = render(tree("bar"));
    rerender(tree("li")); // "line", half written
    expect(container.innerHTML).toBe('<figure data-kind="bar"></figure>');
    rerender(tree("line"));
    expect(container.innerHTML).toBe('<figure data-kind="line"></figure>');
  });

  test("settles when the parent re-renders with the same input", () => {
    // Held in state, the steady props must not be stored anew on every render.
    const tree = (input: unknown) => (
      <GenUi.Root complete={false} components={components}>
        <GenUi.Spec input={input} />
        <GenUi.View input={{ view: "record", props: defaultCatalog.views.record.example }} />
      </GenUi.Root>
    );
    const { container, rerender } = render(tree(layout));
    for (let pass = 0; pass < 3; pass++) rerender(tree(layout));
    expect(container.innerHTML).toBe(
      "<section><h3>Q3</h3><p>Socks: 47</p><p>Up a lot.</p></section><h3>Northwind Traders</h3>",
    );
  });
});

describe("GenUi, when a piece can't be drawn", () => {
  test("drops one that throws and draws the rest", () => {
    const errors: unknown[] = [];
    const broken = {
      ...components,
      elements: {
        ...components.elements,
        Metric: () => {
          throw new Error("bad data");
        },
      },
    };
    const { container } = render(
      <GenUi.Root components={broken} onError={(_, piece) => errors.push(piece)}>
        <GenUi.Spec input={layout} />
      </GenUi.Root>,
    );
    expect(container.innerHTML).toBe("<section><h3>Q3</h3><p>Up a lot.</p></section>");
    expect(errors).toEqual([{ id: "m", type: "Metric" }]);
  });

  test("hands unresolved data to Unbound, so a document can say where it lives", () => {
    const bound = {
      root: "t",
      elements: [
        {
          id: "t",
          type: "DataTable",
          props: { columns: [{ label: "A" }], rows: { $data: "file_1", columns: ["a"] } },
        },
      ],
    };
    expect(draw(<GenUi.Spec input={bound} />)).toBe("");
    const Unbound = ({ type, refs }: { type: string; refs: string[] }) => (
      <em>
        {type} from {refs.join()}
      </em>
    );
    expect(draw(<GenUi.Spec input={bound} />, { components: { ...components, Unbound } })).toBe(
      "<em>DataTable from file_1</em>",
    );
  });
});

describe("what a drawn component may ask", () => {
  test("which piece it is, and whether it is live", () => {
    const Probe = ({ text }: { text: string }) => {
      const element = useGenUiElement();
      return <p data-live={useGenUiLive()}>{`${element?.id}:${element?.type}:${text}`}</p>;
    };
    const probed = { ...components, elements: { ...components.elements, Text: Probe } };
    const input = { root: "t", elements: [{ id: "t", type: "Text", props: { text: "x" } }] };
    expect(draw(<GenUi.Spec input={input} />, { components: probed, live: true })).toBe(
      '<p data-live="true">t:Text:x</p>',
    );
  });
});

describe("the pure entry", () => {
  // @intentface/chat/genui runs on servers with no React and no DOM. The DOM
  // half is the typecheck's (tsconfig.pure.json); this is the import half.
  test("imports neither React nor the renderer", () => {
    const folder = new URL("../src/genui/", import.meta.url);
    for (const file of readdirSync(folder)) {
      const source = readFileSync(new URL(file, folder), "utf8");
      expect(source).not.toMatch(/from "react(-dom)?(\/[^"]*)?"/);
      expect(source).not.toMatch(/from "[^"]*genui-render/);
      expect(source).not.toMatch(/^"use client"/);
    }
  });
});
