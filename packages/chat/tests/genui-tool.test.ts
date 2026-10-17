import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { defaultCatalog, defineCatalog } from "../src/genui/catalog";
import { defineElement } from "../src/genui/define";
import { exportSpec, toMarkdown } from "../src/genui/export";
import { chartRender, metricRender } from "../src/genui/render";
import { specSchemas } from "../src/genui/spec";
import { initialState, persistedState, readState, VIEW_STATE_ID } from "../src/genui/state";
import { compactHistory, genUiTool, partToMarkdown } from "../src/genui/tool";

const fixed = { locale: "en-GB", timeZone: "UTC" } as const;
const layout = genUiTool(defaultCatalog, { name: "show_ui", kind: "spec" });
const views = genUiTool(defaultCatalog, { name: "show_view", kind: "view" });

describe("genUiTool, for a layout", () => {
  test("shows the model the list-form schema, and says how to use it", () => {
    expect(layout.inputSchema).toEqual(
      specSchemas().SpecInputSchema.toJSONSchema() as Record<string, unknown>,
    );
    expect(layout.inputSchema.type).toBe("object");
    expect(layout.description).toContain("Never invent");
    expect(layout.description).toContain('"$data"');
    expect(layout.description).toContain("don't repeat it");
    // In a chat, UI is always a call: never a spec written into the reply.
    expect(layout.description).toContain("Show UI only by calling this tool.");
    expect(views.description).toContain("Show UI only by calling this tool.");
  });

  test("offers an example that it accepts", () => {
    expect(layout.examples).toHaveLength(1);
    const result = layout.accept(layout.examples[0]);
    expect(result.ok).toBe(true);
  });

  test("accepts a call as the spec to store, with a line for the model", () => {
    const result = layout.accept({
      root: "c",
      elements: [
        { id: "c", type: "Card", props: { title: "Q3" }, children: ["m", "t"] },
        { id: "m", type: "Metric", props: { label: "Socks", value: 47 } },
        {
          id: "t",
          type: "DataTable",
          props: { columns: [{ label: "Branch" }], rows: { $data: "q/branches", columns: ["b"] } },
        },
      ],
    });
    expect(result.ok && "spec" in result).toBe(true);
    if (!result.ok) return;
    expect(result.summary).toBe("Q3: Socks 47; Table from q/branches");
    expect(layout.modelText(result)).toBe(
      "Shown to the user: Q3: Socks 47; Table from q/branches. It is on screen now, so don't repeat it in your reply.",
    );
  });

  test("counts bound rows in the summary once they are resolved", () => {
    const input = {
      root: "t",
      elements: [
        {
          id: "t",
          type: "DataTable",
          props: { columns: [{ label: "Branch" }], rows: { $data: "q/branches", columns: ["b"] } },
        },
      ],
    };
    const result = layout.accept(input, {
      data: { "elements.t.props.rows": [["Bath"], ["York"]] },
    });
    expect(result.ok ? result.summary : "").toBe("table of 2 rows (Branch)");
  });

  test("tells the model what to fix, by field", () => {
    const result = layout.accept({
      root: "t",
      elements: [{ id: "t", type: "Text", props: { text: 3 } }],
    });
    expect(result.ok).toBe(false);
    expect(layout.modelText(result)).toMatch(
      /^Nothing was shown\. Fix these and call again:\n- elements\.t\.props\.text: /,
    );
  });

  test("is built once per catalog and options", () => {
    expect(genUiTool(defaultCatalog, { name: "show_ui", kind: "spec" })).toBe(layout);
    expect(genUiTool(defaultCatalog, { name: "other", kind: "spec" })).not.toBe(layout);
  });
});

describe("genUiTool, for views", () => {
  test("is an object at the top, view before props, as providers require", () => {
    const schema = views.inputSchema as { type: string; properties: Record<string, unknown> };
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.properties)).toEqual(["view", "title", "props"]);
    expect(views.description).toContain("- email: An email written for the user to send");
  });

  test("offers only the views it was given", () => {
    const tables = genUiTool(defaultCatalog, {
      name: "show_table",
      kind: "view",
      views: ["table"],
    });
    const email = { view: "email", props: defaultCatalog.views.email.example };
    expect(tables.accept(email)).toEqual({
      ok: false,
      errors: ['view: "email" is not offered here. Views: table.'],
    });
    expect(tables.examples).toEqual([
      { view: "table", title: "Table", props: defaultCatalog.views.table.example },
    ]);
  });

  test("summarises an accepted view with its own summary", () => {
    const result = views.accept({ view: "record", props: defaultCatalog.views.record.example });
    expect(result.ok ? result.summary : "").toBe(
      "Record: Northwind Traders (At risk) — Owner, ARR, Renewal, Seats",
    );
  });

  test("refuses to be built with no view", () => {
    expect(() => genUiTool(defaultCatalog, { name: "x", kind: "view", views: ["nope"] })).toThrow();
  });
});

