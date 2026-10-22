import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  defineCatalog,
  findBindings,
  formatIssues,
  markdownHeading,
  markdownParagraph,
  markdownTable,
  markdownText,
  readTree,
  resolveBindings,
  type TreeIssue,
  type TreeNode,
  toJSONSchema,
  toMarkdown,
  validateTree,
} from "../src/generative";

const catalog = defineCatalog({
  components: {
    Card: {
      description: "Groups related pieces under a title.",
      container: true,
      props: z.object({ title: z.string() }),
      markdown: (props, children) => [markdownHeading(3, props.title), children].join("\n\n"),
    },
    Stack: {
      description: "Pieces one after another.",
      container: true,
      props: z.object({}),
    },
    Metric: {
      description: "One key number with a label.",
      props: z.object({ label: z.string(), value: z.number(), note: z.string().optional() }),
      markdown: (props) => `**${markdownText(props.label)}:** ${props.value}`,
    },
    Table: {
      description: "Rows and columns to compare.",
      props: z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) }),
      bind: ["rows"],
      markdown: (props) => markdownTable(props.columns, props.rows),
    },
  },
});

/** The call from the docs: a card with a metric and a table bound to a query's rows. */
const call = {
  root: "card",
  elements: [
    { id: "card", type: "Card", props: { title: "Pipeline" }, children: ["total", "deals"] },
    { id: "total", type: "Metric", props: { label: "Total", value: 196000, note: null } },
    {
      id: "deals",
      type: "Table",
      props: {
        columns: ["Company"],
        rows: { $data: "deals_1", columns: ["company"], column: null },
      },
    },
  ],
};

const codes = (issues: readonly TreeIssue[] | undefined) => issues?.map((entry) => entry.code);

/** A hand-written Standard Schema, to show any compliant validator fits. */
const standardSchema = <Output>(check: (value: unknown) => Output | string, async = false) => ({
  "~standard": {
    version: 1 as const,
    vendor: "test",
    validate: (value: unknown) => {
      const output = check(value);
      const result =
        typeof output === "string"
          ? { issues: [{ message: output, path: ["label"] }] }
          : { value: output };
      return async ? Promise.resolve(result) : result;
    },
    jsonSchema: { input: () => ({ type: "object", properties: { label: { type: "string" } } }) },
    types: undefined as unknown as { input: Output; output: Output },
  },
});

describe("defineCatalog", () => {
  test("types each component's props from its schema", () => {
    defineCatalog({
      components: {
        Metric: {
          description: "One number.",
          props: z.object({ label: z.string() }),
          // @ts-expect-error: `value` isn't one of Metric's props
          markdown: (props) => props.value,
        },
      },
    });
    defineCatalog({
      components: {
        Table: {
          description: "Rows.",
          props: z.object({ rows: z.array(z.string()) }),
          // @ts-expect-error: only Table's own props can be bound
          bind: ["nope"],
        },
      },
    });
  });
});

