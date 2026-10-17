import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";
import { defaultCatalog, defineCatalog } from "../src/genui/catalog";
import { defineElement } from "../src/genui/define";
import {
  copyWithGenUi,
  defineComponents,
  GenUi,
  type GenUiComponents,
  type GenUiRootProps,
  useGenUiElement,
  useGenUiLive,
} from "../src/genui-render";
import { rangeText } from "../src/genui-render/copy";

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
    Metric: ({ label, text }) => (
      <p>
        {label}: {text}
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
    expect(draw(<GenUi.Spec input={partial} />, { phase: "streaming" })).toBe(
      '<div data-genui-pending="" data-genui-type="Card"><p>Here already</p></div>',
    );
    // Whole, the same spec draws nothing for the card, and so nothing under it.
    expect(draw(<GenUi.Spec input={partial} />)).toBe("");
  });

  test("shows the placeholder until there is a root, and nothing once whole", () => {
    const Placeholder = ({ title }: { title?: string }) => <i>{title ?? "…"}</i>;
    const root = { phase: "streaming" as const, components: { ...components, Placeholder } };
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
      <GenUi.Root components={components} phase="streaming">
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
      <GenUi.Root components={components} phase="streaming">
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

  test("lets go of what it drew once whole, when the data goes away", () => {
    // Holding the last props that parsed is for a stream. A whole input that
    // stops parsing (its data taken back) must not stay drawn as it was.
    const Unbound = ({ refs }: { refs: string[] }) => <em>from {refs.join()}</em>;
    const withUnbound = { ...components, Unbound };
    const spec = {
      root: "t",
      elements: [
        {
          id: "t",
          type: "DataTable",
          props: { columns: [{ label: "A" }], rows: { $data: "file_1", columns: ["a"] } },
        },
      ],
    };
    const view = { view: "table", props: spec.elements[0]?.props };
    const tree = (data?: Record<string, unknown>) => (
      <GenUi.Root components={withUnbound}>
        <GenUi.Spec data={data && { "elements.t.props.rows": data.rows }} input={spec} />
        <GenUi.View data={data && { "props.rows": data.rows }} input={view} />
      </GenUi.Root>
    );
    const { container, rerender } = render(tree({ rows: [["x"]] }));
    expect(container.innerHTML).toBe('<table data-rows="1"></table><table data-rows="1"></table>');
    rerender(tree());
    expect(container.innerHTML).toBe("<em>from file_1</em><em>from file_1</em>");
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

describe("render props", () => {
  // Captures what a component is handed, and draws nothing.
  const capture = () => {
    const seen: Record<string, unknown>[] = [];
    const Probe = (render: Record<string, unknown>) => {
      seen.push(render);
      return null;
    };
    return { seen, Probe };
  };
  const one = (type: string, props: object) => ({
    root: "x",
    elements: [{ id: "x", type, props }],
  });

  test("hand a component its values formatted at the root's locale, beside its schema props", () => {
    const { seen, Probe } = capture();
    const metric = {
      label: "Open",
      value: 240000,
      format: "currency",
      currency: "EUR",
      delta: -2,
      deltaLabel: "vs last week",
    };
    draw(<GenUi.Spec input={one("Metric", metric)} />, {
      components: { ...components, elements: { ...components.elements, Metric: Probe } },
      locale: "en-GB",
    });
    expect(seen[0]).toMatchObject({
      label: "Open",
      text: "€240,000",
      delta: { text: "−2%", label: "vs last week", direction: "down", tone: "negative" },
      tone: "negative",
      props: metric,
    });
  });

  test("give a table its cells formatted, in column order, with alignment worked out", () => {
    const { seen, Probe } = capture();
    const table = {
      columns: [
        { label: "Account" },
        { label: "Value", format: "currency", currency: "EUR" },
        { label: "Value" },
      ],
      rows: [
        ["Northwind", 42000, 140],
        ["Globex", null, 12],
      ],
    };
    draw(<GenUi.Spec input={one("DataTable", table)} />, {
      components: { ...components, elements: { ...components.elements, DataTable: Probe } },
      locale: "en-GB",
    });
    expect(seen[0]).toMatchObject({
      columns: [
        { key: "Account", label: "Account", align: "left", display: "text", sortable: false },
        { key: "Value", align: "right", format: "currency" },
        { key: "Value 2", align: "right" },
      ],
      rows: [
        {
          key: "0",
          cells: [{ value: "Northwind", text: "Northwind" }, { text: "€42,000" }, { text: "140" }],
        },
        { key: "1", cells: [{ text: "Globex" }, { value: null, text: "—" }, { text: "12" }] },
      ],
      count: { total: 2, matching: 2 },
    });
  });

  test("give a view its render props, its caption and its schema props", () => {
    const { seen, Probe } = capture();
    draw(
      <GenUi.View
        input={{ view: "record", title: "Account", props: defaultCatalog.views.record.example }}
      />,
      {
        components: { ...components, views: { ...components.views, record: Probe } } as never,
        locale: "en-GB",
      },
    );
    expect(seen[0]).toMatchObject({
      name: "Northwind Traders",
      status: { label: "At risk", tone: "warning" },
      fields: [
        { label: "Owner", text: "Minna Laine" },
        { label: "ARR", value: 86000, text: "€86,000" },
        { label: "Renewal", text: "30 Nov 2026" },
        { label: "Seats", text: "140" },
      ],
      title: "Account",
      props: { name: "Northwind Traders" },
    });
  });

  test("are checked against the catalog by defineComponents", () => {
    // @ts-expect-error every element of the catalog needs a component
    defineComponents(defaultCatalog, { elements: { Card: Box } });
    // A metric is drawn from its formatted text, not a value to format.
    const Metric = ({ value }: { value: number }) => <p>{value}</p>;
    defineComponents(defaultCatalog, {
      ...components,
      // @ts-expect-error the component's props don't match the metric's render props
      elements: { ...components.elements, Metric },
    });
  });
});

describe("Fallback", () => {
  test("draws a piece with no component from its Markdown", () => {
    const { Metric: _, ...elements } = components.elements;
    expect(draw(<GenUi.Spec input={layout} />, { components: { ...components, elements } })).toBe(
      '<section><h3>Q3</h3><div data-genui-fallback="" data-genui-type="Metric" style="white-space:pre-wrap">- **Socks:** 47</div><p>Up a lot.</p></section>',
    );
  });

  test("takes the host's own component, for a view too", () => {
    const Fallback = ({ markdown, type }: { markdown: string; type: string }) => (
      <pre title={type}>{markdown}</pre>
    );
    const { views: _, ...noViews } = components;
    const view = {
      view: "steps",
      title: "Plan",
      props: { items: [{ title: "Call", status: "done" }] },
    };
    expect(draw(<GenUi.View input={view} />, { components: { ...noViews, Fallback } })).toBe(
      '<pre title="steps">**Plan**\n\n- [x] Call</pre>',
    );
  });
});

describe("phase", () => {
  test("draws a whole input the same once complete as once accepted", () => {
    const partial = { root: "t", elements: [{ id: "t", type: "Text", props: { text: 7 } }] };
    expect(draw(<GenUi.Spec input={partial} />, { phase: "complete" })).toBe("");
    expect(draw(<GenUi.Spec input={layout} />, { phase: "complete" })).toBe(
      draw(<GenUi.Spec input={layout} />),
    );
  });
});

describe("UI state", () => {
  // A disclosure written for the test: its open state is the piece's own.
  const Disclosure = defineElement({
    description: "A section that opens.",
    container: true,
    props: z.object({ title: z.string() }),
    toMarkdown: (props, { children }) => [props.title, ...children].join("\n\n"),
    toRender: (props, { state, update }) => ({
      title: props.title,
      open: state.open ?? false,
      onOpenChange: (open: boolean) => update({ open }, "trigger-press"),
    }),
    example: { title: "More" },
  });
  const catalog = defineCatalog({
    version: 1,
    elements: { Disclosure, Text: defaultCatalog.elements.Text },
  });
  const map = defineComponents(catalog, {
    elements: {
      Disclosure: ({ title, open, onOpenChange, children }) => (
        <section>
          <button onClick={() => onOpenChange(!open)} type="button">
            {title}
          </button>
          {open ? children : null}
        </section>
      ),
      Text: ({ text }) => <p>{text}</p>,
    },
  });
  const spec = {
    root: "d",
    elements: [
      { id: "d", type: "Disclosure", props: { title: "More" }, children: ["t"] },
      { id: "t", type: "Text", props: { text: "Hidden" } },
    ],
  };
  const mount = (root: Partial<GenUiRootProps<typeof catalog>> = {}) =>
    render(
      <GenUi.Root catalog={catalog} components={map} {...root}>
        <GenUi.Spec input={spec} />
      </GenUi.Root>,
    );

  test("changes through the piece's render props, and tells the host why", () => {
    const changes: unknown[] = [];
    const { container } = mount({
      onStateChange: (next, details) => changes.push([next, details.reason, details.piece]),
    });
    expect(container.textContent).toBe("More");
    fireEvent.click(container.querySelector("button") as HTMLElement);
    expect(container.textContent).toBe("MoreHidden");
    expect(changes).toEqual([
      [
        { keys: {}, elements: { d: { open: true } } },
        "trigger-press",
        { id: "d", type: "Disclosure" },
      ],
    ]);
  });

  test("doesn't land a change the host cancels", () => {
    const { container } = mount({ onStateChange: (_, details) => details.cancel() });
    fireEvent.click(container.querySelector("button") as HTMLElement);
    expect(container.textContent).toBe("More");
  });

  test("starts from defaultState, or follows a controlled state", () => {
    const open = { keys: {}, elements: { d: { open: true } } };
    expect(mount({ defaultState: open }).container.textContent).toBe("MoreHidden");
    const controlled = mount({ state: { keys: {}, elements: {} } });
    fireEvent.click(controlled.container.querySelector("button") as HTMLElement);
    expect(controlled.container.textContent).toBe("More");
  });
});

describe("copying", () => {
  const page = () =>
    render(
      <div>
        <p>Before</p>
        <GenUi.Root components={components} locale="en-GB">
          <GenUi.Part>
            <GenUi.Spec input={layout} />
          </GenUi.Part>
        </GenUi.Root>
        <p>After</p>
      </div>,
    ).container;
  const markdown = "### Q3\n\n- **Socks:** 47\n\nUp a lot.";

  test("a selection that touches a UI takes its whole Markdown", () => {
    const container = page();
    const [before, , , after] = Array.from(container.querySelectorAll("p"));
    const range = document.createRange();
    range.setStart(before?.firstChild as Node, 2);
    range.setEnd(after?.firstChild as Node, 3);
    expect(rangeText(range)).toBe(`fore\n\n${markdown}\n\nAft`);
  });

  test("a selection inside a UI takes all of it, and one outside leaves the copy alone", () => {
    const container = page();
    const metric = container.querySelector("section p") as HTMLElement;
    const inside = document.createRange();
    inside.selectNodeContents(metric);
    expect(rangeText(inside)).toBe(markdown);

    const outside = document.createRange();
    outside.selectNodeContents(container.querySelector("p") as HTMLElement);
    expect(rangeText(outside)).toBeNull();
  });

  test("copyWithGenUi writes plain text only when the selection touches a UI", () => {
    const container = page();
    const range = document.createRange();
    range.selectNodeContents(container.querySelector("section p") as HTMLElement);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const written: Record<string, string> = {};
    let prevented = false;
    copyWithGenUi({
      clipboardData: {
        setData: (type: string, text: string) => {
          written[type] = text;
        },
      } as never,
      preventDefault: () => {
        prevented = true;
      },
    });
    expect(written).toEqual({ "text/plain": markdown });
    expect(prevented).toBe(true);
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