describe("compactHistory", () => {
  const big = {
    root: "t",
    elements: [
      {
        id: "t",
        type: "DataTable",
        props: {
          columns: [{ label: "Account" }],
          rows: Array.from({ length: 400 }, (_, i) => [`Account ${i}`]),
        },
      },
    ],
  };
  const call = (input: unknown) => ({
    type: "tool-show_ui",
    toolCallId: "1",
    state: "output-available",
    input,
  });
  const messages = [
    { id: "a", parts: [{ type: "text", text: "Here" }, call(big)] },
    { id: "b", parts: [call(big)] },
    { id: "c", parts: [{ type: "text", text: "And this one?" }] },
  ];

  test("replaces an earlier large input with what it showed, and keeps the last two whole", () => {
    const compacted = compactHistory(messages, { tools: [layout] });
    expect(compacted[0]?.parts[1]).toEqual({
      ...call(big),
      input: { $compacted: "table of 400 rows (Account)" },
    });
    expect(compacted[0]?.parts[0]).toBe(messages[0]?.parts[0]);
    expect(compacted[1]).toBe(messages[1]);
    expect(compacted[2]).toBe(messages[2]);
    expect(messages[0]?.parts[1]).toEqual(call(big)); // nothing mutated
  });

  test("leaves small inputs and other tools alone", () => {
    const small = [{ id: "a", parts: [call({ root: "t", elements: [] })] }, ...messages.slice(1)];
    expect(compactHistory(small, { tools: [layout] })[0]).toBe(small[0]);
    expect(compactHistory(messages, { tools: [views] })[0]).toBe(messages[0]);
  });
});

describe("partToMarkdown", () => {
  test("reads text as written and a UI as its Markdown, at the reader's state", () => {
    const tools = [layout, views];
    expect(partToMarkdown({ type: "text", text: "**Hi**" }, { tools })).toBe("**Hi**");
    const view = { view: "steps", props: { items: [{ title: "Call" }] } };
    expect(
      partToMarkdown({ type: "tool-show_view", state: "output-available", input: view }, { tools }),
    ).toBe("- [ ] Call");
    expect(
      partToMarkdown({ type: "tool-show_view", state: "input-streaming", input: view }, { tools }),
    ).toBe("");
    expect(partToMarkdown({ type: "tool-search", input: {} }, { tools })).toBe("");
  });
});

describe("UI state", () => {
  const spec = {
    root: "s",
    elements: [
      { id: "s", type: "Stack", props: {}, children: ["t"] },
      { id: "t", type: "DataTable", props: defaultCatalog.elements.DataTable.example },
    ],
  };

  test("reads stored state back against its input, dropping what no longer fits", () => {
    const stored = {
      keys: { stage: "won" },
      elements: {
        t: { sort: { column: "Value", direction: "desc" }, page: -1, search: 4, expanded: ["0"] },
        gone: { open: true },
      },
    };
    expect(readState(spec, stored)).toEqual({
      keys: {},
      elements: { t: { sort: { column: "Value", direction: "desc" }, expanded: ["0"] } },
    });
    expect(readState(spec, "nonsense")).toEqual(initialState());
    expect(readState({ view: "table" }, { elements: { [VIEW_STATE_ID]: { tab: "a" } } })).toEqual({
      keys: {},
      elements: { [VIEW_STATE_ID]: { tab: "a" } },
    });
  });

  test("keeps only what outlives the session", () => {
    expect(
      persistedState({
        keys: {},
        elements: {
          a: { tab: "x", sort: { column: "A", direction: "asc" } },
          b: { search: "q", page: 2 },
          c: { checked: ["1"], open: false },
        },
      }),
    ).toEqual({ keys: {}, elements: { a: { tab: "x" }, c: { open: false, checked: ["1"] } } });
  });

  test("reaches an entry's Markdown, so a ticked item reads ticked", () => {
    const Ticks = defineElement({
      description: "Items to tick.",
      container: false,
      props: z.object({ items: z.array(z.string()) }),
      toMarkdown: (props, { state }) =>
        props.items
          .map(
            (item, index) => `- [${state?.checked?.includes(String(index)) ? "x" : " "}] ${item}`,
          )
          .join("\n"),
      example: { items: ["a"] },
    });
    const catalog = defineCatalog({ version: 1, elements: { Ticks } });
    const input = {
      root: "k",
      elements: [{ id: "k", type: "Ticks", props: { items: ["a", "b"] } }],
    };
    expect(
      toMarkdown(input, { catalog, state: { keys: {}, elements: { k: { checked: ["1"] } } } }),
    ).toBe("- [ ] a\n- [x] b");
  });
});

describe("render props, computed", () => {
  test("work out a metric's direction and tone, the schema's own tone first", () => {
    expect(metricRender({ label: "A", value: 1, delta: 0 }).delta).toMatchObject({
      direction: "flat",
      tone: "neutral",
    });
    expect(metricRender({ label: "Churn", value: 3, delta: 2, tone: "negative" })).toMatchObject({
      delta: { text: "+2%", direction: "up", tone: "negative" },
      tone: "negative",
    });
    expect(metricRender({ label: "A", value: 1 }, fixed)).toEqual({
      label: "A",
      text: "1",
      tone: "neutral",
    });
  });

  test("show a chart's dates as dates, and a pie's first series only", () => {
    const render = chartRender(
      {
        kind: "pie",
        categories: ["2026-10-01", "W2"],
        series: [
          { label: "A", values: [1, 2] },
          { label: "B", values: [3, 4] },
        ],
        format: "percent",
      },
      fixed,
    );
    expect(render.categories).toEqual(["1 Oct 2026", "W2"]);
    expect(render.series.map((s) => s.label)).toEqual(["A"]);
    expect(render.formatValue(12.5)).toBe("12.5%");
    expect(render.stacked).toBe(false);
  });
});

describe("exportSpec from one element", () => {
  test("writes that piece and what it holds, as Fallback draws it", () => {
    const input = {
      root: "c",
      elements: [
        { id: "c", type: "Card", props: { title: "Q3" }, children: ["g"] },
        { id: "g", type: "Grid", props: { columns: 2 }, children: ["m"] },
        { id: "m", type: "Metric", props: { label: "Socks", value: 47 } },
      ],
    };
    expect(exportSpec(input, { from: "g" })?.markdown).toBe("- **Socks:** 47");
    expect(exportSpec(input, { from: "nope" })).toBeNull();
  });
});