describe("toJSONSchema", () => {
  const schema = toJSONSchema(catalog) as {
    required: string[];
    additionalProperties: boolean;
    properties: { elements: { maxItems: number; items: { anyOf: Record<string, unknown>[] } } };
  };
  const branch = (type: string) =>
    schema.properties.elements.items.anyOf.find(
      (entry) =>
        (entry as { properties: { type: { enum: string[] } } }).properties.type.enum[0] === type,
    ) as {
      description: string;
      required: string[];
      properties: Record<string, Record<string, unknown>>;
    };

  test("asks for a root and a list of elements, one branch per component", () => {
    expect(schema.required).toEqual(["root", "elements"]);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.elements.maxItems).toBe(40);
    expect(schema.properties.elements.items.anyOf).toHaveLength(4);
    expect(branch("Metric").description).toBe("One key number with a label.");
  });

  test("gives only containers children, capped by the limit", () => {
    expect(branch("Card").required).toEqual(["id", "type", "props", "children"]);
    expect(branch("Card").properties.children?.maxItems).toBe(24);
    expect(branch("Metric").properties.children).toBeUndefined();
  });

  test("makes props strict: closed, every property required, optional ones nullable", () => {
    const props = branch("Metric").properties.props as Record<string, unknown>;
    expect(props.required).toEqual(["label", "value", "note"]);
    expect(props.additionalProperties).toBe(false);
    expect((props.properties as Record<string, { type: unknown }>).note?.type).toEqual([
      "string",
      "null",
    ]);
    expect(props.$schema).toBeUndefined();
  });

  test("lets a bound prop be its value or a binding", () => {
    const props = branch("Table").properties.props as {
      properties: { rows: { anyOf: { properties?: Record<string, unknown> }[] } };
    };
    const binding = props.properties.rows.anyOf[1];
    expect(Object.keys(binding?.properties ?? {})).toEqual(["$data", "columns", "column"]);
  });

  test("offers the single-component shape", () => {
    const single = toJSONSchema(catalog, { single: true }) as {
      properties: { type: { enum: string[] }; props: { anyOf: unknown[] } };
    };
    expect(single.properties.type.enum).toEqual(["Card", "Stack", "Metric", "Table"]);
    expect(single.properties.props.anyOf).toHaveLength(4);
  });

  test("takes its caps from the limits", () => {
    const capped = toJSONSchema({ ...catalog, limits: { nodes: 10 } }) as typeof schema;
    expect(capped.properties.elements.maxItems).toBe(10);
  });

  test("needs a schema that converts to JSON Schema", () => {
    const label = standardSchema((value) => value as { label: string });
    const older = { "~standard": { ...label["~standard"], jsonSchema: undefined } };
    const catalogOfOlder = defineCatalog({
      // @ts-expect-error: this schema can't convert to JSON Schema
      components: { Note: { description: "A note.", props: older } },
    });
    expect(() => toJSONSchema(catalogOfOlder)).toThrow(
      '"Note" needs a schema that converts to JSON Schema',
    );
  });
});

describe("validateTree", () => {
  test("accepts a call and returns the tree to keep", async () => {
    const result = await validateTree(call, catalog);
    expect(result.issues).toBeUndefined();
    expect(result.value?.root).toBe("card");
    expect(result.value?.elements.card?.children).toEqual(["total", "deals"]);
    // A strict schema's null reads back as absent.
    expect(result.value?.elements.total?.props).toEqual({ label: "Total", value: 196000 });
    // A bound prop keeps its binding until it's resolved. Its type doesn't say so yet.
    expect(result.value?.elements.deals?.props as unknown).toEqual({
      columns: ["Company"],
      rows: { $data: "deals_1", columns: ["company"] },
    });
  });

  test("reads elements as a map keyed by id, json-render's shape", async () => {
    const result = await validateTree(
      { root: "m", elements: { m: { type: "Metric", props: { label: "Deals", value: 4 } } } },
      catalog,
    );
    expect(result.value?.elements.m?.props).toEqual({ label: "Deals", value: 4 });
  });

  test("reads one component on its own", async () => {
    const result = await validateTree(
      { type: "Metric", props: { label: "Deals", value: 4 } },
      catalog,
    );
    expect(result.value).toEqual({
      root: "root",
      elements: { root: { type: "Metric", props: { label: "Deals", value: 4 } } },
    });
  });

  test("reads the two common slips as meant", async () => {
    const result = await validateTree(
      { root: "m", elements: [{ id: "m", component: "Metric", label: "Deals", value: 4 }] },
      catalog,
    );
    expect(result.value?.elements.m).toEqual({
      type: "Metric",
      props: { label: "Deals", value: 4 },
    });
  });

  test("leaves out elements nothing points at", async () => {
    const result = await validateTree(
      {
        root: "m",
        elements: [
          { id: "m", type: "Metric", props: { label: "Deals", value: 4 } },
          { id: "loose", type: "Metric", props: { label: 1 } },
        ],
      },
      catalog,
    );
    expect(Object.keys(result.value?.elements ?? {})).toEqual(["m"]);
  });

  test("names the field for props that don't validate", async () => {
    const result = await validateTree(
      { root: "m", elements: [{ id: "m", type: "Metric", props: { label: "Deals", value: "4" } }] },
      catalog,
    );
    expect(result.issues?.[0]?.code).toBe("invalid_props");
    expect(result.issues?.[0]?.path).toEqual(["elements", "m", "props", "value"]);
  });

  test("checks a binding's own shape, and the other props as usual", async () => {
    const result = await validateTree(
      {
        root: "t",
        elements: [
          {
            id: "t",
            type: "Table",
            props: { columns: "Company", rows: { $data: "d", columns: "x" } },
          },
        ],
      },
      catalog,
    );
    expect(codes(result.issues)).toEqual(["invalid_binding", "invalid_props"]);
    expect(result.issues?.map((entry) => entry.path.join("."))).toEqual([
      "elements.t.props.rows",
      "elements.t.props.columns",
    ]);
  });

  test("refuses what the schema can't check", async () => {
    const run = (input: unknown, limits = {}) =>
      validateTree(input, { ...catalog, limits }).then((result) => codes(result.issues));
    const metric = (id: string) => ({ id, type: "Metric", props: { label: "x", value: 1 } });
    const stack = (id: string, children: string[]) => ({ id, type: "Stack", props: {}, children });

    expect(await run("not a call")).toEqual(["invalid_input"]);
    expect(await run({ root: "m", elements: [{ type: "Metric" }] })).toEqual(["missing_id"]);
    expect(await run({ root: "m", elements: [metric("m"), metric("m")] })).toEqual([
      "duplicate_id",
    ]);
    expect(await run({ elements: [metric("m")] })).toEqual(["missing_root"]);
    expect(await run({ root: "x", elements: [metric("m")] })).toEqual(["root_not_found"]);
    expect(await run({ root: "m", elements: [{ id: "m", type: "Chart", props: {} }] })).toEqual([
      "unknown_type",
    ]);
    expect(
      await run({ root: "m", elements: [{ ...metric("m"), children: ["n"] }, metric("n")] }),
    ).toEqual(["unexpected_children"]);
    expect(await run({ root: "s", elements: [stack("s", ["gone"])] })).toEqual(["dangling_child"]);
    expect(await run({ root: "s", elements: [stack("s", ["m", "m"]), metric("m")] })).toEqual([
      "duplicate_child",
    ]);
    expect(
      await run({
        root: "s",
        elements: [stack("s", ["a", "b"]), stack("a", ["m"]), stack("b", ["m"]), metric("m")],
      }),
    ).toEqual(["shared_child"]);
    expect(await run({ root: "a", elements: [stack("a", ["b"]), stack("b", ["a"])] })).toContain(
      "cycle",
    );
    expect(
      await run(
        { root: "a", elements: [stack("a", ["b"]), stack("b", ["m"]), metric("m")] },
        { depth: 2 },
      ),
    ).toEqual(["too_deep"]);
    expect(
      await run(
        { root: "s", elements: [stack("s", ["a", "b"]), metric("a"), metric("b")] },
        { nodes: 2 },
      ),
    ).toEqual(["too_many_nodes"]);
    expect(
      await run(
        { root: "s", elements: [stack("s", ["a", "b"]), metric("a"), metric("b")] },
        { children: 1 },
      ),
    ).toEqual(["too_many_children"]);
  });

  test("lists the components when a type isn't one", async () => {
    const result = await validateTree(
      { root: "c", elements: [{ id: "c", type: "Chart", props: {} }] },
      catalog,
    );
    expect(result.issues?.[0]?.message).toBe(
      '"Chart" is not a component. Components: Card, Stack, Metric, Table.',
    );
  });

  test("works with any Standard Schema validator, awaiting an async one", async () => {
    const label = standardSchema((value) => {
      const props = value as { label?: unknown };
      return typeof props.label === "string" ? { label: props.label } : "Expected a label.";
    }, true);
    const notes = defineCatalog({
      components: { Note: { description: "A note.", props: label } },
    });

    const valid = await validateTree({ type: "Note", props: { label: "Hi" } }, notes);
    expect(valid.value?.elements.root?.props).toEqual({ label: "Hi" });

    const invalid = await validateTree({ type: "Note", props: {} }, notes);
    expect(invalid.issues?.[0]?.path).toEqual(["props", "label"]);
  });

  test("walks each element once, however many parents list it", async () => {
    // Every element lists every element in the layer below, so a walk per path
    // would reach the leaf nine times.
    const layers = [["root"], ["a", "b", "c"], ["x", "y", "z"], ["leaf"]];
    const elements = layers.flatMap((ids, depth) =>
      ids.map((id) =>
        depth === layers.length - 1
          ? { id, type: "Metric", props: { label: id, value: "not a number" } }
          : { id, type: "Stack", props: {}, children: layers[depth + 1] },
      ),
    );
    const result = await validateTree({ root: "root", elements }, catalog);
    expect(codes(result.issues)).toContain("shared_child");
    expect(result.issues?.filter((entry) => entry.code === "invalid_props")).toHaveLength(1);
  });

  test("treats a name the catalog only inherits as unknown", async () => {
    const input = { type: "constructor", props: {} };
    expect(codes((await validateTree(input, catalog)).issues)).toEqual(["unknown_type"]);
    expect(readTree(input, catalog).root).toBeUndefined();
  });
});

describe("formatIssues", () => {
  test("writes one line per issue, where then what", () => {
    const issues: TreeIssue[] = [
      {
        code: "invalid_props",
        path: ["elements", "m", "props", "value"],
        message: "Expected number.",
      },
      { code: "missing_root", path: [], message: "Name the root." },
    ];
    expect(formatIssues(issues)).toBe(
      "elements.m.props.value: Expected number.\n(input): Name the root.",
    );
    expect(formatIssues(issues, 1)).toBe("elements.m.props.value: Expected number.\n…and 1 more.");
  });
});

describe("bindings", () => {
  test("are found where they sit, and resolved and validated in place", async () => {
    const checked = await validateTree(call, catalog);
    if (!checked.value) throw new Error("expected a tree");
    expect(findBindings(checked.value)).toEqual([
      { $data: "deals_1", columns: ["company"], id: "deals", prop: "rows" },
    ]);

    const resolved = await resolveBindings(checked.value, catalog, () => [
      { company: "Aalto Labs", stage: "Proposal" },
    ]);
    expect(resolved.value?.elements.deals?.props).toEqual({
      columns: ["Company"],
      rows: [["Aalto Labs"]],
    });
  });

  const picking = defineCatalog({
    components: {
      Grid: {
        description: "Rows.",
        props: z.object({ rows: z.array(z.array(z.string().nullable())) }),
        bind: ["rows"],
      },
      Series: {
        description: "Values.",
        props: z.object({ values: z.array(z.number()) }),
        bind: ["values"],
      },
    },
  });
  const rows = [
    { company: "Aalto Labs", stage: "Proposal", amount: 62400, owner: { name: "Minna" } },
    { company: "Kide Systems", stage: "Won", amount: 88000, owner: { name: "Joel" } },
  ];

  test("pick the binding's columns from the rows, in order, or one column's values", () => {
    const resolve = () => rows;

    const grid = readTree(
      {
        type: "Grid",
        props: { rows: { $data: "deals_1", columns: ["stage", "owner.name", "region"] } },
      },
      picking,
      { resolve },
    ).root;
    expect(grid?.props).toEqual({
      rows: [
        ["Proposal", "Minna", null],
        ["Won", "Joel", null],
      ],
    });

    const series = readTree(
      { type: "Series", props: { values: { $data: "deals_1", column: "amount" } } },
      picking,
      { resolve },
    ).root;
    expect(series?.props).toEqual({ values: [62400, 88000] });
  });

  test("wait while a read's lookup returns a promise, and resolve one on the server", async () => {
    const pending = readTree(
      { type: "Series", props: { values: { $data: "deals_1", column: "amount" } } },
      picking,
      { resolve: async () => rows },
    ).root;
    expect(pending?.status).toBe("pending");

    const tree = {
      root: "series",
      elements: {
        series: { type: "Series", props: { values: { $data: "deals_1", column: "amount" } } },
      },
    };
    const resolved = await resolveBindings(tree as never, picking, async () => rows);
    expect(resolved.value?.elements.series?.props).toEqual({ values: [62400, 88000] });
  });

  test("report data that wasn't found, or doesn't fit", async () => {
    const checked = await validateTree(call, catalog);
    if (!checked.value) throw new Error("expected a tree");

    const missing = await resolveBindings(checked.value, catalog, () => undefined);
    expect(codes(missing.issues)).toContain("unresolved_binding");
    expect(missing.issues?.[0]?.message).toBe('No data for "deals_1".');

    const wrong = await resolveBindings(checked.value, catalog, () => "not rows");
    expect(codes(wrong.issues)).toEqual(["invalid_props"]);
  });
});

describe("toMarkdown", () => {
  test("writes a tree through each component, children inside their container", async () => {
    const checked = await validateTree(call, catalog);
    if (!checked.value) throw new Error("expected a tree");
    const resolved = await resolveBindings(checked.value, catalog, () => [
      { company: "Aalto | Labs" },
    ]);
    if (!resolved.value) throw new Error("expected a resolved tree");
    expect(toMarkdown(resolved.value, catalog)).toBe(
      "### Pipeline\n\n**Total:** 196000\n\n| Company |\n| --- |\n| Aalto \\| Labs |",
    );
  });

  test("leaves out an element still waiting for its data", async () => {
    const checked = await validateTree(call, catalog);
    if (!checked.value) throw new Error("expected a tree");
    expect(toMarkdown(checked.value, catalog)).toBe("### Pipeline\n\n**Total:** 196000");
  });

  test("reads a container without markdown as its children, and needs one on a leaf", async () => {
    const stacked = await validateTree(
      {
        root: "s",
        elements: [
          { id: "s", type: "Stack", props: {}, children: ["m"] },
          { id: "m", type: "Metric", props: { label: "Deals", value: 4 } },
        ],
      },
      catalog,
    );
    if (!stacked.value) throw new Error("expected a tree");
    expect(toMarkdown(stacked.value, catalog)).toBe("**Deals:** 4");

    const bare = defineCatalog({
      components: { Note: { description: "A note.", props: z.object({ text: z.string() }) } },
    });
    const note = await validateTree({ type: "Note", props: { text: "Hi" } }, bare);
    if (!note.value) throw new Error("expected a tree");
    expect(() => toMarkdown(note.value, bare)).toThrow('"Note" has no markdown.');
  });
});

describe("Markdown is literal", () => {
  test("a paragraph keeps its words and loses every construct", () => {
    expect(
      markdownParagraph(
        "*not bold* and [a link](https://x.example)\n# not a heading\n1. not a list\n    indented\n\nnew paragraph & &amp; done",
      ),
    ).toBe(
      "\\*not bold\\* and \\[a link\\](https\\://x.example)\n\\# not a heading\n1\\. not a list\nindented\n\nnew paragraph & \\&amp; done",
    );
  });

  test("a bare address stays text, where GFM would link it", () => {
    expect(
      markdownParagraph("Mail minna@x.example or see www.x.example and HTTPS://x.example"),
    ).toBe("Mail minna\\@x.example or see www\\.x.example and HTTPS\\://x.example");
  });

  test("a heading stays one line, and keeps a trailing #", () => {
    expect(markdownHeading(4, "Ranked #")).toBe("#### Ranked \\#");
    expect(markdownHeading(3, "Q3 <b>\nsplit")).toBe("### Q3 \\<b\\> split");
  });

  test("one line of text joins its lines with one space, and stays fast on long runs", () => {
    expect(markdownText("Paid \n\n  orders")).toBe("Paid orders");
    expect(markdownText("  two  spaces\tstay ")).toBe("  two  spaces\tstay ");
    const start = performance.now();
    markdownText(`${" ".repeat(100_000)}x`);
    expect(performance.now() - start).toBeLessThan(100);
  });

  test("a pipe can't split a table column", () => {
    expect(markdownTable(["A"], [["x | y"]])).toBe("| A |\n| --- |\n| x \\| y |");
  });

  test("treats a lone carriage return as a line break", () => {
    expect(markdownHeading(2, "Title\r# Other")).toBe("## Title # Other");
    expect(markdownParagraph("One\r# Two")).toBe("One\n\\# Two");
  });
});

describe("readTree", () => {
  test("draws what's ready, marks what isn't, and skips what isn't written yet", () => {
    const tree = readTree(
      {
        root: "card",
        elements: [
          { id: "card", type: "Card", props: { title: "Pipe" }, children: ["total", "deals"] },
          { id: "total", type: "Metric", props: { label: "Total" } },
        ],
      },
      catalog,
    );
    expect(tree.root?.status).toBe("ready");
    expect(tree.root?.props).toEqual({ title: "Pipe" });
    expect(tree.root?.children.map((node) => [node.id, node.status])).toEqual([
      ["total", "pending"],
    ]);
  });

  test("types a ready node's props by its type", () => {
    const root = readTree({ type: "Metric", props: { label: "Deals", value: 4 } }, catalog).root;
    if (root?.status !== "ready" || root.type !== "Metric") throw new Error("expected a metric");
    const label: string = root.props.label;
    expect(label).toBe("Deals");
  });

  test("skips a type still being written", () => {
    expect(
      readTree({ root: "m", elements: [{ id: "m", type: "Met" }] }, catalog).root,
    ).toBeUndefined();
  });

  test("keeps a bound node pending until resolve finds its data", () => {
    const deals = call.elements[2];
    const input = { root: "deals", elements: [deals] };
    expect(readTree(input, catalog).root?.status).toBe("pending");
    const resolved = readTree(input, catalog, {
      resolve: () => [{ company: "Aalto Labs", stage: "Proposal" }],
    }).root;
    expect(resolved?.status).toBe("ready");
    expect(resolved?.props).toEqual({ columns: ["Company"], rows: [["Aalto Labs"]] });
  });

  test("leaves a node pending while an async validator would decide", () => {
    const label = standardSchema((value) => value as { label: string }, true);
    const notes = defineCatalog({
      components: { Note: { description: "A note.", props: label } },
    });
    expect(readTree({ type: "Note", props: { label: "Hi" } }, notes).root?.status).toBe("pending");
  });

  test("draws a child listed twice once", () => {
    const tree = readTree(
      {
        root: "s",
        elements: [
          { id: "s", type: "Stack", props: {}, children: ["m", "m"] },
          { id: "m", type: "Metric", props: { label: "Deals", value: 4 } },
        ],
      },
      catalog,
    );
    expect(tree.root?.children.map((node) => node.id)).toEqual(["m"]);
  });

  test("stops at a cycle instead of looping", () => {
    const tree = readTree(
      {
        root: "a",
        elements: [
          { id: "a", type: "Stack", props: {}, children: ["b"] },
          { id: "b", type: "Stack", props: {}, children: ["a"] },
        ],
      },
      catalog,
    );
    expect(tree.root?.children[0]?.children).toEqual([]);
  });

  test("draws each element once, however many parents list it", () => {
    const { root } = readTree(
      {
        root: "root",
        elements: [
          { id: "root", type: "Stack", props: {}, children: ["a", "b"] },
          { id: "a", type: "Stack", props: {}, children: ["shared"] },
          { id: "b", type: "Stack", props: {}, children: ["shared"] },
          { id: "shared", type: "Metric", props: { label: "Total", value: 1 } },
        ],
      },
      catalog,
    );
    const ids: string[] = [];
    const visit = (node: TreeNode<typeof catalog>) => {
      ids.push(node.id);
      node.children.forEach(visit);
    };
    if (root) visit(root);
    expect(ids).toEqual(["root", "a", "shared", "b"]);
  });
});
